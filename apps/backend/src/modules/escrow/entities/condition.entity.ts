import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Escrow } from './escrow.entity';

export enum ConditionType {
  MANUAL = 'manual',
  TIME_BASED = 'time_based',
  ORACLE = 'oracle',
}

@Entity('escrow_conditions')
export class Condition {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  escrowId: string;

  @ManyToOne(() => Escrow, (escrow) => escrow.conditions, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'escrowId' })
  escrow: Escrow;

  @Column({ type: 'text' })
  description: string;

  @Column({
    type: 'varchar',
    default: ConditionType.MANUAL,
  })
  type: ConditionType;

  @Column({ default: false })
  isFulfilled: boolean;

  @Column({ type: 'datetime', nullable: true })
  fulfilledAt?: Date;

  @Column({ nullable: true })
  fulfilledByUserId?: string;

  @Column({ type: 'text', nullable: true })
  fulfillmentNotes?: string;

  @Column({ type: 'text', nullable: true })
  fulfillmentEvidence?: string;

  @Column({ default: false })
  isMet: boolean;

  @Column({ type: 'datetime', nullable: true })
  metAt?: Date;

  @Column({ nullable: true })
  metByUserId?: string;

  @Column({ type: 'simple-json', nullable: true })
  metadata?: Record<string, any>;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
