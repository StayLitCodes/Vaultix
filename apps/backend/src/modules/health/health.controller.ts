import { TypeOrmHealthIndicator } from '@nestjs/terminus';
import { EscrowGateway } from '../../gateways/escrow.gateway';
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
import { StellarService } from '../../services/stellar.service';

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
    private readonly typeOrmHealthIndicator: TypeOrmHealthIndicator,
    private readonly stellarService: StellarService,
    private readonly escrowGateway: EscrowGateway,
    @InjectRepository(User)
    private userRepository: Repository<User>,
    @InjectRepository(Escrow)
    private escrowRepository: Repository<Escrow>,
  ) {}

  @Get()
  live(): { status: string } {
    return {
      status: 'ok',
    };
  }

  @Get('ready')
  @HealthCheck()
  async ready(): Promise<HealthCheckResult> {
    return this.health.check([
      () => this.checkDatabase(),
      () => this.checkStellar(),
      () => this.checkWebSocket(),
    ]);
  }

  private checkWebSocket(): HealthIndicatorResult {
    return {
      websocket: {
        status: this.escrowGateway.isHealthy() ? 'up' : 'down',
      },
    };
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
    return this.typeOrmHealthIndicator.pingCheck('database');
  }

  private async checkStellar(): Promise<HealthIndicatorResult> {
    const healthy = await this.stellarService.checkHealth();

    return {
      stellar: {
        status: healthy ? 'up' : 'down',
      },
    };
  }

  private checkMemory(): HealthIndicatorResult {
    const heapUsedMB = process.memoryUsage().heapUsed / 1024 / 1024;
    const thresholdMB = 512;

    if (heapUsedMB > thresholdMB) {
      return {
        memory: {
          status: 'up',
          warning: `Heap usage exceeded ${thresholdMB} MB`,
          thresholdMB,
        },
      };
    }

    return {
      memory: {
        status: 'up',
        heapUsedMB: Number(heapUsedMB.toFixed(2)),
        thresholdMB,
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
