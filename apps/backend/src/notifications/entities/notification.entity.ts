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

  @Column({ type: process.env.DATABASE_DRIVER === 'postgres' ? 'jsonb' : 'simple-json' })
  payload: Record<string, unknown>;

  @Column({
    type: 'simple-enum',
    enum: NotificationStatus,
    default: NotificationStatus.PENDING,
  })
  status: NotificationStatus;

  @Column({ default: 0 })
  retryCount: number;

  @Column({ type: process.env.DATABASE_DRIVER === 'postgres' ? 'timestamp' : 'datetime', nullable: true })
  readAt?: Date;

  @Column({ nullable: true })
  @Index({ unique: true })
  idempotencyKey?: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
