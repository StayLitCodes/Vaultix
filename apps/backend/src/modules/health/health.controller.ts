import { Controller, Get } from '@nestjs/common';
import {
  HealthCheck,
  HealthCheckService,
  HealthIndicatorResult,
  TypeOrmHealthIndicator,
  MemoryHealthIndicator,
  DiskHealthIndicator,
  HttpHealthIndicator,
} from '@nestjs/terminus';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, IsNull } from 'typeorm';
import { Escrow } from '../escrow/entities/escrow.entity';
import { User } from '../user/entities/user.entity';
import { Notification } from '../../notifications/entities/notification.entity';

@Controller('health')
export class HealthController {
  constructor(
    private health: HealthCheckService,
    private db: TypeOrmHealthIndicator,
    private memory: MemoryHealthIndicator,
    private disk: DiskHealthIndicator,
    private http: HttpHealthIndicator,
    @InjectRepository(Escrow)
    private escrowRepository: Repository<Escrow>,
    @InjectRepository(User)
    private userRepository: Repository<User>,
    @InjectRepository(Notification)
    private notificationRepository: Repository<Notification>,
  ) {}

  @Get()
  @HealthCheck()
  check() {
    return this.health.check([
      () => this.db.pingCheck('database'),
      () => this.memory.checkHeap('memory', 150 * 1024 * 1024), // 150MB
      () =>
        this.disk.checkStorage('disk', {
          thresholdPercent: 0.1, // 10% free
          path: '/',
        }),
      async (): Promise<HealthIndicatorResult> => {
        try {
          // Ping Stellar Horizon testnet
          await this.http.pingCheck(
            'stellar',
            'https://horizon-testnet.stellar.org',
          );
          return {
            stellar: {
              status: 'up',
            },
          };
        } catch (e: unknown) {
          const errorMessage = e instanceof Error ? e.message : 'Unknown error';
          return {
            stellar: {
              status: 'down',
              message: errorMessage,
            },
          };
        }
      },
    ]);
  }

  @Get('live')
  live() {
    return { status: 'ok' };
  }

  @Get('ready')
  @HealthCheck()
  ready() {
    return this.health.check([() => this.db.pingCheck('database')]);
  }

  @Get('info')
  async info() {
    const escrowsCount = await this.escrowRepository.count();
    const usersCount = await this.userRepository.count();
    const pendingNotifications = await this.notificationRepository.count({
      where: { readAt: IsNull() },
    });

    return {
      status: 'ok',
      version: process.env.npm_package_version || '0.0.1',
      nodeVersion: process.version,
      uptime: process.uptime(),
      network: process.env.STELLAR_NETWORK || 'testnet',
      database: process.env.DATABASE_TYPE || 'sqlite',
      metrics: {
        activeEscrows: escrowsCount,
        totalUsers: usersCount,
        pendingNotifications: pendingNotifications,
      },
    };
  }
}
