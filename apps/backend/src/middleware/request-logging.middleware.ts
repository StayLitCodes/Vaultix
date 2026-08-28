import { Injectable, NestMiddleware, Logger } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import * as crypto from 'crypto';
import { sanitizeBody } from './body-sanitizer.util';
import { runWithContext } from '../utils/logger.util';

const SLOW_REQUEST_THRESHOLD_MS = Number(
  process.env.REQUEST_LOG_SLOW_THRESHOLD_MS || 5000,
);

const BODY_SIZE_LIMIT_BYTES = 10 * 1024 * 1024; // 10MB

const SKIP_PATHS = [
  '/health',
  '/health/',
  '/api/docs',
  '/api/docs/',
  '/api/docs-json',
  '/socket.io',
  '/favicon.ico',
];

const STATIC_FILE_EXTENSIONS =
  /\.(css|js|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot|map|json|xml|txt|pdf|doc|docx)$/i;

const MUTABLE_METHODS = new Set(['POST', 'PATCH', 'PUT']);

@Injectable()
export class RequestLoggingMiddleware implements NestMiddleware {
  private readonly logger = new Logger('RequestLogging');

  use(req: Request, res: Response, next: NextFunction): void {
    const path = (req.originalUrl || req.url).split('?')[0];

    if (this.shouldSkip(path)) {
      next();
      return;
    }

    const contentLength = Number(req.headers['content-length'] || 0);
    if (contentLength > BODY_SIZE_LIMIT_BYTES) {
      res.status(413).json({
        statusCode: 413,
        message: 'Request body too large',
      });
      this.logger.warn(
        JSON.stringify({
          type: 'request',
          method: req.method,
          path,
          ip: this.getClientIp(req),
          contentLength,
          rejected: 'body_too_large',
        }),
      );
      return;
    }

    const correlationId =
      (req.headers['x-request-id'] as string) || crypto.randomUUID();

    req['correlationId'] = correlationId;
    (req as Request & { id: string }).id = correlationId;
    res.setHeader('X-Request-Id', correlationId);

    const startTime = Date.now();
    const userId = this.extractUserId(req);
    const userAgent = req.headers['user-agent'] || '';
    const ip = this.getClientIp(req);

    const isMutable = MUTABLE_METHODS.has(req.method);
    const isMultipart =
      typeof req.headers['content-type'] === 'string' &&
      req.headers['content-type'].includes('multipart/');

    const requestLog: Record<string, unknown> = {
      type: 'request',
      correlationId,
      method: req.method,
      path,
      ip,
      userAgent,
    };

    if (userId) {
      requestLog.userId = userId;
    }

    if (contentLength > 0) {
      requestLog.contentLength = contentLength;
    }

    if (isMutable && !isMultipart && req.body && typeof req.body === 'object') {
      requestLog.body = sanitizeBody(req.body);
    }

    this.logger.log(JSON.stringify(requestLog));

    res.on('finish', () => {
      const responseTimeMs = Date.now() - startTime;
      const statusCode = res.statusCode;

      const responseLog: Record<string, unknown> = {
        type: 'response',
        correlationId,
        method: req.method,
        path,
        statusCode,
        responseTimeMs,
      };

      const resContentLength = res.getHeader('content-length');
      if (resContentLength) {
        responseLog.contentLength = Number(resContentLength);
      }

      if (statusCode >= 500) {
        this.logger.error(JSON.stringify(responseLog));
      } else if (
        statusCode >= 400 ||
        responseTimeMs > SLOW_REQUEST_THRESHOLD_MS
      ) {
        if (responseTimeMs > SLOW_REQUEST_THRESHOLD_MS) {
          responseLog.slowRequest = true;
        }
        this.logger.warn(JSON.stringify(responseLog));
      } else {
        this.logger.log(JSON.stringify(responseLog));
      }
    });

    runWithContext({ correlationId, userId }, () => next());
  }

  private shouldSkip(path: string): boolean {
    if (
      SKIP_PATHS.some((skip) => path === skip || path.startsWith(skip + '/'))
    ) {
      return true;
    }

    if (path === '/' || STATIC_FILE_EXTENSIONS.test(path)) {
      return true;
    }

    return false;
  }

  private extractUserId(req: Request): string | undefined {
    const user = req['user'] as { sub?: string; userId?: string } | undefined;

    if (!user) {
      return undefined;
    }

    return user.sub || user.userId;
  }

  private getClientIp(req: Request): string {
    const forwarded = req.headers['x-forwarded-for'];
    if (typeof forwarded === 'string') {
      return forwarded.split(',')[0].trim();
    }

    return req.ip || req.socket.remoteAddress || 'unknown';
  }
}
