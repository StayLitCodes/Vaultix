import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';

export interface DatabaseHealth {
  status: 'ok' | 'error';
  responseTimeMs?: number;
  error?: string;
  pool?: {
    total: number;
    idle: number;
    waiting: number;
  };
}

export interface HealthReport {
  status: 'ok' | 'degraded';
  timestamp: string;
  uptime: number;
  database: DatabaseHealth;
}

interface PoolInternals {
  totalCount?: number;
  idleCount?: number;
  waitingCount?: number;
  _allClients?: unknown[];
  _idle?: unknown[];
  _waitingQueue?: unknown[];
}

interface DriverInternals {
  master?: PoolInternals;
  pool?: PoolInternals;
}

@Injectable()
export class HealthService {
  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  async check(): Promise<HealthReport> {
    const database = await this.checkDatabase();
    return {
      status: database.status === 'ok' ? 'ok' : 'degraded',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      database,
    };
  }

  private async checkDatabase(): Promise<DatabaseHealth> {
    const start = Date.now();
    try {
      await this.dataSource.query('SELECT 1');
      const responseTimeMs = Date.now() - start;

      const driver = this.dataSource.driver as unknown as DriverInternals;
      const pool: PoolInternals | null = driver?.master ?? driver?.pool ?? null;

      return {
        status: 'ok',
        responseTimeMs,
        pool: pool
          ? {
              total: pool.totalCount ?? pool._allClients?.length ?? 0,
              idle: pool.idleCount ?? pool._idle?.length ?? 0,
              waiting: pool.waitingCount ?? pool._waitingQueue?.length ?? 0,
            }
          : undefined,
      };
    } catch (error) {
      return {
        status: 'error',
        responseTimeMs: Date.now() - start,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }
}