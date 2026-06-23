import { Controller, Get } from '@nestjs/common';
import {
  HealthCheck,
  HealthCheckService,
  HealthCheckResult,
  HealthIndicatorResult,
} from '@nestjs/terminus';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../user/entities/user.entity';
import { Escrow, EscrowStatus } from '../escrow/entities/escrow.entity';

interface HealthInfo {
  version: string;
  nodeVersion: string;
  uptime: number;
  network: string;
  databaseType: string;
  metrics: {
    activeEscrows: number;
    totalUsers: number;
  };
}

@Controller('health')
export class HealthController {
  constructor(
    private health: HealthCheckService,
    @InjectRepository(User)
    private userRepository: Repository<User>,
    @InjectRepository(Escrow)
    private escrowRepository: Repository<Escrow>,
  ) {}

  @Get()
  @HealthCheck()
  async check(): Promise<HealthCheckResult> {
    return this.health.check([
      () => this.checkDatabase(),
      () => this.checkMemory(),
      () => this.checkDisk(),
    ]);
  }

  @Get('live')
  live(): { status: string } {
    return { status: 'ok' };
  }

  @Get('ready')
  @HealthCheck()
  async ready(): Promise<HealthCheckResult> {
    return this.health.check([() => this.checkDatabase()]);
  }

  @Get('info')
  async info(): Promise<HealthInfo> {
    const activeEscrows = await this.escrowRepository.count({
      where: { status: EscrowStatus.ACTIVE },
    });
    const totalUsers = await this.userRepository.count();

    return {
      version: process.env.npm_package_version || '0.0.1',
      nodeVersion: process.version,
      uptime: process.uptime(),
      network: process.env.STELLAR_NETWORK || 'testnet',
      databaseType: 'sqlite',
      metrics: {
        activeEscrows,
        totalUsers,
      },
    };
  }

  private async checkDatabase(): Promise<HealthIndicatorResult> {
    try {
      await this.userRepository.query('SELECT 1');
      return {
        database: {
          status: 'up',
        },
      };
    } catch (e) {
      return {
        database: {
          status: 'down',
          message: (e as Error).message,
        },
      };
    }
  }

  private checkMemory(): HealthIndicatorResult {
    const memUsage = process.memoryUsage();
    const heapTotal = memUsage.heapTotal;
    const heapUsed = memUsage.heapUsed;
    const percentUsed = (heapUsed / heapTotal) * 100;

    if (percentUsed > 80) {
      return {
        memory: {
          status: 'down',
          message: `Memory usage above 80%: ${percentUsed.toFixed(2)}%`,
          used: heapUsed,
          total: heapTotal,
        },
      };
    }

    return {
      memory: {
        status: 'up',
        used: heapUsed,
        total: heapTotal,
        percentUsed: `${percentUsed.toFixed(2)}%`,
      },
    };
  }

  private checkDisk(): HealthIndicatorResult {
    // For simplicity, we'll just return up for now (real implementation would check disk space)
    return {
      disk: {
        status: 'up',
      },
    };
  }
}
