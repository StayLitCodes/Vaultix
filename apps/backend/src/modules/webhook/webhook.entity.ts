import {
  Column,
  Entity,
  PrimaryGeneratedColumn,
  ManyToOne,
  OneToMany,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { User } from '../user/entities/user.entity';
import { WebhookDelivery } from './webhook-delivery.entity';
import type { WebhookEvent } from '../../types/webhook/webhook.types';

@Entity('webhooks')
export class Webhook {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  url: string;

  @Column()
  secret: string;

  @Column('simple-array')
  events: WebhookEvent[];

  @Column({ default: true })
  isActive: boolean;

  @Column({ type: 'int', default: 0 })
  failureCount: number;

  @Column({ type: 'datetime', nullable: true })
  lastTriggeredAt?: Date | null;

  @ManyToOne(() => User, { nullable: false })
  user: User;

  @OneToMany(() => WebhookDelivery, (delivery) => delivery.webhook, {
    cascade: true,
  })
  deliveries: WebhookDelivery[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
