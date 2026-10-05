import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import {
  NotificationChannel,
  NotificationEventType,
} from '../enums/notification-event.enum';

@Entity()
export class NotificationPreference {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  userId: string;

  @Column({ type: 'simple-enum', enum: NotificationChannel })
  channel: NotificationChannel;

  @Column({ default: true })
  enabled: boolean;

  @Column('simple-array')
  eventTypes: NotificationEventType[];

  // User-level in-app chime toggle, mirrored on each of the user's rows
  @Column({ default: true })
  soundEnabled: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
