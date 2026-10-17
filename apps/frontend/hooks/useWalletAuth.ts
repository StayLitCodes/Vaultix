import { useState } from "react";
import { saveSession } from "@/lib/session";
import { apiClient } from "@/lib/api-client";

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
      const { message } = await apiClient.post<{ message: string }>(
        "/auth/challenge",
        { walletAddress: publicKey },
      );

      const { signedMessage } = await (window as any).freighter.signMessage(
        message,
        {
          address: publicKey,
        },
      );

      const { accessToken, refreshToken } = await apiClient.post<{
        accessToken: string;
        refreshToken: string;
      }>("/auth/verify", {
        publicKey,
        signature: signedMessage,
      });
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
    } catch (err: unknown) {
      setState({
        loading: false,
        error: err instanceof Error ? err.message : "Unknown error",
        token: null,
      });
      return false;
    }
  };

  return { ...state, signIn };
};
