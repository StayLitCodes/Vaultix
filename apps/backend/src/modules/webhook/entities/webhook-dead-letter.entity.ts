import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Webhook } from '../webhook.entity';

@Entity('webhook_dead_letter')
@Index(['webhookId'])
export class WebhookDeadLetter {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @ManyToOne(() => Webhook, { onDelete: 'CASCADE' })
  webhook!: Webhook;

  @Column()
  webhookId!: string;

  @Column({ type: 'varchar', nullable: true })
  originalDeliveryId!: string | null;

  @Column()
  event!: string;

  @Column({ type: 'simple-json' })
  payload!: Record<string, unknown>;

  @Column({ default: 0 })
  attempts!: number;

  @Column({ type: 'integer', nullable: true })
  lastStatusCode!: number | null;

  @Column({ type: 'text', nullable: true })
  lastError!: string | null;

  @Column({ type: 'datetime' })
  failedAt!: Date;

  @Column({ type: 'datetime', nullable: true })
  replayedAt!: Date | null;

  @CreateDateColumn()
  createdAt!: Date;
}
