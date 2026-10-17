import { ApiError, apiClient, IdentityChangedError } from "./api-client";

const jsonResponse = (data: unknown, status = 200): Response =>
  new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });

describe("apiClient", () => {
  beforeEach(() => {
    apiClient.cancelPendingRequests();
    apiClient.setToken(null);
    localStorage.clear();
    jest.restoreAllMocks();
  });

  it("attaches the current bearer token and serializes JSON requests", async () => {
    apiClient.setToken("access-token");
    const fetchMock = jest
      .spyOn(global, "fetch")
      .mockResolvedValue(jsonResponse({ saved: true }));

    await apiClient.post("/profile", { displayName: "Ada" });

    expect(String(fetchMock.mock.calls[0][0])).toMatch(/\/v1\/profile$/);
    expect(fetchMock.mock.calls[0][1]).toEqual(
      expect.objectContaining({
        method: "POST",
        credentials: "include",
        headers: expect.any(Headers),
        body: JSON.stringify({ displayName: "Ada" }),
      }),
    );
    const headers = fetchMock.mock.calls[0][1]?.headers as Headers;
    expect(headers.get("Authorization")).toBe("Bearer access-token");
    expect(headers.get("Content-Type")).toBe("application/json");
  });

  it("does not set a multipart content type when uploading FormData", async () => {
    const formData = new FormData();
    formData.append("file", new Blob(["evidence"]), "evidence.txt");
    const fetchMock = jest
      .spyOn(global, "fetch")
      .mockResolvedValue(jsonResponse({ cid: "cid" }));

    await apiClient.post("/escrows/1/evidence", formData);

    const request = fetchMock.mock.calls[0][1];
    expect(request?.body).toBe(formData);
    expect(new Headers(request?.headers).has("Content-Type")).toBe(false);
  });

  it("normalizes server error messages and status for React Query consumers", async () => {
    jest
      .spyOn(global, "fetch")
      .mockResolvedValue(jsonResponse({ message: ["Invalid", "expired"] }, 401));

    await expect(apiClient.get("/private")).rejects.toMatchObject({
      name: "ApiError",
      message: "Invalid, expired",
      status: 401,
    });
  });

  it("returns undefined for no-content responses", async () => {
    jest
      .spyOn(global, "fetch")
      .mockResolvedValue(new Response(null, { status: 204 }));

    await expect(apiClient.delete("/resource")).resolves.toBeUndefined();
  });

  it("refreshes once for concurrent 401 responses and retries both requests", async () => {
    apiClient.setToken("expired-access-token");
    localStorage.setItem("vaultix_refresh_token", "refresh-token");
    const fetchMock = jest
      .spyOn(global, "fetch")
      .mockImplementation(async (input, init) => {
        const url = String(input);
        if (url.endsWith("/auth/refresh")) {
          return jsonResponse({
            accessToken: "new-access-token",
            refreshToken: "new-refresh-token",
          });
        }

        const authorization = new Headers(init?.headers).get("Authorization");
        if (authorization === "Bearer expired-access-token") {
          return jsonResponse({ message: "Token expired" }, 401);
        }
        return jsonResponse({ url });
      });

    const [first, second] = await Promise.all([
      apiClient.get<{ url: string }>("/first"),
      apiClient.get<{ url: string }>("/second"),
    ]);

    expect(first.url).toContain("/first");
    expect(second.url).toContain("/second");
    expect(
      fetchMock.mock.calls.filter(([url]) => String(url).endsWith("/auth/refresh")),
    ).toHaveLength(1);
    expect(apiClient.getToken()).toBe("new-access-token");
    expect(localStorage.getItem("vaultix_refresh_token")).toBe("new-refresh-token");
  });

  it("does not refresh a request when no access token is present", async () => {
    const fetchMock = jest
      .spyOn(global, "fetch")
      .mockResolvedValue(jsonResponse({ message: "Unauthorized" }, 401));

    await expect(apiClient.get("/private")).rejects.toBeInstanceOf(ApiError);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("rejects in-flight requests when wallet identity changes", async () => {
    jest.spyOn(global, "fetch").mockImplementation(
      (_input, init) =>
        new Promise((_, reject) => {
          init?.signal?.addEventListener("abort", () => {
            reject(new DOMException("Aborted", "AbortError"));
          });
        }),
    );
    const pending = apiClient.get("/private");

    apiClient.cancelPendingRequests();

    await expect(pending).rejects.toBeInstanceOf(IdentityChangedError);
  });
});
