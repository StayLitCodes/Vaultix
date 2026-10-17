import {
  __resetSessionForTests,
  clearSession,
  getSession,
  hydrateSession,
  isAuthenticatedForWallet,
  saveSession,
} from "./session";
import { apiClient } from "./api-client";

const WALLET_A =
  "GD5DJQDZYKGHIHYLF4IR5J6DZLZBW5QQHXK5RWSLTZ5FT5ZJPQK5LW5D";
const WALLET_B =
  "GBRPYHIL2CI3FNQ4BXLFMNDLFJUNPU2HY3ZMFSHONUCEOASW7QC7OX2H";

function fakeJwt(walletAddress: string): string {
  const header = btoa(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const payload = btoa(JSON.stringify({ sub: "user-1", walletAddress }));
  return `${header}.${payload}.signature`;
}

describe("session", () => {
  beforeEach(() => {
    __resetSessionForTests();
    localStorage.clear();
    jest.spyOn(apiClient, "cancelPendingRequests").mockImplementation(() => {});
    jest.spyOn(apiClient, "applySessionToken").mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("binds saved session to the wallet that signed in", () => {
    const accessToken = fakeJwt(WALLET_A);
    saveSession({
      accessToken,
      refreshToken: "refresh-a",
      walletAddress: WALLET_A,
    });

    expect(getSession()?.walletAddress).toBe(WALLET_A);
    expect(isAuthenticatedForWallet(WALLET_A)).toBe(true);
    expect(isAuthenticatedForWallet(WALLET_B)).toBe(false);
  });

  it("hydrates session wallet from JWT when legacy storage lacks address", () => {
    const accessToken = fakeJwt(WALLET_A);
    localStorage.setItem("vaultix_token", accessToken);
    localStorage.setItem("vaultix_refresh_token", "refresh-a");

    const session = hydrateSession();

    expect(session?.walletAddress).toBe(WALLET_A);
    expect(localStorage.getItem("vaultix_session_wallet")).toBe(WALLET_A);
  });

  it("clears session and cancels pending API work", () => {
    saveSession({
      accessToken: fakeJwt(WALLET_A),
      refreshToken: "refresh-a",
      walletAddress: WALLET_A,
    });

    clearSession();

    expect(getSession()).toBeNull();
    expect(localStorage.getItem("vaultix_token")).toBeNull();
    expect(apiClient.cancelPendingRequests).toHaveBeenCalled();
  });

  it("keeps rotated access and refresh tokens in the session", () => {
    saveSession({
      accessToken: fakeJwt(WALLET_A),
      refreshToken: "refresh-a",
      walletAddress: WALLET_A,
    });

    window.dispatchEvent(
      new CustomEvent("auth:access-token-refreshed", {
        detail: {
          accessToken: "rotated-access",
          refreshToken: "rotated-refresh",
        },
      }),
    );

    expect(getSession()).toEqual({
      accessToken: "rotated-access",
      refreshToken: "rotated-refresh",
      walletAddress: WALLET_A,
    });
    expect(localStorage.getItem("vaultix_refresh_token")).toBe("rotated-refresh");
  });

  it("clears the in-memory session when refresh invalidates authentication", () => {
    saveSession({
      accessToken: fakeJwt(WALLET_A),
      refreshToken: "refresh-a",
      walletAddress: WALLET_A,
    });

    window.dispatchEvent(new CustomEvent("auth:session-cleared"));

    expect(getSession()).toBeNull();
    expect(localStorage.getItem("vaultix_session_wallet")).toBeNull();
  });
});
