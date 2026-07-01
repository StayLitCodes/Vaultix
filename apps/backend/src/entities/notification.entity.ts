import { Entity, PrimaryGeneratedColumn, Column, Index } from 'typeorm';

@Entity('notifications')
// Composite optimization index for fetching unread notification feeds per user
@Index(['userId', 'isRead'])
export class Notification {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  userId: string;

  @Column({ type: 'boolean', default: false })
  isRead: boolean;

  @Column()
  message: string;
}
