import { Injectable, NestMiddleware, Logger } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';

/**
 * Known API versions and their sunset dates.
 * When a version is deprecated, add a Sunset header date per RFC 8594.
 * VERSION_NEUTRAL endpoints (e.g. /health) are excluded.
 */
const API_VERSION_SUNSETS: Record<string, string | null> = {
  v1: null, // active, no sunset date
  // v2: null, // future -- uncomment when v2 launches
};

const CURRENT_VERSION = 'v1';
const VERSION_PATTERN = /^\/v(\d+)\b/;

/**
 * Middleware that:
 * 1. Rewrites unversioned API requests (/auth/*, /escrows/*, etc.) to /v1/...
 *    so legacy clients keep working during the migration window.
 * 2. Adds a Sunset response header for deprecated versions (RFC 8594).
 * 3. Adds an X-API-Version response header indicating the resolved version.
 * 4. Logs a warning when a deprecated or unversioned endpoint is hit.
 */
@Injectable()
export class ApiVersionMiddleware implements NestMiddleware {
  private readonly logger = new Logger('ApiVersionMiddleware');

  use(req: Request, res: Response, next: NextFunction): void {
    const originalUrl = req.originalUrl || req.url;
    const path = originalUrl.split('?')[0]; // strip query string

    // Skip non-API paths, static assets, swagger docs, and version-neutral routes
    if (
      path === '/' ||
      path.startsWith('/health') ||
      path.startsWith('/api/docs') ||
      path.startsWith('/socket.io') ||
      !this.isApiPath(path)
    ) {
      next();
      return;
    }

    // Already versioned -- check if the version is deprecated
    const versionMatch = path.match(VERSION_PATTERN);
    if (versionMatch) {
      const version = 'v' + versionMatch[1];
      const sunsetDate = API_VERSION_SUNSETS[version];

      res.setHeader('X-API-Version', version);

      if (sunsetDate) {
        res.setHeader('Sunset', sunsetDate);
        res.setHeader('Deprecation', 'true');
        this.logger.warn(
          'Deprecated API version ' +
            version +
            ' used: ' +
            req.method +
            ' ' +
            originalUrl,
        );
      }

      // Warn if the version is unknown (future-proofing)
      if (!(version in API_VERSION_SUNSETS) && version !== CURRENT_VERSION) {
        this.logger.warn(
          'Unknown API version requested: ' + req.method + ' ' + originalUrl,
        );
      }

      next();
      return;
    }

    // Unversioned request -- rewrite to current version
    const rewrittenPath = '/' + CURRENT_VERSION + path;
    const rewrittenUrl = originalUrl.replace(path, rewrittenPath);

    this.logger.warn(
      'Unversioned API request rewritten: ' +
        req.method +
        ' ' +
        originalUrl +
        ' -> ' +
        req.method +
        ' ' +
        rewrittenUrl,
    );

    // Rewrite the URL for NestJS routing
    req.url = rewrittenUrl;

    // Add backward-compatibility headers
    res.setHeader('X-API-Version', CURRENT_VERSION);
    res.setHeader('Sunset', '2026-12-31T23:59:59.000Z');
    res.setHeader(
      'Link',
      '</' + CURRENT_VERSION + path + '>; rel="successor-version"',
    );

    next();
  }

  /**
   * Determine if a path is an API path that should be versioned.
   * Excludes static files, swagger, websocket, etc.
   */
  private isApiPath(path: string): boolean {
    const apiPrefixes = [
      '/auth',
      '/escrows',
      '/admin',
      '/notifications',
      '/webhooks',
      '/api-keys',
      '/assets',
      '/ipfs',
      '/stellar',
      '/events',
      '/api/app',
    ];

    // Strip version prefix (e.g. /v1/auth -> /auth) before checking
    const strippedPath = path.replace(/^\/v\d+/, '');

    return apiPrefixes.some(
      (prefix) => path.startsWith(prefix) || strippedPath.startsWith(prefix),
    );
  }
}
