import axios from 'axios';
import {
  Escrow,
  EscrowFilters,
  EscrowListResponse,
  CreateEscrowPayload,
  EscrowCreationIntent,
  EscrowCreationResult,
  PrepareEscrowCreationPayload,
  ReleaseMilestonePayload,
} from '../types/escrow';
import { withRetry } from '../utils/retry';
import { NotificationsResponse } from '../types/notification';
import { getAccessToken, getSecureAccessToken, clearSession } from './session';
import type { AxiosProgressEvent } from 'axios';
import { envConfig } from '../security/env';

/**
 * The Nest auth module is URI-versioned (`app.enableVersioning`), so its routes
 * live under `/v1/auth/...` rather than the `/api/...` prefix the escrow routes
 * use. Overridable for local gateways/proxies.
 */
const AUTH_PATH_PREFIX = process.env.EXPO_PUBLIC_AUTH_PATH_PREFIX ?? '/v1/auth';

const api = axios.create({
  baseURL: envConfig.apiUrl,
  timeout: 15000,
  headers: { 'Content-Type': 'application/json' },
});

// Attach the SecureStore-backed JWT to every request (#549/#550)
// Async-safe: reads the persisted token from SecureStore if the in-memory
// session is empty (e.g. a request fires before hydration finishes).
api.interceptors.request.use(async (config) => {
  let token = getAccessToken();
  if (!token) {
    token = await getSecureAccessToken();
  }
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

/**
 * #719 — Session-expiry recovery.
 *
 * On HTTP 401: clear the SecureStore-backed session (once) and notify a
 * registered navigation handler so the user lands on the wallet-connect
 * welcome screen. Subsequent 401s with the same dead token do not re-fire
 * the prompt until a new session is saved.
 */
type SessionExpiredHandler = () => void;
let onSessionExpired: SessionExpiredHandler | null = null;
let sessionExpiryHandled = false;

/** Register navigation (e.g. router.replace('/')). Call once from root layout. */
export function setSessionExpiredHandler(handler: SessionExpiredHandler | null): void {
  onSessionExpired = handler;
}

/** Test helper — reset the single-shot 401 gate. */
export function __resetSessionExpiryGateForTests(): void {
  sessionExpiryHandled = false;
}

export function __getSessionExpiryHandledForTests(): boolean {
  return sessionExpiryHandled;
}

/** Call after a successful sign-in so a future 401 can prompt again. */
export function resetSessionExpiryGate(): void {
  sessionExpiryHandled = false;
}

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const status = error?.response?.status;
    if (status === 401 && !sessionExpiryHandled) {
      sessionExpiryHandled = true;
      try {
        await clearSession();
      } catch {
        /* still navigate even if SecureStore delete fails */
      }
      try {
        onSessionExpired?.();
      } catch {
        /* navigation errors must not swallow the original 401 */
      }
    }
    return Promise.reject(error);
  },
);

export interface ChallengeResponse {
  /** Raw nonce, echoed for debugging — `message` is what must be signed. */
  nonce: string;
  /** Exact string the wallet must sign. */
  message: string;
}

export interface VerifyResponse {
  accessToken: string;
  refreshToken: string;
}

export const authApi = {
  /** #550 - step 1: ask the backend for a nonce/challenge for this address. */
  requestChallenge: async (walletAddress: string): Promise<ChallengeResponse> => {
    const { data } = await api.post<ChallengeResponse>(`${AUTH_PATH_PREFIX}/challenge`, {
      walletAddress,
    });
    return data;
  },

  /** #550 - step 3: exchange the signature for a JWT pair. */
  verifySignature: async (publicKey: string, signature: string): Promise<VerifyResponse> => {
    const { data } = await api.post<VerifyResponse>(`${AUTH_PATH_PREFIX}/verify`, {
      publicKey,
      signature,
    });
    return data;
  },

  /** Exchange a refresh token for a fresh JWT pair. */
  refresh: async (refreshToken: string): Promise<VerifyResponse> => {
    const { data } = await api.post<VerifyResponse>(`${AUTH_PATH_PREFIX}/refresh`, {
      refreshToken,
    });
    return data;
  },
};

export const escrowApi = {
  /** #314 – list escrows with status filter + pagination (auto-retry on testnet failures) */
  list: async (filters: EscrowFilters = {}): Promise<EscrowListResponse> => {
    return withRetry(async () => {
      const params: Record<string, string | number> = {
        page: filters.page ?? 1,
        limit: filters.limit ?? 20,
      };
      if (filters.status && filters.status !== 'all') params.status = filters.status;
      if (filters.search) params.search = filters.search;

      const { data } = await api.get<EscrowListResponse>('/api/escrows', { params });
      return data;
    }, { maxRetries: 2 });
  },

  /** #315 – get single escrow with milestones, parties, events (auto-retry) */
  getById: async (id: string): Promise<Escrow> => {
    return withRetry(async () => {
      const { data } = await api.get<Escrow>(`/api/escrows/${id}`);
      return data;
    }, { maxRetries: 3 });
  },

  /** #316 – create escrow (no auto-retry — user explicitly triggers this) */
  create: async (payload: CreateEscrowPayload): Promise<Escrow> => {
    const { data } = await api.post<Escrow>('/api/escrows', payload);
    return data;
  },

  /**
   * #709 – step 1 of wallet-signed creation: the backend builds and simulates
   * the Soroban `create_escrow` call and returns the unsigned envelope. Reusing
   * the same `intentId` on retry is idempotent server-side.
   */
  prepareCreation: async (payload: PrepareEscrowCreationPayload): Promise<EscrowCreationIntent> => {
    const { data } = await api.post<EscrowCreationIntent>('/api/escrows/creation-intents', payload);
    return data;
  },

  /** #709 – step 2: submit the device-signed envelope for broadcast + settlement. */
  submitCreation: async (intentId: string, signedXdr: string): Promise<EscrowCreationResult> => {
    const { data } = await api.post<EscrowCreationResult>(
      `/api/escrows/creation-intents/${intentId}/submit`,
      { signedXdr },
    );
    return data;
  },

  /**
   * #317 – release a milestone (no auto-retry — tx-sensitive, user controls retry)
   *
   * #709 tracking note: no client-side signing here, deliberately. The backend
   * route `POST /escrows/:id/conditions/:conditionId/release` executes the
   * release itself and does not return an unsigned XDR, so there is nothing for
   * `signTransactionXDR` to sign. `POST /escrows/:id/prepare-intent` only
   * supports CREATE_ESCROW / DEPOSIT_FUNDS today; once a release operation is
   * added there, switch this to prepare → `signTransactionXDR` → submit like
   * `prepareCreation` above.
   */
  releaseMilestone: async (payload: ReleaseMilestonePayload): Promise<{ txHash: string }> => {
    const { data } = await api.post<{ txHash: string }>(
      `/api/escrows/${payload.escrowId}/milestones/${payload.milestoneId}/release`,
    );
    return data;
  },

  /** #317 – poll transaction status (auto-retry with longer backoff) */
  getTxStatus: async (txHash: string): Promise<{ status: string; confirmed: boolean }> => {
    return withRetry(async () => {
      const { data } = await api.get<{ status: string; confirmed: boolean }>(
        `/api/transactions/${txHash}/status`,
      );
      return data;
    }, { maxRetries: 2, initialDelayMs: 2000 });
  },
};

interface InviteValidation {
  escrowId: string;
  role: string;
  sender: string;
  expiresAt: string;
}

export const inviteApi = {
  validateToken: async (token: string): Promise<InviteValidation> => {
    const { data } = await api.get<InviteValidation>(`/api/invites/${token}`);
    return data;
  },
  acceptInvitation: async (token: string): Promise<InviteValidation> => {
    const { data } = await api.post<InviteValidation>(`/api/invites/${token}/accept`);
    return data;
  },
};

export interface AppVersionResponse {
  minSupportedVersion: string;
  latestVersion: string;
  updateUrl: string;
}

export const versionApi = {
  /** #366 – check minimum supported and latest app versions */
  check: async (): Promise<AppVersionResponse> => {
    const { data } = await api.get<AppVersionResponse>('/api/app/version');
    return data;
  },
};

export const notificationApi = {
  /** Fetch user notifications */
  list: async (): Promise<NotificationsResponse> => {
    const { data } = await api.get<NotificationsResponse>('/api/notifications');
    return data;
  },

  /** Get unread notification count */
  getUnreadCount: async (): Promise<number> => {
    const { data } = await api.get<number>('/api/notifications/unread-count');
    return data;
  },

  /** Mark notification(s) as read */
  markAsRead: async (notificationId?: string): Promise<void> => {
    await api.post('/api/notifications/mark-as-read', { notificationId });
  },

  /**
   * #761 — Register this device's Expo push token with the backend so escrow
   * funding / release / dispute events can be delivered outside the app.
   */
  registerDevice: async (device: { pushToken: string; platform: string }): Promise<void> => {
    await api.post('/api/notifications/devices', device);
  },

  /** #761 — De-register the push token on logout / disconnect. */
  unregisterDevice: async (pushToken: string): Promise<void> => {
    await api.delete(`/api/notifications/devices/${encodeURIComponent(pushToken)}`);
  },
};
export interface ServerDispute {
  id: string;
  escrowId: string;
  reason: string;
  status: string;
  evidence?: string[] | null;
  outcome?: string | null;
  resolutionNotes?: string | null;
  resolvedAt?: string | null;
}

export const disputeApi = {
  /** File a dispute against an escrow; evidence holds CIDs from uploadEvidence */
  file: async (
    escrowId: string,
    payload: { reason: string; evidence?: string[] },
  ): Promise<ServerDispute> => {
    const { data } = await api.post<ServerDispute>(`/api/escrows/${escrowId}/dispute`, payload);
    return data;
  },

  /** Fetch the dispute for an escrow (404 when none exists) */
  get: async (escrowId: string): Promise<ServerDispute | null> => {
    const { data } = await api.get<ServerDispute | null>(`/api/escrows/${escrowId}/dispute`);
    return data;
  },

  /** #409 — upload evidence file for a dispute, returns CID and URL */
  /**
   * #409 / #720 — upload evidence; forwards axios onUploadProgress for real UI progress.
   */
  uploadEvidence: async (
    escrowId: string,
    fileUri: string,
    fileName: string,
    mimeType: string,
    onUploadProgress?: (percent: number) => void,
  ): Promise<{ cid: string; url: string }> => {
    const formData = new FormData();
    /* React Native's FormData accepts { uri, name, type } but TS types don't reflect it */
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const fileBlob = { uri: fileUri, name: fileName, type: mimeType } as any;
    formData.append('files', fileBlob);

    const { data } = await api.post<{ cid: string; url: string }>(
      `/api/escrows/${escrowId}/evidence`,
      formData,
      {
        headers: { 'Content-Type': 'multipart/form-data' },
        onUploadProgress: (event: AxiosProgressEvent) => {
          if (!onUploadProgress) return;
          const total = event.total ?? 0;
          if (total > 0) {
            const percent = Math.min(99, Math.round((event.loaded / total) * 100));
            onUploadProgress(percent);
          } else if (event.loaded > 0) {
            onUploadProgress(50);
          }
        },
      },
    );
    onUploadProgress?.(100);
    return data;
  },
};
