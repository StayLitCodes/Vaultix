// frontend/src/hooks/useWalletAuth.ts
import { useState, useCallback } from 'react';
import { api } from '../lib/api/transport';

export interface ChallengeResponse {
    success: boolean;
    data: {
        nonce: string;
        message: string;
    };
}

export interface VerifyResponse {
    success: boolean;
    data: {
        accessToken: string;
        refreshToken: string;
        user: {
            id: string;
            walletAddress: string;
        };
    };
}

export function useWalletAuth() {
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const authenticateWithWallet = useCallback(async (walletAddress: string, signMessageFn: (message: string) => Promise<string>) => {
        setIsLoading(true);
        setError(null);

        try {
            // 1. Request challenge from backend POST /auth/challenge
            const challengeRes = await api.post<ChallengeResponse>('/auth/challenge', { walletAddress });
            const { message } = challengeRes.data;

            // 2. Sign exact message through supported wallet adapter
            const rawSignature = await signMessageFn(message);
            
            // Normalize signature encoding explicitly (ensure hex/base64 format expected by backend)
            const signature = rawSignature.startsWith('0x') ? rawSignature : `0x${rawSignature}`;

            // 3. Verify signature and exchange for tokens POST /auth/verify
            const verifyRes = await api.post<VerifyResponse>('/auth/verify', {
                walletAddress,
                signature,
                message,
            });

            const { accessToken, refreshToken } = verifyRes.data;

            // 4. Persist both returned tokens through shared session layer atomically
            if (typeof window !== 'undefined') {
                localStorage.setItem('vaultix_auth_token', accessToken);
                localStorage.setItem('vaultix_refresh_token', refreshToken);
            }

            setIsLoading(false);
            return true;
        } catch (err: any) {
            // Handle rejection without partial authenticated state: clear any stale tokens
            if (typeof window !== 'undefined') {
                localStorage.removeItem('vaultix_auth_token');
                localStorage.removeItem('vaultix_refresh_token');
            }
            setError(err?.error?.message || 'Wallet authentication failed.');
            setIsLoading(false);
            throw err;
        }
    }, []);

    return {
        authenticateWithWallet,
        isLoading,
        error,
    };
}