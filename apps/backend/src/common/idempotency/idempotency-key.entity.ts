import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { DATETIME_COLUMN_TYPE } from '../../utils/database-column-types';

/**
 * One row per (user, endpoint, Idempotency-Key). `responseStatus` is null
 * while the first request is still in flight.
 */
@Entity('idempotency_keys')
@Index('UQ_idempotency_user_scope_key', ['userId', 'scope', 'key'], {
  unique: true,
})
@Index('idx_idempotency_expires_at', ['expiresAt'])
export class IdempotencyKey {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  userId: string;

  /** HTTP method + route template, e.g. "POST /escrows/:id/fund" */
  @Column()
  scope: string;

  @Column()
  key: string;

  @Column()
  requestHash: string;

  @Column({ type: 'int', nullable: true })
  responseStatus: number | null;

  @Column({ type: 'simple-json', nullable: true })
  responseBody: Record<string, unknown> | null;

  @CreateDateColumn()
  createdAt: Date;

  @Column({ type: DATETIME_COLUMN_TYPE })
  expiresAt: Date;
}
