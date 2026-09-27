// frontend/src/hooks/__tests__/useWalletAuth.spec.ts
import { renderHook, act } from '@testing-library/react';
import { useWalletAuth } from '../useWalletAuth';
import { api } from '../../lib/api/transport';

jest.mock('../../lib/api/transport', () => ({
    api: {
        post: jest.fn(),
    },
}));

describe('useWalletAuth (Challenge & Verify Alignment)', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        localStorage.clear();
    });

    it('should successfully challenge, sign, verify, and store tokens atomically', async () => {
        const mockPost = api.post as jest.Mock;
        mockPost.mockResolvedValueOnce({
            success: true,
            data: { nonce: 'nonce-123', message: 'Sign this challenge message' },
        });
        mockPost.mockResolvedValueOnce({
            success: true,
            data: {
                accessToken: 'access-jwt-token',
                refreshToken: 'refresh-jwt-token',
                user: { id: 'usr_1', walletAddress: '0x123...' },
            },
        });

        const mockSignFn = jest.fn().mockResolvedValue('0xsignaturehash');

        const { result } = renderHook(() => useWalletAuth());

        let success;
        await act(async () => {
            success = await result.current.authenticateWithWallet('0x123...', mockSignFn);
        });

        expect(success).toBe(true);
        expect(mockSignFn).toHaveBeenCalledWith('Sign this challenge message');
        expect(localStorage.getItem('vaultix_auth_token')).toBe('access-jwt-token');
        expect(localStorage.getItem('vaultix_refresh_token')).toBe('refresh-jwt-token');
    });

    it('should clear tokens and prevent partial authenticated state on rejection', async () => {
        const mockPost = api.post as jest.Mock;
        mockPost.mockRejectedValueOnce({
            success: false,
            error: { code: 'INVALID_SIGNATURE', message: 'Signature verification failed' },
        });

        localStorage.setItem('vaultix_auth_token', 'stale-token');

        const { result } = renderHook(() => useWalletAuth());

        let error;
        await act(async () => {
            try {
                await result.current.authenticateWithWallet('0x123...', jest.fn().mockResolvedValue('0xsig'));
            } catch (e) {
                error = e;
            }
        });

        expect(error).toBeDefined();
        expect(localStorage.getItem('vaultix_auth_token')).toBeNull();
        expect(localStorage.getItem('vaultix_refresh_token')).toBeNull();
    });
});