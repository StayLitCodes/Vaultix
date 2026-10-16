// frontend/src/lib/api/__tests__/transport-refresh.spec.ts
import { api } from '../transport';
import axios from 'axios';

jest.mock('axios');
const mockedAxios = axios as jest.mocked<typeof axios>;

describe('ApiTransport Token Refresh & Rotation (#648)', () => {
    let mockClient: any;
    let mockRefreshClient: any;

    beforeEach(() => {
        jest.clearAllMocks();
        localStorage.clear();

        mockClient = {
            interceptors: { request: { use: jest.fn() }, response: { use: jest.fn() } },
            get: jest.fn(),
            post: jest.fn(),
        };
        mockRefreshClient = {
            post: jest.fn(),
        };

        mockedAxios.create
            .mockReturnValueOnce(mockClient)
            .mockReturnValueOnce(mockRefreshClient);
    });

    it('should persist rotated refresh tokens and share in-flight refresh promise across concurrent 401s', async () => {
        const responseInterceptor = mockClient.interceptors.response.use.mock.calls[0][1];

        // Setup initial tokens
        localStorage.setItem('vaultix_auth_token', 'old-access');
        localStorage.setItem('vaultix_refresh_token', 'old-refresh');

        // Mock refresh endpoint returning rotated tokens
        mockRefreshClient.post.mockResolvedValueOnce({
            data: {
                success: true,
                data: {
                    accessToken: 'new-access',
                    refreshToken: 'new-rotated-refresh',
                },
            },
        });

        const error401 = {
            response: { status: 401 },
            config: { headers: {} },
        };

        // Simulate request failure triggering refresh
        mockClient.mockResolvedValueOnce('success-after-retry');

        const promise1 = responseInterceptor(error401);
        const promise2 = responseInterceptor(error401);

        const [res1, res2] = await Promise.all([promise1, promise2]);

        // Verify refresh client was called exactly once due to shared in-flight promise
        expect(mockRefreshClient.post).toHaveBeenCalledTimes(1);
        expect(localStorage.getItem('vaultix_auth_token')).toBe('new-access');
        expect(localStorage.getItem('vaultix_refresh_token')).toBe('new-rotated-refresh');
        expect(res1).toBe('success-after-retry');
        expect(res2).toBe('success-after-retry');
    });

    it('should clear session and terminate retries if refresh endpoint returns 401', async () => {
        const responseInterceptor = mockClient.interceptors.response.use.mock.calls[0][1];

        localStorage.setItem('vaultix_auth_token', 'stale-access');
        localStorage.setItem('vaultix_refresh_token', 'expired-refresh');

        mockRefreshClient.post.mockRejectedValueOnce({
            response: { status: 401 },
        });

        const error401 = {
            response: { status: 401 },
            config: { headers: {} },
        };

        await expect(responseInterceptor(error401)).rejects.toBeDefined();

        expect(localStorage.getItem('vaultix_auth_token')).toBeNull();
        expect(localStorage.getItem('vaultix_refresh_token')).toBeNull();
    });
});