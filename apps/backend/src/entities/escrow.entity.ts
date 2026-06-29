import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, Index } from 'typeorm';

@Entity('escrows')
// Composite indices matching execution WHERE and ORDER BY logic
@Index(['status', 'createdAt'])
@Index(['buyerId', 'status'])
@Index(['sellerId', 'status'])
export class Escrow {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  @Index() // Single-column query filter acceleration
  buyerId: string;

  @Column()
  @Index()
  sellerId: string;

  @Column({ type: 'varchar', length: 32 })
  @Index()
  status: string;

  @Column({ type: 'timestamp' })
  @Index()
  deadline: Date;

  @CreateDateColumn()
  @Index()
  createdAt: Date;
}