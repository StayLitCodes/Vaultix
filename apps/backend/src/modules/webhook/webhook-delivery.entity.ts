import {
  Column,
  CreateDateColumn,
  Entity,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Webhook } from './webhook.entity';
import type { WebhookEvent } from '../../types/webhook/webhook.types';

@Entity('webhook_deliveries')
export class WebhookDelivery {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Webhook, (webhook) => webhook.deliveries, {
    onDelete: 'CASCADE',
  })
  webhook: Webhook;

  @Column()
  event: WebhookEvent | string;

  @Column({ type: 'simple-json', nullable: true })
  payload?: Record<string, unknown> | null;

  @Column({ type: 'int', nullable: true })
  responseStatus?: number | null;

  @Column({ default: 0 })
  attemptCount: number;

  @Column({ type: 'datetime', nullable: true })
  nextRetryAt?: Date | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
