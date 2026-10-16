import {
  BadRequestException,
  CallHandler,
  ConflictException,
  ExecutionContext,
  Injectable,
  NestInterceptor,
  UnprocessableEntityException,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { Observable, catchError, from, mergeMap, of, throwError } from 'rxjs';
import { IdempotencyService } from './idempotency.service';

export const IDEMPOTENCY_HEADER = 'idempotency-key';
const MAX_KEY_LENGTH = 255;

interface IdempotentRequest extends Request {
  user?: { sub?: string; userId?: string };
}

/**
 * Makes a mutating endpoint safe to retry. Without an `Idempotency-Key`
 * header the request runs normally. With one:
 * - first use: handler runs and its response is stored for the TTL
 * - same key + same payload: stored response is replayed (header
 *   `Idempotent-Replayed: true`), handler is not run again
 * - same key + different payload: 422
 * - same key while the first request is still running: 409
 * Errors are not stored, so a failed request can be retried with the same key.
 */
@Injectable()
export class IdempotencyInterceptor implements NestInterceptor {
  constructor(private readonly service: IdempotencyService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const http = context.switchToHttp();
    const req = http.getRequest<IdempotentRequest>();
    const res = http.getResponse<Response>();

    const header = req.headers[IDEMPOTENCY_HEADER];
    if (header === undefined) return next.handle();

    const key = Array.isArray(header) ? header[0] : header;
    if (!key || !key.trim() || key.length > MAX_KEY_LENGTH) {
      throw new BadRequestException(
        `Idempotency-Key must be 1-${MAX_KEY_LENGTH} characters`,
      );
    }

    const userId = req.user?.sub ?? req.user?.userId;
    if (!userId) return next.handle();

    const scope = `${req.method} ${(req.route as { path?: string } | undefined)?.path ?? req.path}`;
    const requestHash = this.service.hashRequest({
      body: req.body as unknown,
      params: req.params,
      query: req.query,
    });

    return from(this.service.begin(userId, scope, key, requestHash)).pipe(
      mergeMap((outcome) => {
        switch (outcome.type) {
          case 'replay':
            res.status(outcome.status);
            res.setHeader('Idempotent-Replayed', 'true');
            return of(outcome.body);
          case 'mismatch':
            return throwError(
              () =>
                new UnprocessableEntityException(
                  'Idempotency-Key was already used with a different request payload',
                ),
            );
          case 'in-flight':
            return throwError(
              () =>
                new ConflictException(
                  'A request with this Idempotency-Key is still being processed',
                ),
            );
          case 'new':
            return next.handle().pipe(
              mergeMap((body) =>
                from(
                  this.service.complete(outcome.id, res.statusCode, body),
                ).pipe(mergeMap(() => of(body))),
              ),
              catchError((error: unknown) =>
                from(this.service.release(outcome.id)).pipe(
                  mergeMap(() => throwError(() => error)),
                ),
              ),
            );
        }
      }),
    );
  }
}
