import {
  BadRequestException,
  ConflictException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { firstValueFrom, of, throwError } from 'rxjs';
import { IdempotencyInterceptor } from './idempotency.interceptor';

describe('IdempotencyInterceptor', () => {
  let service: any;
  let interceptor: IdempotencyInterceptor;
  let res: any;

  const ctx = (
    headers: Record<string, string> = {},
    user: any = { sub: 'u1' },
  ) =>
    ({
      switchToHttp: () => ({
        getRequest: () => ({
          headers,
          user,
          method: 'POST',
          path: '/escrows',
          route: { path: '/escrows/:id/fund' },
          body: { a: 1 },
          params: { id: 'e1' },
          query: {},
        }),
        getResponse: () => res,
      }),
    }) as any;

  beforeEach(() => {
    service = {
      hashRequest: jest.fn().mockReturnValue('h'),
      begin: jest.fn(),
      complete: jest.fn().mockResolvedValue(undefined),
      release: jest.fn().mockResolvedValue(undefined),
    };
    res = { statusCode: 201, status: jest.fn(), setHeader: jest.fn() };
    interceptor = new IdempotencyInterceptor(service);
  });

  it('passes through without a key', async () => {
    const next = { handle: jest.fn().mockReturnValue(of('ok')) };
    expect(await firstValueFrom(interceptor.intercept(ctx(), next))).toBe('ok');
    expect(service.begin).not.toHaveBeenCalled();
  });

  it('rejects an empty or oversized key', () => {
    const next = { handle: jest.fn() };
    expect(() =>
      interceptor.intercept(ctx({ 'idempotency-key': ' ' }), next),
    ).toThrow(BadRequestException);
    expect(() =>
      interceptor.intercept(ctx({ 'idempotency-key': 'x'.repeat(256) }), next),
    ).toThrow(BadRequestException);
  });

  it('runs the handler once and stores the response for a new key', async () => {
    service.begin.mockResolvedValue({ type: 'new', id: 'k1' });
    const next = { handle: jest.fn().mockReturnValue(of({ id: 'e1' })) };

    const out = await firstValueFrom(
      interceptor.intercept(ctx({ 'idempotency-key': 'abc' }), next),
    );

    expect(out).toEqual({ id: 'e1' });
    expect(service.begin).toHaveBeenCalledWith(
      'u1',
      'POST /escrows/:id/fund',
      'abc',
      'h',
    );
    expect(service.complete).toHaveBeenCalledWith('k1', 201, { id: 'e1' });
  });

  it('replays the stored response without running the handler', async () => {
    service.begin.mockResolvedValue({
      type: 'replay',
      status: 201,
      body: { id: 'e1' },
    });
    const next = { handle: jest.fn() };

    const out = await firstValueFrom(
      interceptor.intercept(ctx({ 'idempotency-key': 'abc' }), next),
    );

    expect(out).toEqual({ id: 'e1' });
    expect(next.handle).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.setHeader).toHaveBeenCalledWith('Idempotent-Replayed', 'true');
  });

  it('returns 422 when the key is reused with a different payload', async () => {
    service.begin.mockResolvedValue({ type: 'mismatch' });
    await expect(
      firstValueFrom(
        interceptor.intercept(ctx({ 'idempotency-key': 'abc' }), {
          handle: jest.fn(),
        }),
      ),
    ).rejects.toThrow(UnprocessableEntityException);
  });

  it('returns 409 while the first request is in flight', async () => {
    service.begin.mockResolvedValue({ type: 'in-flight' });
    await expect(
      firstValueFrom(
        interceptor.intercept(ctx({ 'idempotency-key': 'abc' }), {
          handle: jest.fn(),
        }),
      ),
    ).rejects.toThrow(ConflictException);
  });

  it('releases the key when the handler fails so the client can retry', async () => {
    service.begin.mockResolvedValue({ type: 'new', id: 'k1' });
    const boom = new Error('boom');
    const next = { handle: jest.fn().mockReturnValue(throwError(() => boom)) };

    await expect(
      firstValueFrom(
        interceptor.intercept(ctx({ 'idempotency-key': 'abc' }), next),
      ),
    ).rejects.toBe(boom);
    expect(service.release).toHaveBeenCalledWith('k1');
    expect(service.complete).not.toHaveBeenCalled();
  });
});
