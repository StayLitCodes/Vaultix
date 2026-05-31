import { useState } from 'react';

export interface WalletAuthState {
  loading: boolean;
  error: string | null;
  token: string | null;
}

/**
 * Implements challenge-response wallet authentication:
 * 1. Fetch a challenge message from the backend.
 * 2. Sign it with the connected wallet.
 * 3. Submit the signature to receive a JWT.
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
      // Step 1: get challenge
      const challengeRes = await fetch(`/api/auth/challenge?publicKey=${publicKey}`);
      if (!challengeRes.ok) throw new Error('Failed to fetch challenge');
      const { challenge } = await challengeRes.json();

      // Step 2: sign challenge with wallet
      const { signedMessage } = await (window as any).freighter.signMessage(challenge, {
        address: publicKey,
      });

      // Step 3: verify and get token
      const verifyRes = await fetch('/api/auth/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ publicKey, challenge, signature: signedMessage }),
      });
      if (!verifyRes.ok) throw new Error('Authentication failed');
      const { token } = await verifyRes.json();
      setState({ loading: false, error: null, token });
      return true;
    } catch (err: any) {
      setState({ loading: false, error: err.message ?? 'Unknown error', token: null });
      return false;
    }
  };

  return { ...state, signIn };
};