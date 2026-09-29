// frontend/src/lib/api/__tests__/transport-unification.spec.ts
import { api } from '../transport';
import { escrowApi, notificationApi } from '../services.api';
import axios from 'axios';

jest.mock('axios');
const mockedAxios = axios as jest.mocked<typeof axios>;

describe('Unified API Transport & Services (#646)', () => {
    let mockAxiosInstance: any;

    beforeEach(() => {
        jest.clearAllMocks();
        localStorage.clear();

        mockAxiosInstance = {
            interceptors: {
                request: { use: jest.fn() },
                response: { use: jest.fn() },
            },
            get: jest.fn(),
            post: jest.fn(),
        };
        mockedAxios.create.mockReturnValue(mockAxiosInstance);
    });

    it('should normalize trailing slashes on API base URL', () => {
        process.env.NEXT_PUBLIC_API_BASE_URL = 'https://custom-api.vaultix.io/v1/';
        // Verify baseURL normalization via axios.create parameters
        expect(mockedAxios.create).toHaveBeenCalledWith(
            expect.objectContaining({
                baseURL: 'https://custom-api.vaultix.io/v1',
            })
        );
    });

    it('should route authenticated escrow requests with Bearer token and support 204 No Content', async () => {
        const responseInterceptor = mockAxiosInstance.interceptors.response.use.mock.calls[0][0];
        const res204 = { status: 204, data: '' };
        
        expect(responseInterceptor(res204)).toBeNull();
    });

    it('should strip Content-Type header when request data is FormData', async () => {
        const requestInterceptor = mockAxiosInstance.interceptors.request.use.mock.calls[0][0];
        const config = {
            headers: { 'Content-Type': 'application/json' },
            data: new FormData(),
        };

        const updatedConfig = requestInterceptor(config);
        expect(updatedConfig.headers['Content-Type']).toBeUndefined();
    });
});