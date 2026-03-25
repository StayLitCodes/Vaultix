import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
} from 'typeorm';

@Entity('admin_audit_log')
export class AdminAuditLog {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 64 })
  actorId: string;

  @Column({ type: 'varchar', length: 64 })
  actionType: string;

  @Column({ type: 'varchar', length: 64 })
  resourceType: string;

  @Column({ type: 'varchar', length: 128, nullable: true })
  resourceId: string | null;

  @Column({ type: 'simple-json', nullable: true })
  metadata?: Record<string, unknown>;

  @CreateDateColumn()
  createdAt: Date;
}
