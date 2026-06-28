import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
} from 'typeorm';

@Entity('audit_logs')
export class AuditLog {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 64 })
  entityType: string;

  @Column({ type: 'varchar', length: 128 })
  entityId: string;

  @Column({ type: 'varchar', length: 64 })
  action: string;

  @Column({ type: 'varchar', length: 64 })
  actorId: string;

  @Column({ type: 'varchar', length: 32 })
  actorRole: string;

  @Column({ type: 'simple-json', nullable: true })
  previousState?: Record<string, unknown>;

  @Column({ type: 'simple-json', nullable: true })
  newState?: Record<string, unknown>;

  @Column({ type: 'varchar', length: 45, nullable: true })
  ipAddress?: string;

  @Column({ type: 'text', nullable: true })
  userAgent?: string;

  @Column({ type: 'simple-json', nullable: true })
  metadata?: Record<string, unknown>;

  @CreateDateColumn()
  createdAt: Date;
}

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
