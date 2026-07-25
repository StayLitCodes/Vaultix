import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import {
  Repository,
  FindOptionsWhere,
  Between,
  LessThanOrEqual,
  MoreThanOrEqual,
} from 'typeorm';
import { AuditLog } from './entities/audit-log.entity';

export interface LogEntryParams {
  entityType: string;
  entityId: string;
  action: string;
  actorId?: string;
  actorRole?: string;
  previousState?: Record<string, unknown>;
  newState?: Record<string, unknown>;
  ipAddress?: string;
  userAgent?: string;
  metadata?: Record<string, unknown>;
}

export interface AuditLogFilters {
  entityType?: string;
  entityId?: string;
  action?: string;
  actorId?: string;
  actorRole?: string;
  from?: Date;
  to?: Date;
  page?: number;
  pageSize?: number;
}

@Injectable()
export class AuditLogService {
  constructor(
    @InjectRepository(AuditLog)
    private readonly auditLogRepo: Repository<AuditLog>,
  ) {}

  /**
   * Record an audit log entry. This is a non-blocking async write — the
   * promise is not awaited by the caller, so it runs in the background.
   */
  log(params: LogEntryParams): void {
    const entry = this.auditLogRepo.create({
      entityType: params.entityType,
      entityId: params.entityId,
      action: params.action,
      actorId: params.actorId ?? null,
      actorRole: params.actorRole ?? null,
      previousState: params.previousState ?? null,
      newState: params.newState ?? null,
      ipAddress: params.ipAddress ?? null,
      userAgent: params.userAgent ?? null,
      metadata: params.metadata ?? null,
    });

    // Fire-and-forget: do not block the caller
    this.auditLogRepo.save(entry).catch((err) => {
      console.error('AUDIT_LOG_WRITE_ERROR:', err?.message ?? err);
    });
  }

  /**
   * Find all audit log entries for a specific entity (e.g. escrow history).
   * Used by GET /escrows/:id/audit-log
   */
  async findByEntity(
    entityType: string,
    entityId: string,
    filters: Omit<AuditLogFilters, 'entityType' | 'entityId'> = {},
  ): Promise<{ data: AuditLog[]; total: number }> {
    return this.findAll({ ...filters, entityType, entityId });
  }

  /**
   * Find all audit log entries with optional filters and pagination.
   * Used by GET /admin/audit-logs
   */
  async findAll(
    filters: AuditLogFilters = {},
  ): Promise<{ data: AuditLog[]; total: number }> {
    const {
      entityType,
      entityId,
      action,
      actorId,
      actorRole,
      from,
      to,
      page = 1,
      pageSize = 50,
    } = filters;

    const where: FindOptionsWhere<AuditLog> = {};

    if (entityType) where.entityType = entityType;
    if (entityId) where.entityId = entityId;
    if (action) where.action = action;
    if (actorId) where.actorId = actorId;
    if (actorRole) where.actorRole = actorRole;

    if (from && to) {
      where.createdAt = Between(from, to);
    } else if (from) {
      where.createdAt = MoreThanOrEqual(from);
    } else if (to) {
      where.createdAt = LessThanOrEqual(to);
    }

    const [data, total] = await this.auditLogRepo.findAndCount({
      where,
      order: { createdAt: 'DESC' },
      skip: (page - 1) * pageSize,
      take: pageSize,
    });

    return { data, total };
  }
}
