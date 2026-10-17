import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { DATETIME_COLUMN_TYPE } from '../../utils/database-column-types';

export enum EmailOutboxStatus {
  PENDING = 'pending',
  SENT = 'sent',
  FAILED = 'failed',
}

@Entity('email_outbox')
@Index('idx_email_outbox_status_retry', ['status', 'nextRetryAt'])
export class EmailOutbox {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  to: string;

  @Column()
  subject: string;

  @Column({ type: 'text' })
  html: string;

  @Column({ type: 'text', nullable: true })
  text?: string;

  @Column({
    type: 'simple-enum',
    enum: EmailOutboxStatus,
    default: EmailOutboxStatus.PENDING,
  })
  status: EmailOutboxStatus;

  @Column({ default: 0 })
  attempts: number;

  @Column({ type: DATETIME_COLUMN_TYPE, nullable: true })
  nextRetryAt?: Date;

  @Column({ type: 'text', nullable: true })
  lastError?: string;

  @Column({ type: DATETIME_COLUMN_TYPE, nullable: true })
  sentAt?: Date;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
