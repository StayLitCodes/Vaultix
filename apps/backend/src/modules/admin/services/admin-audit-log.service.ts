import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import {
  Repository,
  FindManyOptions,
  FindOptionsWhere,
  Between,
  MoreThanOrEqual,
  LessThanOrEqual,
  DeepPartial,
} from 'typeorm';
import { AuditLog, AdminAuditLog } from '../entities/admin-audit-log.entity';

export interface CreateAuditLogDto {
  entityType: string;
  entityId: string;
  action: string;
  actorId: string;
  actorRole: string;
  previousState?: Record<string, unknown>;
  newState?: Record<string, unknown>;
  ipAddress?: string;
  userAgent?: string;
  metadata?: Record<string, unknown>;
}

export interface PaginatedAuditLogs {
  data: AuditLog[];
  total: number;
  page: number;
  pageSize: number;
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
export class AdminAuditLogService {
  constructor(
    @InjectRepository(AuditLog)
    private readonly auditLogRepo: Repository<AuditLog>,
    @InjectRepository(AdminAuditLog)
    private readonly adminAuditLogRepo: Repository<AdminAuditLog>,
  ) {}

  async log(dto: CreateAuditLogDto): Promise<AuditLog> {
    const log = this.auditLogRepo.create(dto as DeepPartial<AuditLog>);
    return this.auditLogRepo.save(log);
  }

  async logAdminAction(
    actorId: string,
    actionType: string,
    resourceType: string,
    resourceId?: string | null,
    metadata?: Record<string, unknown>,
  ): Promise<AdminAuditLog> {
    const log = this.adminAuditLogRepo.create({
      actorId,
      actionType,
      resourceType,
      resourceId: resourceId ?? null,
      metadata: metadata ?? {},
    } as DeepPartial<AdminAuditLog>);
    return this.adminAuditLogRepo.save(log);
  }

  async findAll(
    filters: AuditLogFilters = {},
  ): Promise<PaginatedAuditLogs> {
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
    if (from || to) {
      const dateFilter: any = {};
      if (from) {
        dateFilter.createdAt = MoreThanOrEqual(from);
      }
      if (to) {
        dateFilter.createdAt = LessThanOrEqual(to);
      }
      Object.assign(where, dateFilter);
    }

    const [data, total] = await this.auditLogRepo.findAndCount({
      where,
      order: { createdAt: 'DESC' },
      skip: (page - 1) * pageSize,
      take: pageSize,
    } as FindManyOptions<AuditLog>);
    return { data, total, page, pageSize };
  }

  async findByEntity(entityType: string, entityId: string): Promise<AuditLog[]> {
    return this.auditLogRepo.find({
      where: { entityType, entityId },
      order: { createdAt: 'DESC' },
    });
  }
}
