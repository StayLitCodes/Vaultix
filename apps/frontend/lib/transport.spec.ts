// frontend/src/lib/api/__tests__/transport.spec.ts
import { api } from '../transport';
import axios from 'axios';

jest.mock('axios');
const mockedAxios = axios as jest.mocked<typeof axios>;

describe('ApiTransport (Unified Frontend Transport)', () => {
    let mockAxiosInstance: any;

    beforeEach(() => {
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
        process.env.NEXT_PUBLIC_API_BASE_URL = 'https://api.vaultix.io/v1/';
        // Re-instantiate or verify baseURL configuration logic
        expect(mockedAxios.create).toHaveBeenCalledWith(
            expect.objectContaining({
                baseURL: 'https://api.vaultix.io/v1',
            })
        );
    });

    it('should return null on 204 No Content responses', async () => {
        const responseInterceptor = mockAxiosInstance.interceptors.response.use.mock.calls[0][0];
        const res204 = { status: 204, data: '' };
        const result = responseInterceptor(res204);
        expect(result).toBeNull();
    });
});