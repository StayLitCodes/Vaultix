import { Entity, PrimaryGeneratedColumn, Column, Index } from 'typeorm';

@Entity('disputes')
export class Dispute {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  @Index()
  escrowId: string;

  @Column({ type: 'varchar', length: 32 })
  @Index()
  status: string;
}