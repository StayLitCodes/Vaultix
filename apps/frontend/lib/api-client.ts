const getApiBaseUrl = (): string => {
  // Safely access process.env in Next.js (available at build time)
  try {
    if (typeof process !== "undefined" && process.env?.NEXT_PUBLIC_API_URL) {
      return process.env.NEXT_PUBLIC_API_URL;
    }
  } catch {
    // process is not available
  }
  return "http://localhost:3000";
};

const API_BASE_URL = getApiBaseUrl();

// API version prefix - all requests go through /v1/
const API_VERSION_PREFIX = "/v1";

export class IdentityChangedError extends Error {
  constructor() {
    super("Request cancelled due to wallet identity change");
    this.name = "IdentityChangedError";
  }
}

class ApiClient {
  private authToken: string | null = null;
  private identityGeneration = 0;
  private abortController = new AbortController();

  constructor() {
    // Load token from localStorage on init
    if (typeof window !== "undefined") {
      this.authToken = window.localStorage.getItem("vaultix_token");
    }
  }

  /** Abort in-flight protected requests (wallet switch / disconnect). */
  cancelPendingRequests(): void {
    this.abortController.abort();
    this.abortController = new AbortController();
    this.identityGeneration += 1;
  }

  applySessionToken(token: string | null) {
    this.authToken = token;
    if (typeof window === "undefined") return;

    if (token) {
      window.localStorage.setItem("vaultix_login_time", String(Date.now()));
      document.cookie = "vaultix_token=" + token + "; path=/; max-age=86400";
    } else {
      document.cookie =
        "vaultix_token=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT";
    }
  }

  setToken(token: string | null) {
    this.authToken = token;
    if (typeof window !== "undefined") {
      if (token) {
        window.localStorage.setItem("vaultix_token", token);
        window.localStorage.setItem("vaultix_login_time", String(Date.now()));
        document.cookie = "vaultix_token=" + token + "; path=/; max-age=86400";
      } else {
        window.localStorage.removeItem("vaultix_token");
        window.localStorage.removeItem("vaultix_refresh_token");
        window.localStorage.removeItem("vaultix_login_time");
        document.cookie =
          "vaultix_token=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT";
      }
    }
  }

  getToken(): string | null {
    return this.authToken;
  }

  private async request<T>(
    path: string,
    options: RequestInit = {},
    retryCount = 0,
  ): Promise<T> {
    const url = `${API_BASE_URL}${API_VERSION_PREFIX}${path}`;
    const generation = this.identityGeneration;
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      ...(this.authToken ? { Authorization: `Bearer ${this.authToken}` } : {}),
      ...(options.headers as Record<string, string>),
    };

    try {
      const response = await fetch(url, {
        ...options,
        headers,
        credentials: "include",
        signal: options.signal ?? this.abortController.signal,
      });

      if (generation !== this.identityGeneration) {
        throw new IdentityChangedError();
      }

      if (!response.ok) {
        // Handle 401 - token expired, try to refresh
        if (response.status === 401 && retryCount === 0) {
          const refreshed = await this.refreshToken();
          if (refreshed) {
            return this.request<T>(path, options, retryCount + 1);
          }
        }

        const error = await response
          .json()
          .catch(() => ({ message: "Request failed" }));
        throw new Error(error.message || `HTTP ${response.status}`);
      }

      if (response.status === 204) {
        return undefined as T;
      }

      return (await response.json()) as T;
    } catch (error) {
      if (error instanceof IdentityChangedError) {
        throw error;
      }
      if (error instanceof DOMException && error.name === "AbortError") {
        throw new IdentityChangedError();
      }
      console.error(`API request failed: ${path}`, error);
      throw error;
    }
  }

  async get<T>(path: string): Promise<T> {
    return this.request<T>(path, { method: "GET" });
  }

  async post<T>(path: string, body?: any): Promise<T> {
    return this.request<T>(path, {
      method: "POST",
      body: body ? JSON.stringify(body) : undefined,
    });
  }

  async patch<T>(path: string, body?: any): Promise<T> {
    return this.request<T>(path, {
      method: "PATCH",
      body: body ? JSON.stringify(body) : undefined,
    });
  }

  async put<T>(path: string, body?: any): Promise<T> {
    return this.request<T>(path, {
      method: "PUT",
      body: body ? JSON.stringify(body) : undefined,
    });
  }

  async delete<T>(path: string): Promise<T> {
    return this.request<T>(path, { method: "DELETE" });
  }

  private async refreshToken(): Promise<boolean> {
    try {
      const refreshToken =
        typeof window !== "undefined"
          ? window.localStorage.getItem("vaultix_refresh_token")
          : null;

      if (!refreshToken) {
        this.setToken(null);
        return false;
      }

      const response = await this.post<{ accessToken: string }>(
        "/auth/refresh",
        { refreshToken },
      );

      this.setToken(response.accessToken);
      if (typeof window !== "undefined") {
        window.dispatchEvent(
          new CustomEvent("auth:access-token-refreshed", {
            detail: { accessToken: response.accessToken },
          }),
        );
      }
      console.log("Token refreshed successfully");
      return true;
    } catch (error) {
      console.error("Token refresh failed", error);
      this.setToken(null);
      if (typeof window !== "undefined") {
        window.localStorage.removeItem("vaultix_refresh_token");
      }
      return false;
    }
  }
}

// Export singleton instance
export const apiClient = new ApiClient();
