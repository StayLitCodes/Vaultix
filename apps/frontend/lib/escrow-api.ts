import { ICondition, IDispute, IEscrowExtended } from "@/types/escrow";

const apiBaseUrl =
  process.env.NEXT_PUBLIC_API_BASE_URL?.replace(/\/$/, "") ?? "";

const buildApiUrl = (path: string) => {
  if (apiBaseUrl) {
    return `${apiBaseUrl}${path}`;
  }

  return `/api${path}`;
};

const readErrorMessage = async (response: Response) => {
  const fallback = `Request failed with status ${response.status}`;

  try {
    const data = (await response.json()) as { message?: string | string[] };

    if (Array.isArray(data.message)) {
      return data.message.join(", ");
    }

    return data.message ?? fallback;
  } catch {
    return fallback;
  }
};

const request = async <T>(path: string, init?: RequestInit): Promise<T> => {
  const response = await fetch(buildApiUrl(path), {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });

  if (!response.ok) {
    throw new Error(await readErrorMessage(response));
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return (await response.json()) as T;
};

export const fetchEscrow = (id: string) =>
  request<IEscrowExtended>(`/escrows/${id}`);

export const acceptPartyInvitation = (escrowId: string, partyId: string) =>
  request(`/escrows/${escrowId}/parties/${partyId}/accept`, {
    method: "POST",
  });

export const rejectPartyInvitation = (escrowId: string, partyId: string) =>
  request(`/escrows/${escrowId}/parties/${partyId}/reject`, {
    method: "POST",
  });

export const fulfillCondition = (
  escrowId: string,
  conditionId: string,
  payload: { notes?: string; evidence?: string },
) =>
  request<ICondition>(
    `/escrows/${escrowId}/conditions/${conditionId}/fulfill`,
    {
      method: "POST",
      body: JSON.stringify(payload),
    },
  );

export const confirmCondition = (escrowId: string, conditionId: string) =>
  request<ICondition>(
    `/escrows/${escrowId}/conditions/${conditionId}/confirm`,
    {
      method: "POST",
    },
  );

export const uploadEvidence = async (
  escrowId: string,
  file: File,
): Promise<{ cid: string; url: string }> => {
  const formData = new FormData();
  formData.append("file", file);

  const token =
    typeof window !== "undefined"
      ? localStorage.getItem("vaultix_token")
      : null;

  const response = await fetch(
    `${process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000"}/escrows/${escrowId}/evidence`,
    {
      method: "POST",
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: formData,
    },
  );

  if (!response.ok) {
    const error = await response
      .json()
      .catch(() => ({ message: "Upload failed" }));
    throw new Error(error.message || `HTTP ${response.status}`);
  }

  return response.json();
};

export const fileDispute = (
  escrowId: string,
  data: { reason: string; evidence?: string[] },
): Promise<IDispute> =>
  request<IDispute>(`/escrows/${escrowId}/dispute`, {
    method: "POST",
    body: JSON.stringify(data),
  });

export const resolveDispute = (
  escrowId: string,
  data: {
    outcome: string;
    resolutionNotes: string;
    sellerPercent?: number;
    buyerPercent?: number;
  },
): Promise<IDispute> =>
  request<IDispute>(`/escrows/${escrowId}/dispute/resolve`, {
    method: "POST",
    body: JSON.stringify(data),
  });

// API Key Management
export interface IApiKey {
  id: string;
  name: string;
  active: boolean;
  rateLimitPerMinute: number;
  createdAt: string;
  revokedAt?: string;
}

export interface IApiKeyCreationResponse {
  id: string;
  name: string;
  key: string;
  rateLimitPerMinute: number;
  createdAt: string;
}

export const createApiKey = (data: {
  name: string;
  rateLimitPerMinute?: number;
}): Promise<IApiKeyCreationResponse> =>
  request<IApiKeyCreationResponse>("/api-keys", {
    method: "POST",
    body: JSON.stringify(data),
  });

export const listApiKeys = (): Promise<IApiKey[]> =>
  request<IApiKey[]>("/api-keys", {
    method: "GET",
  });

export const revokeApiKey = (id: string): Promise<IApiKey> =>
  request<IApiKey>(`/api-keys/${id}`, {
    method: "DELETE",
  });

// Per-escrow events (timeline)
export interface IEscrowEventsResponse {
  data: IEventResponse[];
  total: number;
  page: number;
  limit: number;
}

export const fetchEscrowEvents = (
  escrowId: string,
  params: { page?: number; limit?: number; sortOrder?: "ASC" | "DESC" } = {},
): Promise<IEscrowEventsResponse> => {
  const qp = new URLSearchParams();
  if (params.page) qp.set("page", String(params.page));
  if (params.limit) qp.set("limit", String(params.limit));
  if (params.sortOrder) qp.set("sortOrder", params.sortOrder);
  const qs = qp.toString();
  return request<IEscrowEventsResponse>(
    `/escrows/${escrowId}/events${qs ? `?${qs}` : ""}`,
  );
};

// Global Events / Transaction History
export interface IEventResponse {
  id: string;
  escrowId: string;
  eventType: string;
  actorId?: string;
  data?: Record<string, any>;
  ipAddress?: string;
  createdAt: string;
  escrow?: {
    id: string;
    title: string;
    amount: number;
    assetCode: string;
    assetIssuer?: string;
    status: string;
  };
  actor?: {
    walletAddress?: string;
  };
}

export interface IEventsListResponse {
  data: IEventResponse[];
  total: number;
  page: number;
  limit: number;
}

export const fetchEvents = (
  params: {
    page?: number;
    limit?: number;
    eventType?: string;
    dateFrom?: string;
    dateTo?: string;
    sortBy?: string;
    sortOrder?: "ASC" | "DESC";
  } = {},
): Promise<IEventsListResponse> => {
  const queryParams = new URLSearchParams();

  if (params.page) queryParams.set("page", String(params.page));
  if (params.limit) queryParams.set("limit", String(params.limit));
  if (params.eventType) queryParams.set("eventType", params.eventType);
  if (params.dateFrom) queryParams.set("dateFrom", params.dateFrom);
  if (params.dateTo) queryParams.set("dateTo", params.dateTo);
  if (params.sortBy) queryParams.set("sortBy", params.sortBy);
  if (params.sortOrder) queryParams.set("sortOrder", params.sortOrder);

  const queryString = queryParams.toString();
  return request<IEventsListResponse>(
    `/events${queryString ? `?${queryString}` : ""}`,
    {
      method: "GET",
    },
  );
};
