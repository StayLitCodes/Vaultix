import { createHash } from 'crypto';
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { LessThan, QueryFailedError, Repository } from 'typeorm';
import { QueryDeepPartialEntity } from 'typeorm/query-builder/QueryPartialEntity';
import { IdempotencyKey } from './idempotency-key.entity';

export const DEFAULT_IDEMPOTENCY_TTL_SECONDS = 24 * 60 * 60;

export type IdempotencyOutcome =
  | { type: 'new'; id: string }
  | { type: 'replay'; status: number; body: unknown }
  | { type: 'mismatch' }
  | { type: 'in-flight' };

/** Deterministic JSON: object keys are sorted so key order never changes the hash. */
function stableStringify(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map(stableStringify).join(',')}]`;
  }
  if (value && typeof value === 'object') {
    const obj = value as Record<string, unknown>;
    return `{${Object.keys(obj)
      .sort()
      .map((k) => `${JSON.stringify(k)}:${stableStringify(obj[k])}`)
      .join(',')}}`;
  }
  return JSON.stringify(value) ?? 'null';
}

@Injectable()
export class IdempotencyService {
  private readonly logger = new Logger(IdempotencyService.name);

  constructor(
    @InjectRepository(IdempotencyKey)
    private readonly repo: Repository<IdempotencyKey>,
    private readonly config: ConfigService,
  ) {}

  get ttlMs(): number {
    const seconds = Number(this.config.get('IDEMPOTENCY_TTL_SECONDS'));
    return (
      (Number.isFinite(seconds) && seconds > 0
        ? seconds
        : DEFAULT_IDEMPOTENCY_TTL_SECONDS) * 1000
    );
  }

  hashRequest(payload: unknown): string {
    return createHash('sha256').update(stableStringify(payload)).digest('hex');
  }

  /**
   * Reserves the key for a first request, or reports what to do with a
   * repeated one. The unique index makes concurrent first requests race
   * safely: only one insert wins, the other sees "in-flight".
   */
  async begin(
    userId: string,
    scope: string,
    key: string,
    requestHash: string,
  ): Promise<IdempotencyOutcome> {
    const existing = await this.repo.findOne({ where: { userId, scope, key } });
    if (existing) {
      if (existing.expiresAt.getTime() > Date.now()) {
        return this.classify(existing, requestHash);
      }
      await this.repo.delete({ id: existing.id });
    }

    try {
      const row = await this.repo.save(
        this.repo.create({
          userId,
          scope,
          key,
          requestHash,
          responseStatus: null,
          responseBody: null,
          expiresAt: new Date(Date.now() + this.ttlMs),
        }),
      );
      return { type: 'new', id: row.id };
    } catch (error) {
      if (!(error instanceof QueryFailedError)) throw error;
      const raced = await this.repo.findOne({ where: { userId, scope, key } });
      if (!raced) throw error;
      return this.classify(raced, requestHash);
    }
  }

  private classify(
    row: IdempotencyKey,
    requestHash: string,
  ): IdempotencyOutcome {
    if (row.requestHash !== requestHash) return { type: 'mismatch' };
    if (row.responseStatus === null) return { type: 'in-flight' };
    return {
      type: 'replay',
      status: row.responseStatus,
      body: row.responseBody,
    };
  }

  async complete(id: string, status: number, body: unknown): Promise<void> {
    await this.repo.update({ id }, {
      responseStatus: status,
      responseBody: (body ?? null) as Record<string, unknown> | null,
    } as QueryDeepPartialEntity<IdempotencyKey>);
  }

  /** Failed requests are not cached, so the client may retry with the same key. */
  async release(id: string): Promise<void> {
    await this.repo.delete({ id });
  }

  @Cron(CronExpression.EVERY_HOUR)
  async purgeExpired(): Promise<void> {
    const result = await this.repo.delete({ expiresAt: LessThan(new Date()) });
    if (result.affected) {
      this.logger.debug(`Purged ${result.affected} expired idempotency keys`);
    }
  }
}
