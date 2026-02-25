import {
  Column,
  Entity,
  PrimaryGeneratedColumn,
  ManyToOne,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { User } from '../user/entities/user.entity';

export type WebhookEvent =
  | 'escrow.created'
  | 'escrow.funded'
  | 'escrow.released'
  | 'escrow.cancelled'
  | 'escrow.disputed'
  | 'escrow.resolved'
  | 'condition.fulfilled'
  | 'condition.confirmed';

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

  @ManyToOne(() => User, { nullable: false })
  user: User;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
