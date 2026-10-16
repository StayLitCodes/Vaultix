import { QueryFailedError } from 'typeorm';
import { IdempotencyService } from './idempotency.service';

describe('IdempotencyService', () => {
  let repo: any;
  let config: { get: jest.Mock };
  let service: IdempotencyService;
  const future = () => new Date(Date.now() + 60_000);

  beforeEach(() => {
    repo = {
      findOne: jest.fn(),
      create: jest.fn((v) => v),
      save: jest.fn((v) => Promise.resolve({ ...v, id: 'k1' })),
      update: jest.fn(),
      delete: jest.fn().mockResolvedValue({ affected: 0 }),
    };
    config = { get: jest.fn() };
    service = new IdempotencyService(repo, config as any);
  });

  it('hashes equal payloads equally regardless of key order', () => {
    expect(service.hashRequest({ a: 1, b: { c: 2, d: 3 } })).toBe(
      service.hashRequest({ b: { d: 3, c: 2 }, a: 1 }),
    );
    expect(service.hashRequest({ a: 1 })).not.toBe(
      service.hashRequest({ a: 2 }),
    );
  });

  it('uses the configured TTL and falls back to 24h', () => {
    expect(service.ttlMs).toBe(86_400_000);
    config.get.mockReturnValue('60');
    expect(service.ttlMs).toBe(60_000);
    config.get.mockReturnValue('bogus');
    expect(service.ttlMs).toBe(86_400_000);
  });

  it('reserves a new key', async () => {
    repo.findOne.mockResolvedValue(null);
    expect(await service.begin('u', 's', 'k', 'h')).toEqual({
      type: 'new',
      id: 'k1',
    });
  });

  it('replays a completed response for the same payload', async () => {
    repo.findOne.mockResolvedValue({
      requestHash: 'h',
      responseStatus: 201,
      responseBody: { id: 'e1' },
      expiresAt: future(),
    });
    expect(await service.begin('u', 's', 'k', 'h')).toEqual({
      type: 'replay',
      status: 201,
      body: { id: 'e1' },
    });
  });

  it('reports a mismatch when the payload differs', async () => {
    repo.findOne.mockResolvedValue({
      requestHash: 'other',
      responseStatus: 201,
      expiresAt: future(),
    });
    expect(await service.begin('u', 's', 'k', 'h')).toEqual({
      type: 'mismatch',
    });
  });

  it('reports in-flight while the first request has no response', async () => {
    repo.findOne.mockResolvedValue({
      requestHash: 'h',
      responseStatus: null,
      expiresAt: future(),
    });
    expect(await service.begin('u', 's', 'k', 'h')).toEqual({
      type: 'in-flight',
    });
  });

  it('treats an expired key as new', async () => {
    repo.findOne.mockResolvedValue({
      id: 'old',
      requestHash: 'h',
      responseStatus: 201,
      expiresAt: new Date(Date.now() - 1000),
    });
    const out = await service.begin('u', 's', 'k', 'h');
    expect(repo.delete).toHaveBeenCalledWith({ id: 'old' });
    expect(out.type).toBe('new');
  });

  it('resolves a concurrent insert race via the unique index', async () => {
    repo.findOne.mockResolvedValueOnce(null).mockResolvedValueOnce({
      requestHash: 'h',
      responseStatus: null,
      expiresAt: future(),
    });
    repo.save.mockRejectedValue(
      new QueryFailedError('insert', [], new Error('UNIQUE constraint failed')),
    );
    expect(await service.begin('u', 's', 'k', 'h')).toEqual({
      type: 'in-flight',
    });
  });

  it('completes and releases rows', async () => {
    await service.complete('k1', 201, { ok: true });
    expect(repo.update).toHaveBeenCalledWith(
      { id: 'k1' },
      { responseStatus: 201, responseBody: { ok: true } },
    );
    await service.release('k1');
    expect(repo.delete).toHaveBeenCalledWith({ id: 'k1' });
  });
});
