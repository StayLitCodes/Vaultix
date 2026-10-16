// frontend/src/hooks/__tests__/useWalletAuth.spec.ts
import { renderHook, act } from '@testing-library/react';
import { useWalletAuth } from '../useWalletAuth';
import { api } from '../../lib/api/transport';

jest.mock('../../lib/api/transport', () => ({
    api: {
        post: jest.fn(),
    },
}));

describe('useWalletAuth (Challenge & Verify API Alignment - #647)', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        localStorage.clear();
    });

    it('should invoke POST /auth/challenge, sign exact message, POST /auth/verify, and store both tokens', async () => {
        const mockPost = api.post as jest.Mock;
        
        // Mock POST /auth/challenge response
        mockPost.mockResolvedValueOnce({
            success: true,
            data: { nonce: 'nonce-789', message: 'Vaultix Auth Challenge: Please sign this nonce.' },
        });

        // Mock POST /auth/verify response
        mockPost.mockResolvedValueOnce({
            success: true,
            data: {
                accessToken: 'access-jwt-token-123',
                refreshToken: 'refresh-jwt-token-456',
                user: { id: 'usr_1', walletAddress: '0xABC123' },
            },
        });

        const mockSignMessage = jest.fn().mockResolvedValue('signature_hash_raw');

        const { result } = renderHook(() => useWalletAuth());

        let success;
        await act(async () => {
            success = await result.current.authenticateWithWallet('0xABC123', mockSignMessage);
        });

        expect(success).toBe(true);
        expect(mockPost).toHaveBeenCalledWith('/auth/challenge', { walletAddress: '0xABC123' });
        expect(mockSignMessage).toHaveBeenCalledWith('Vaultix Auth Challenge: Please sign this nonce.');
        expect(mockPost).toHaveBeenCalledWith('/auth/verify', {
            walletAddress: '0xABC123',
            signature: '0xsignature_hash_raw',
            message: 'Vaultix Auth Challenge: Please sign this nonce.',
        });

        expect(localStorage.getItem('vaultix_auth_token')).toBe('access-jwt-token-123');
        expect(localStorage.getItem('vaultix_refresh_token')).toBe('refresh-jwt-token-456');
    });

    it('should handle user signature denial or invalid signature without partial authenticated state', async () => {
        const mockPost = api.post as jest.Mock;
        mockPost.mockResolvedValueOnce({
            success: true,
            data: { nonce: 'nonce-789', message: 'Challenge message' },
        });

        // Simulate signature rejection by wallet adapter or backend verify failure
        const mockSignMessage = jest.fn().mockRejectedValue(new Error('User rejected signature request'));

        localStorage.setItem('vaultix_auth_token', 'stale-access');
        localStorage.setItem('vaultix_refresh_token', 'stale-refresh');

        const { result } = renderHook(() => useWalletAuth());

        let error;
        await act(async () => {
            try {
                await result.current.authenticateWithWallet('0xABC123', mockSignMessage);
            } catch (e) {
                error = e;
            }
        });

        expect(error).toBeDefined();
        // Ensure no partial state remains and stale tokens are completely wiped
        expect(localStorage.getItem('vaultix_auth_token')).toBeNull();
        expect(localStorage.getItem('vaultix_refresh_token')).toBeNull();
    });
});