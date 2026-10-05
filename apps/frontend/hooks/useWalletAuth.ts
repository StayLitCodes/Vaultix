import { useState } from "react";
import { saveSession } from "@/lib/session";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000";
const API_VERSION_PREFIX = "/v1";

export interface WalletAuthState {
  loading: boolean;
  error: string | null;
  token: string | null;
}

/**
 * Implements challenge-response wallet authentication:
 * 1. Fetch a challenge message from the backend.
 * 2. Sign it with the connected wallet.
 * 3. Submit the signature to receive a JWT bound to that wallet.
 */
export const useWalletAuth = () => {
  const [state, setState] = useState<WalletAuthState>({
    loading: false,
    error: null,
    token: null,
  });

  const signIn = async (publicKey: string): Promise<boolean> => {
    setState({ loading: true, error: null, token: null });
    try {
      const challengeRes = await fetch(
        `${API_URL}${API_VERSION_PREFIX}/auth/challenge`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ walletAddress: publicKey }),
        },
      );
      if (!challengeRes.ok) throw new Error("Failed to fetch challenge");
      const { message } = await challengeRes.json();

      const { signedMessage } = await (window as any).freighter.signMessage(
        message,
        {
          address: publicKey,
        },
      );

      const verifyRes = await fetch(
        `${API_URL}${API_VERSION_PREFIX}/auth/verify`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            publicKey,
            signature: signedMessage,
          }),
        },
      );
      if (!verifyRes.ok) throw new Error("Authentication failed");
      const { accessToken, refreshToken } = await verifyRes.json();
      if (!accessToken || !refreshToken) {
        throw new Error("Authentication failed");
      }

      saveSession({
        accessToken,
        refreshToken,
        walletAddress: publicKey,
      });

      setState({ loading: false, error: null, token: accessToken });
      return true;
    } catch (err: any) {
      setState({
        loading: false,
        error: err.message ?? "Unknown error",
        token: null,
      });
      return false;
    }
  };

  return { ...state, signIn };
};
