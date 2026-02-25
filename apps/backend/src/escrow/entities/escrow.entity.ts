import {
  Column,
  CreateDateColumn,
  Entity,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Milestone } from './Milestone.entity';

@Entity()
export class Escrow {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  depositorId: string;

  @Column()
  recipientId: string;

  @Column()
  token: string;

  @Column({ type: 'decimal', precision: 18, scale: 6 })
  totalAmount: string;

  @Column({ type: 'decimal', precision: 18, scale: 6, default: 0 })
  totalReleased: string;

  @Column({ type: 'timestamp' })
  deadline: Date;

  @Column()
  status: string;

  @OneToMany(() => Milestone, (m) => m.escrow)
  milestones: Milestone[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
