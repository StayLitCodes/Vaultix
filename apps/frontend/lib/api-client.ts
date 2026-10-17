const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL?.replace(/\/+$/, "") || "http://localhost:3000";
const API_VERSION_PREFIX = "/v1";
const ACCESS_TOKEN_KEY = "vaultix_token";
const REFRESH_TOKEN_KEY = "vaultix_refresh_token";

export class IdentityChangedError extends Error {
  constructor() {
    super("Request cancelled due to wallet identity change");
    this.name = "IdentityChangedError";
  }
}

export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly code?: string,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export type ApiRequestOptions = Omit<RequestInit, "body"> & {
  body?: unknown;
  onResponse?: (response: Response) => void;
};

function combineAbortSignals(signals: AbortSignal[]): {
  signal: AbortSignal;
  cleanup: () => void;
} {
  const controller = new AbortController();
  const listeners: Array<[AbortSignal, () => void]> = [];

  for (const signal of signals) {
    if (signal.aborted) {
      controller.abort(signal.reason);
      break;
    }

    const abort = () => controller.abort(signal.reason);
    signal.addEventListener("abort", abort, { once: true });
    listeners.push([signal, abort]);
  }

  return {
    signal: controller.signal,
    cleanup: () => {
      for (const [source, listener] of listeners) {
        source.removeEventListener("abort", listener);
      }
    },
  };
}

async function readApiError(response: Response): Promise<ApiError> {
  let payload: unknown;
  try {
    payload = await response.json();
  } catch {
    payload = undefined;
  }

  const body =
    payload && typeof payload === "object"
      ? (payload as {
          message?: string | string[];
          error?: string;
          code?: string;
          details?: unknown;
        })
      : undefined;
  const message = Array.isArray(body?.message)
    ? body.message.join(", ")
    : body?.message ?? body?.error ?? response.statusText;

  return new ApiError(
    message || `Request failed with status ${response.status}`,
    response.status,
    body?.code,
    body?.details,
  );
}

class ApiClient {
  private authToken: string | null = null;
  private identityGeneration = 0;
  private abortController = new AbortController();
  private refreshPromise: Promise<boolean> | null = null;

  constructor() {
    if (typeof window !== "undefined") {
      this.authToken = window.localStorage.getItem(ACCESS_TOKEN_KEY);
    }
  }

  /** Abort in-flight protected requests (wallet switch / disconnect). */
  cancelPendingRequests(): void {
    this.abortController.abort();
    this.abortController = new AbortController();
    this.refreshPromise = null;
    this.identityGeneration += 1;
  }

  applySessionToken(token: string | null): void {
    this.authToken = token;
    if (typeof window === "undefined") return;

    if (token) {
      window.localStorage.setItem("vaultix_login_time", String(Date.now()));
      document.cookie = `vaultix_token=${token}; path=/; max-age=86400`;
    } else {
      document.cookie =
        "vaultix_token=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT";
    }
  }

  setToken(token: string | null): void {
    this.authToken = token;
    if (typeof window === "undefined") return;

    if (token) {
      window.localStorage.setItem(ACCESS_TOKEN_KEY, token);
      window.localStorage.setItem("vaultix_login_time", String(Date.now()));
      document.cookie = `vaultix_token=${token}; path=/; max-age=86400`;
    } else {
      window.localStorage.removeItem(ACCESS_TOKEN_KEY);
      window.localStorage.removeItem(REFRESH_TOKEN_KEY);
      window.localStorage.removeItem("vaultix_login_time");
      document.cookie =
        "vaultix_token=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT";
    }
  }

  getToken(): string | null {
    return this.authToken;
  }

  async get<T>(path: string, options: Omit<ApiRequestOptions, "method" | "body"> = {}): Promise<T> {
    return this.request<T>(path, { ...options, method: "GET" });
  }

  async post<T>(
    path: string,
    body?: unknown,
    options: Omit<ApiRequestOptions, "method" | "body"> = {},
  ): Promise<T> {
    return this.request<T>(path, { ...options, method: "POST", body });
  }

  async patch<T>(
    path: string,
    body?: unknown,
    options: Omit<ApiRequestOptions, "method" | "body"> = {},
  ): Promise<T> {
    return this.request<T>(path, { ...options, method: "PATCH", body });
  }

  async put<T>(
    path: string,
    body?: unknown,
    options: Omit<ApiRequestOptions, "method" | "body"> = {},
  ): Promise<T> {
    return this.request<T>(path, { ...options, method: "PUT", body });
  }

  async delete<T>(
    path: string,
    options: Omit<ApiRequestOptions, "method" | "body"> = {},
  ): Promise<T> {
    return this.request<T>(path, { ...options, method: "DELETE" });
  }

  private buildUrl(path: string): string {
    const normalizedPath = path.startsWith("/") ? path : `/${path}`;
    return `${API_BASE_URL}${API_VERSION_PREFIX}${normalizedPath}`;
  }

  async request<T>(
    path: string,
    options: ApiRequestOptions = {},
  ): Promise<T> {
    return this.execute<T>(path, options, false);
  }

  private async execute<T>(
    path: string,
    options: ApiRequestOptions,
    hasRetried: boolean,
  ): Promise<T> {
    const { onResponse, ...fetchOptions } = options;
    const generation = this.identityGeneration;
    const requestToken = this.authToken;
    const headers = new Headers(fetchOptions.headers);
    const body = fetchOptions.body;
    const isFormData = typeof FormData !== "undefined" && body instanceof FormData;
    const isBinaryBody =
      (typeof Blob !== "undefined" && body instanceof Blob) ||
      (typeof URLSearchParams !== "undefined" && body instanceof URLSearchParams) ||
      body instanceof ArrayBuffer;
    const isBodyInit =
      isFormData ||
      typeof body === "string" ||
      isBinaryBody;
    const requestBody =
      body === undefined || body === null
        ? undefined
        : isBodyInit
          ? (body as BodyInit)
          : JSON.stringify(body);

    if (
      requestBody !== undefined &&
      !isFormData &&
      !isBinaryBody &&
      !headers.has("Content-Type")
    ) {
      headers.set("Content-Type", "application/json");
    }
    if (requestToken && !headers.has("Authorization")) {
      headers.set("Authorization", `Bearer ${requestToken}`);
    }

    try {
      const combined = combineAbortSignals([
        this.abortController.signal,
        ...(options.signal ? [options.signal] : []),
      ]);
      let response: Response;
      try {
        response = await fetch(this.buildUrl(path), {
          ...fetchOptions,
          body: requestBody,
          headers,
          credentials: fetchOptions.credentials ?? "include",
          signal: combined.signal,
        });
      } finally {
        combined.cleanup();
      }

      if (generation !== this.identityGeneration) {
        throw new IdentityChangedError();
      }

      if (
        response.status === 401 &&
        !hasRetried &&
        !["/auth/refresh", "/auth/challenge", "/auth/verify"].includes(
          path.split("?")[0],
        )
      ) {
        if (requestToken !== this.authToken && this.authToken) {
          return this.execute<T>(path, options, true);
        }
        if (
          requestToken &&
          (await this.refreshToken(generation))
        ) {
          return this.execute<T>(path, options, true);
        }
      }

      if (response.ok) onResponse?.(response);
      if (!response.ok) {
        throw await readApiError(response);
      }
      if (response.status === 204) {
        return undefined as T;
      }

      const data = (await response.json()) as T;
      if (generation !== this.identityGeneration) {
        throw new IdentityChangedError();
      }
      return data;
    } catch (error) {
      if (error instanceof IdentityChangedError) throw error;
      if (generation !== this.identityGeneration) {
        throw new IdentityChangedError();
      }
      throw error;
    }
  }

  private async refreshToken(generation: number): Promise<boolean> {
    if (this.refreshPromise) return this.refreshPromise;

    const refreshToken =
      typeof window !== "undefined"
        ? window.localStorage.getItem(REFRESH_TOKEN_KEY)
        : null;
    if (!refreshToken) {
      this.invalidateSession();
      return false;
    }

    const refreshPromise = this.performTokenRefresh(refreshToken, generation);
    this.refreshPromise = refreshPromise;
    try {
      return await refreshPromise;
    } finally {
      if (this.refreshPromise === refreshPromise) {
        this.refreshPromise = null;
      }
    }
  }

  private async performTokenRefresh(
    refreshToken: string,
    generation: number,
  ): Promise<boolean> {
    const response = await fetch(this.buildUrl("/auth/refresh"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refreshToken }),
      credentials: "include",
      signal: this.abortController.signal,
    });

    if (generation !== this.identityGeneration) {
      throw new IdentityChangedError();
    }
    if (response.status === 401 || response.status === 403) {
      this.invalidateSession();
      return false;
    }
    if (!response.ok) {
      throw await readApiError(response);
    }

    const tokens = (await response.json()) as {
      accessToken?: string;
      refreshToken?: string;
    };
    if (!tokens.accessToken || !tokens.refreshToken) {
      throw new ApiError("Token refresh returned an invalid response", 502);
    }
    if (generation !== this.identityGeneration) {
      throw new IdentityChangedError();
    }

    this.setToken(tokens.accessToken);
    window.localStorage.setItem(REFRESH_TOKEN_KEY, tokens.refreshToken);
    window.dispatchEvent(
      new CustomEvent("auth:access-token-refreshed", {
        detail: tokens,
      }),
    );
    return true;
  }

  private invalidateSession(): void {
    this.setToken(null);
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("auth:session-cleared"));
    }
  }
}

export const apiClient = new ApiClient();
