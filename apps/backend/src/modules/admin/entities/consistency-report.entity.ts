import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm';

export enum ConsistencySeverity {
  CRITICAL = 'critical',
  WARNING = 'warning',
  INFO = 'info',
}

@Entity('consistency_reports')
@Index('idx_consistency_escrow_id', ['escrowId'])
@Index('idx_consistency_severity', ['severity'])
@Index('idx_consistency_created_at', ['createdAt'])
export class ConsistencyReport {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  escrowId: string;

  @Column({ type: 'varchar' })
  severity: ConsistencySeverity;

  @Column({ type: 'simple-json' })
  discrepancies: Array<{
    field: string;
    dbValue: unknown;
    onchainValue: unknown;
  }>;

  @Column({ type: 'simple-json', nullable: true })
  metadata?: Record<string, unknown>;

  @Column({ default: false })
  resolved: boolean;

  @Column({ nullable: true })
  resolvedByUserId?: string;

  @Column({ type: 'datetime', nullable: true })
  resolvedAt?: Date;

  @CreateDateColumn()
  createdAt: Date;
}
