// frontend/src/hooks/useWalletAuth.ts
import { useState, useCallback } from 'react';
import { api } from '../lib/api/transport';

export interface ChallengeRequestDto {
    walletAddress: string;
}

export interface ChallengeResponseDto {
    success: boolean;
    data: {
        nonce: string;
        message: string;
    };
}

export interface VerifyRequestDto {
    walletAddress: string;
    signature: string;
    message: string;
}

export interface VerifyResponseDto {
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

    const authenticateWithWallet = useCallback(
        async (walletAddress: string, signMessageFn: (message: string) => Promise<string>) => {
            setIsLoading(true);
            setError(null);

            try {
                // 1. Request challenge using POST DTO with walletAddress
                const challengeRes = await api.post<ChallengeResponseDto>('/auth/challenge', {
                    walletAddress,
                } as ChallengeRequestDto);

                const { message } = challengeRes.data;

                // 2. Sign exact returned message through supported wallet adapter
                const rawSignature = await signMessageFn(message);

                // Normalize signature encoding explicitly (ensure 0x hex prefix format)
                const signature = rawSignature.startsWith('0x') ? rawSignature : `0x${rawSignature}`;

                // 3. Verify signature and exchange for access and refresh tokens
                const verifyRes = await api.post<VerifyResponseDto>('/auth/verify', {
                    walletAddress,
                    signature,
                    message,
                } as VerifyRequestDto);

                const { accessToken, refreshToken } = verifyRes.data;

                // 4. Persist both returned tokens through the shared session layer atomically
                if (typeof window !== 'undefined') {
                    localStorage.setItem('vaultix_auth_token', accessToken);
                    localStorage.setItem('vaultix_refresh_token', refreshToken);
                }

                setIsLoading(false);
                return true;
            } catch (err: any) {
                // Handle rejection without leaving a partial authenticated state: wipe all tokens
                if (typeof window !== 'undefined') {
                    localStorage.removeItem('vaultix_auth_token');
                    localStorage.removeItem('vaultix_refresh_token');
                }
                setError(err?.error?.message || 'Wallet authentication failed.');
                setIsLoading(false);
                throw err;
            }
        },
        []
    );

    return {
        authenticateWithWallet,
        isLoading,
        error,
    };
}