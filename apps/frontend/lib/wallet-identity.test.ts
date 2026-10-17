import { QueryClient } from "@tanstack/react-query";
import { resetIdentityState } from "./wallet-identity";
import { saveSession, getSession, __resetSessionForTests } from "./session";
import { apiClient, IdentityChangedError } from "./api-client";

const WALLET_A =
  "GD5DJQDZYKGHIHYLF4IR5J6DZLZBW5QQHXK5RWSLTZ5FT5ZJPQK5LW5D";

function fakeJwt(walletAddress: string): string {
  const header = btoa(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const payload = btoa(JSON.stringify({ sub: "user-1", walletAddress }));
  return `${header}.${payload}.signature`;
}

describe("resetIdentityState", () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    __resetSessionForTests();
    localStorage.clear();
    queryClient = new QueryClient();
    queryClient.setQueryData(["escrows"], [{ id: "stale" }]);
    saveSession({
      accessToken: fakeJwt(WALLET_A),
      refreshToken: "refresh-a",
      walletAddress: WALLET_A,
    });
  });

  it("clears session and react-query cache on wallet switch", () => {
    resetIdentityState(queryClient);

    expect(getSession()).toBeNull();
    expect(queryClient.getQueryData(["escrows"])).toBeUndefined();
  });

  it("cancels in-flight protected API requests", async () => {
    const abortError = new DOMException("Aborted", "AbortError");
    const fetchMock = jest
      .spyOn(global, "fetch")
      .mockRejectedValue(abortError);

    saveSession({
      accessToken: fakeJwt(WALLET_A),
      refreshToken: "refresh-a",
      walletAddress: WALLET_A,
    });
    apiClient.applySessionToken(fakeJwt(WALLET_A));

    const pending = apiClient.get("/escrows").catch((err) => err);
    resetIdentityState(queryClient);

    const result = await pending;
    expect(result).toBeInstanceOf(IdentityChangedError);
    fetchMock.mockRestore();
  });
});
