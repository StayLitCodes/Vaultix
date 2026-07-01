import { Entity, PrimaryGeneratedColumn, Column, Index } from 'typeorm';

@Entity('conditions')
export class Condition {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  @Index() // Speeds up lookups when joining or querying conditions by escrow
  escrowId: string;

  @Column()
  title: string;
}
