import {
  Column,
  Entity,
  PrimaryGeneratedColumn,
  ManyToOne,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Webhook } from './webhook.entity';

export type WebhookDeliveryStatus = 'pending' | 'delivered' | 'retrying' | 'failed';

@Entity('webhook_deliveries')
export class WebhookDelivery {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Webhook, { onDelete: 'CASCADE' })
  webhook: Webhook;

  @Column('jsonb')
  payload: any;

  @Column({
    type: 'varchar',
    default: 'pending',
  })
  status: WebhookDeliveryStatus;

  @Column({ default: 0 })
  attempts: number;

  @Column({ type: 'int', nullable: true })
  lastStatusCode: number | null;

  @Column({ type: 'text', nullable: true })
  errorMessage: string | null;

  @Column({ type: 'timestamp', nullable: true })
  nextRetryAt: Date | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
