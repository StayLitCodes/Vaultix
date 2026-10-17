import { ApiError, apiClient } from './api-client';

describe('apiClient errors', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('preserves status and code from a backend error response', async () => {
    jest.spyOn(global, 'fetch').mockResolvedValue({
      ok: false,
      status: 429,
      json: async () => ({
        statusCode: 429,
        code: 'RATE_LIMIT_EXCEEDED',
        message: 'Rate limit exceeded',
      }),
    } as Response);

    await expect(apiClient.get('/test')).rejects.toMatchObject({
      name: 'ApiError',
      status: 429,
      code: 'RATE_LIMIT_EXCEEDED',
    } satisfies Partial<ApiError>);
  });
});