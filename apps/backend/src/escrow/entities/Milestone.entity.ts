import { Column, Entity, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { Escrow } from './escrow.entity';

@Entity()
export class Milestone {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => Escrow, (e) => e.milestones)
  escrow: Escrow;

  @Column()
  index: number;

  @Column()
  description: string;

  @Column({ type: 'decimal', precision: 18, scale: 6 })
  amount: string;

  @Column()
  status: string;

  @Column({ type: 'timestamp', nullable: true })
  releasedAt?: Date;
}
