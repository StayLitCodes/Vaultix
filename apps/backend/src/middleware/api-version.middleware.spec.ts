import { ApiVersionMiddleware } from './api-version.middleware';
import { Request, Response } from 'express';

describe('ApiVersionMiddleware', () => {
  let middleware: ApiVersionMiddleware;
  let mockReq: Partial<Request>;
  let mockRes: Partial<Response>;
  let nextFn: jest.Mock;
  let headers: Record<string, string>;

  beforeEach(() => {
    middleware = new ApiVersionMiddleware();
    headers = {};

    mockReq = {
      originalUrl: '',
      url: '',
      method: 'GET',
    };

    mockRes = {
      setHeader: jest.fn((key: string, value: string) => {
        headers[key] = value;
        return mockRes as Response;
      }),
    };

    nextFn = jest.fn();
  });

  describe('unversioned API requests', () => {
    it('should rewrite /auth/refresh to /v1/auth/refresh', () => {
      mockReq.originalUrl = '/auth/refresh';
      middleware.use(mockReq as Request, mockRes as Response, nextFn);

      expect(mockReq.url).toBe('/v1/auth/refresh');
      expect(headers['X-API-Version']).toBe('v1');
      expect(headers['Sunset']).toBeDefined();
      expect(headers['Link']).toContain('/v1/auth/refresh');
      expect(headers['Link']).toContain('successor-version');
      expect(nextFn).toHaveBeenCalled();
    });

    it('should rewrite /escrows to /v1/escrows', () => {
      mockReq.originalUrl = '/escrows';
      middleware.use(mockReq as Request, mockRes as Response, nextFn);

      expect(mockReq.url).toBe('/v1/escrows');
      expect(headers['X-API-Version']).toBe('v1');
      expect(headers['Sunset']).toBeDefined();
      expect(nextFn).toHaveBeenCalled();
    });

    it('should rewrite /admin/users to /v1/admin/users', () => {
      mockReq.originalUrl = '/admin/users';
      middleware.use(mockReq as Request, mockRes as Response, nextFn);

      expect(mockReq.url).toBe('/v1/admin/users');
      expect(nextFn).toHaveBeenCalled();
    });

    it('should rewrite /notifications to /v1/notifications', () => {
      mockReq.originalUrl = '/notifications';
      middleware.use(mockReq as Request, mockRes as Response, nextFn);

      expect(mockReq.url).toBe('/v1/notifications');
      expect(nextFn).toHaveBeenCalled();
    });

    it('should rewrite /webhooks to /v1/webhooks', () => {
      mockReq.originalUrl = '/webhooks';
      middleware.use(mockReq as Request, mockRes as Response, nextFn);

      expect(mockReq.url).toBe('/v1/webhooks');
      expect(nextFn).toHaveBeenCalled();
    });

    it('should rewrite /api-keys to /v1/api-keys', () => {
      mockReq.originalUrl = '/api-keys';
      middleware.use(mockReq as Request, mockRes as Response, nextFn);

      expect(mockReq.url).toBe('/v1/api-keys');
      expect(nextFn).toHaveBeenCalled();
    });

    it('should preserve query string when rewriting', () => {
      mockReq.originalUrl = '/escrows?page=1&limit=10';
      middleware.use(mockReq as Request, mockRes as Response, nextFn);

      expect(mockReq.url).toBe('/v1/escrows?page=1&limit=10');
      expect(nextFn).toHaveBeenCalled();
    });
  });

  describe('versioned API requests', () => {
    it('should pass through /v1/auth/refresh without rewriting', () => {
      mockReq.originalUrl = '/v1/auth/refresh';
      middleware.use(mockReq as Request, mockRes as Response, nextFn);

      // URL should not be changed
      expect(mockReq.url).toBe('');
      expect(headers['X-API-Version']).toBe('v1');
      // v1 is active, no Sunset header
      expect(headers['Sunset']).toBeUndefined();
      expect(nextFn).toHaveBeenCalled();
    });

    it('should set X-API-Version for v2 requests', () => {
      mockReq.originalUrl = '/v2/escrows';
      middleware.use(mockReq as Request, mockRes as Response, nextFn);

      expect(headers['X-API-Version']).toBe('v2');
      expect(nextFn).toHaveBeenCalled();
    });
  });

  describe('non-API paths', () => {
    it('should skip root path /', () => {
      mockReq.originalUrl = '/';
      middleware.use(mockReq as Request, mockRes as Response, nextFn);

      expect(mockReq.url).toBe('');
      expect(Object.keys(headers).length).toBe(0);
      expect(nextFn).toHaveBeenCalled();
    });

    it('should skip /health paths', () => {
      mockReq.originalUrl = '/health';
      middleware.use(mockReq as Request, mockRes as Response, nextFn);

      expect(mockReq.url).toBe('');
      expect(Object.keys(headers).length).toBe(0);
      expect(nextFn).toHaveBeenCalled();
    });

    it('should skip /health/live paths', () => {
      mockReq.originalUrl = '/health/live';
      middleware.use(mockReq as Request, mockRes as Response, nextFn);

      expect(mockReq.url).toBe('');
      expect(nextFn).toHaveBeenCalled();
    });

    it('should skip /api/docs paths', () => {
      mockReq.originalUrl = '/api/docs';
      middleware.use(mockReq as Request, mockRes as Response, nextFn);

      expect(mockReq.url).toBe('');
      expect(nextFn).toHaveBeenCalled();
    });

    it('should skip /socket.io paths', () => {
      mockReq.originalUrl = '/socket.io/test';
      middleware.use(mockReq as Request, mockRes as Response, nextFn);

      expect(mockReq.url).toBe('');
      expect(nextFn).toHaveBeenCalled();
    });

    it('should skip unknown non-API paths', () => {
      mockReq.originalUrl = '/favicon.ico';
      middleware.use(mockReq as Request, mockRes as Response, nextFn);

      expect(mockReq.url).toBe('');
      expect(nextFn).toHaveBeenCalled();
    });
  });

  describe('Sunset header on unversioned requests', () => {
    it('should include a valid ISO 8601 date in the Sunset header', () => {
      mockReq.originalUrl = '/escrows';
      middleware.use(mockReq as Request, mockRes as Response, nextFn);

      const sunset = headers['Sunset'];
      expect(sunset).toBeDefined();
      // Should be a valid date
      expect(new Date(sunset).toISOString()).toBe(sunset);
    });
  });
});
