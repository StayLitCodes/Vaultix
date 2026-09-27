export function decodeAccessTokenPayload(
  token: string,
): Record<string, unknown> | null {
  try {
    const payload = token.split(".")[1];
    if (!payload) return null;
    const base64 = payload.replace(/-/g, "+").replace(/_/g, "/");
    const decoded = atob(base64);
    return JSON.parse(decoded) as Record<string, unknown>;
  } catch {
    return null;
  }
}

export function walletAddressFromAccessToken(token: string): string | null {
  const payload = decodeAccessTokenPayload(token);
  const address = payload?.walletAddress;
  return typeof address === "string" ? address : null;
}
