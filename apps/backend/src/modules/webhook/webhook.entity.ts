import {
  Column,
  Entity,
  PrimaryGeneratedColumn,
  ManyToOne,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { User } from '../user/entities/user.entity';
import type { WebhookEvent } from '../../types/webhook/webhook.types';
import { DATETIME_COLUMN_TYPE } from '../../utils/database-column-types';

@Entity('webhooks')
export class Webhook {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column()
  url!: string;

  @Column()
  secret!: string;

  @Column({ type: 'varchar', nullable: true })
  previousSecret!: string | null;

  @Column({ type: DATETIME_COLUMN_TYPE, nullable: true })
  previousSecretExpiresAt!: Date | null;

  @Column('simple-array')
  events!: WebhookEvent[];

  @Column({ default: true })
  isActive!: boolean;

  @ManyToOne(() => User, { nullable: false })
  user!: User;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}
