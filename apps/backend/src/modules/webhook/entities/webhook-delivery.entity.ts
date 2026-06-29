import {
  Column,
  Entity,
  PrimaryGeneratedColumn,
  ManyToOne,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';
import { Webhook } from '../webhook.entity';
import { WebhookDeliveryStatus } from '../../../types/webhook/webhook.types';

@Entity('webhook_delivery')
@Index(['status', 'nextRetryAt'])
export class WebhookDelivery {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @ManyToOne(() => Webhook, { onDelete: 'CASCADE' })
  webhook!: Webhook;

  @Column()
  webhookId!: string;

  @Column()
  event!: string;

  @Column({ type: 'simple-json' })
  payload!: Record<string, unknown>;

  @Column({
    type: 'simple-enum',
    enum: WebhookDeliveryStatus,
    default: WebhookDeliveryStatus.PENDING,
  })
  status!: WebhookDeliveryStatus;

  @Column({ default: 1 })
  attempt!: number;

  @Column({ default: 5 })
  maxAttempts!: number;

  @Column({ type: 'datetime', nullable: true })
  nextRetryAt!: Date | null;

  @Column({ nullable: true })
  lastStatusCode!: number | null;

  @Column({ type: 'text', nullable: true })
  lastError!: string | null;

  @Column({ type: 'datetime', nullable: true })
  lastAttemptAt!: Date | null;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}
