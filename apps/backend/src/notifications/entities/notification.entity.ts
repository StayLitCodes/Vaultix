import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';
import {
  NotificationEventType,
  NotificationStatus,
} from '../enums/notification-event.enum';
import { DATETIME_COLUMN_TYPE } from '../../utils/database-column-types';

@Entity()
export class Notification {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  userId: string;

  @Column({ nullable: true })
  escrowId?: string;

  @Column({ type: 'simple-enum', enum: NotificationEventType })
  eventType: NotificationEventType;

  @Column({ type: 'simple-json' })
  payload: Record<string, unknown>;

  @Column({
    type: 'simple-enum',
    enum: NotificationStatus,
    default: NotificationStatus.PENDING,
  })
  status: NotificationStatus;

  @Column({ default: 0 })
  retryCount: number;

  @Column({ type: DATETIME_COLUMN_TYPE, nullable: true })
  readAt?: Date;

  @Column({ nullable: true })
  @Index({ unique: true })
  idempotencyKey?: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
