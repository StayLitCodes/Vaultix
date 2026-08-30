import { TypeOrmHealthIndicator } from '@nestjs/terminus';
import { EscrowGateway } from '../../gateways/escrow.gateway';
import { Controller, Get, Logger, VERSION_NEUTRAL } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  HealthCheck,
  HealthCheckService,
  HealthCheckResult,
  HealthCheckError,
  HealthIndicatorResult,
} from '@nestjs/terminus';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../user/entities/user.entity';
import { Escrow, EscrowStatus } from '../escrow/entities/escrow.entity';
import { StellarService } from '../../services/stellar.service';
import { EmailService } from '../../email/email.service';
import { IpfsProviderService } from '../ipfs/services/ipfs-provider.service';

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

type DependencyStatus = 'up' | 'down';

interface DependencyHealth {
  status: DependencyStatus;
  responseTimeMs?: number;
  configured?: boolean;
  error?: string;
}

interface OverallHealthResponse {
  status: 'ok' | 'degraded';
  timestamp: string;
  version: string;
  uptime: number;
  dependencies: {
    database: DependencyHealth;
    stellar: DependencyHealth;
    ipfs: DependencyHealth;
    websocket: DependencyHealth;
    email: DependencyHealth;
  };
}

interface LivenessResponse {
  status: 'ok';
  timestamp: string;
  version: string;
  uptime: number;
}

// Version-neutral so orchestrator probes can hit /health directly
@Controller({ path: 'health', version: VERSION_NEUTRAL })
export class HealthController {
  private readonly logger = new Logger(HealthController.name);
  private readonly checkTimeoutMs: number;

  constructor(
    private health: HealthCheckService,
    private readonly typeOrmHealthIndicator: TypeOrmHealthIndicator,
    private readonly stellarService: StellarService,
    private readonly escrowGateway: EscrowGateway,
    private readonly emailService: EmailService,
    private readonly ipfsProviderService: IpfsProviderService,
    private readonly configService: ConfigService,
    @InjectRepository(User)
    private userRepository: Repository<User>,
    @InjectRepository(Escrow)
    private escrowRepository: Repository<Escrow>,
  ) {
    this.checkTimeoutMs = this.configService.get<number>(
      'HEALTH_CHECK_TIMEOUT_MS',
      5000,
    );
  }

  /**
   * Overall health: always returns 200 with per-dependency statuses.
   * `status` is 'degraded' when any dependency is down.
   */
  @Get()
  async overall(): Promise<OverallHealthResponse> {
    const [database, stellar, ipfs, websocket, email] = await Promise.all([
      this.probeDatabase(),
      this.probeStellar(),
      this.probeIpfs(),
      Promise.resolve(this.probeWebSocket()),
      this.probeEmail(),
    ]);

    const dependencies = { database, stellar, ipfs, websocket, email };
    const degraded = Object.values(dependencies).some(
      (dependency) => dependency.status === 'down',
    );

    return {
      status: degraded ? 'degraded' : 'ok',
      timestamp: new Date().toISOString(),
      version: this.getVersion(),
      uptime: process.uptime(),
      dependencies,
    };
  }

  /**
   * Liveness probe: responds immediately without touching any dependency.
   */
  @Get('live')
  live(): LivenessResponse {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
      version: this.getVersion(),
      uptime: process.uptime(),
    };
  }

  /**
   * Readiness probe: fails (503) when a required dependency is unreachable.
   */
  @Get('ready')
  @HealthCheck()
  async ready(): Promise<HealthCheckResult> {
    return this.health.check([
      () => this.checkDatabase(),
      () => this.checkStellar(),
      () => this.checkIpfs(),
      () => this.checkWebSocket(),
      () => this.checkEmail(),
    ]);
  }

  @Get('info')
  async info(): Promise<HealthInfo> {
    const activeEscrows = await this.escrowRepository.count({
      where: { status: EscrowStatus.ACTIVE },
    });
    const totalUsers = await this.userRepository.count();

    return {
      version: this.getVersion(),
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

  private getVersion(): string {
    return process.env.npm_package_version || '0.0.1';
  }

  /**
   * Race a dependency check against the configured timeout so a hanging
   * dependency cannot stall the health endpoints.
   */
  private async withTimeout(
    check: Promise<boolean>,
    label: string,
  ): Promise<boolean> {
    let timer: NodeJS.Timeout | undefined;
    const timeout = new Promise<boolean>((resolve) => {
      timer = setTimeout(() => {
        this.logger.warn(
          `${label} health check timed out after ${this.checkTimeoutMs}ms`,
        );
        resolve(false);
      }, this.checkTimeoutMs);
    });

    try {
      return await Promise.race([check, timeout]);
    } catch (error) {
      this.logger.warn(
        `${label} health check failed: ${error instanceof Error ? error.message : String(error)}`,
      );
      return false;
    } finally {
      if (timer) {
        clearTimeout(timer);
      }
    }
  }

  private async probeDatabase(): Promise<DependencyHealth> {
    const startedAt = Date.now();
    try {
      await this.typeOrmHealthIndicator.pingCheck('database', {
        timeout: this.checkTimeoutMs,
      });
      return { status: 'up', responseTimeMs: Date.now() - startedAt };
    } catch (error) {
      return {
        status: 'down',
        responseTimeMs: Date.now() - startedAt,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  private async probeStellar(): Promise<DependencyHealth> {
    const startedAt = Date.now();
    const healthy = await this.withTimeout(
      this.stellarService.checkHealth(),
      'stellar',
    );
    return {
      status: healthy ? 'up' : 'down',
      responseTimeMs: Date.now() - startedAt,
    };
  }

  private async probeIpfs(): Promise<DependencyHealth> {
    if (!this.ipfsProviderService.isConfigured) {
      return { status: 'up', configured: false };
    }

    const startedAt = Date.now();
    const healthy = await this.withTimeout(
      this.ipfsProviderService.checkHealth(this.checkTimeoutMs),
      'ipfs',
    );
    return {
      status: healthy ? 'up' : 'down',
      configured: true,
      responseTimeMs: Date.now() - startedAt,
    };
  }

  private probeWebSocket(): DependencyHealth {
    return { status: this.escrowGateway.isHealthy() ? 'up' : 'down' };
  }

  private async probeEmail(): Promise<DependencyHealth> {
    if (!this.emailService.isConfigured) {
      return { status: 'up', configured: false };
    }

    const startedAt = Date.now();
    const healthy = await this.withTimeout(
      this.emailService.checkHealth(),
      'email',
    );
    return {
      status: healthy ? 'up' : 'down',
      configured: true,
      responseTimeMs: Date.now() - startedAt,
    };
  }

  private async checkDatabase(): Promise<HealthIndicatorResult> {
    return this.typeOrmHealthIndicator.pingCheck('database', {
      timeout: this.checkTimeoutMs,
    });
  }

  private async checkStellar(): Promise<HealthIndicatorResult> {
    const healthy = await this.withTimeout(
      this.stellarService.checkHealth(),
      'stellar',
    );
    const result: HealthIndicatorResult = {
      stellar: { status: healthy ? 'up' : 'down' },
    };
    if (!healthy) {
      throw new HealthCheckError('Stellar Horizon is unreachable', result);
    }
    return result;
  }

  private async checkIpfs(): Promise<HealthIndicatorResult> {
    // When IPFS is not configured (e.g. local dev), report up but flag it
    // so the readiness probe does not fail on an optional dependency
    if (!this.ipfsProviderService.isConfigured) {
      return {
        ipfs: {
          status: 'up',
          configured: false,
        },
      };
    }

    const healthy = await this.withTimeout(
      this.ipfsProviderService.checkHealth(this.checkTimeoutMs),
      'ipfs',
    );
    const result: HealthIndicatorResult = {
      ipfs: { status: healthy ? 'up' : 'down', configured: true },
    };
    if (!healthy) {
      throw new HealthCheckError('IPFS node is unreachable', result);
    }
    return result;
  }

  private checkWebSocket(): HealthIndicatorResult {
    const healthy = this.escrowGateway.isHealthy();
    const result: HealthIndicatorResult = {
      websocket: { status: healthy ? 'up' : 'down' },
    };
    if (!healthy) {
      throw new HealthCheckError('WebSocket gateway is not running', result);
    }
    return result;
  }

  private async checkEmail(): Promise<HealthIndicatorResult> {
    // When SMTP is not configured (e.g. local dev), report up but flag it
    // so the readiness probe does not fail on an optional dependency.
    // SMTP outages never fail readiness because email delivery is queued
    // through the outbox and retried.
    if (!this.emailService.isConfigured) {
      return {
        email: {
          status: 'up',
          configured: false,
        },
      };
    }

    const healthy = await this.withTimeout(
      this.emailService.checkHealth(),
      'email',
    );
    return {
      email: {
        status: healthy ? 'up' : 'down',
        configured: true,
      },
    };
  }
}
