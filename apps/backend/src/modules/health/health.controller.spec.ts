import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { TerminusModule, TypeOrmHealthIndicator } from '@nestjs/terminus';
import { getRepositoryToken } from '@nestjs/typeorm';
import { HealthController } from './health.controller';
import { StellarService } from '../../services/stellar.service';
import { EmailService } from '../../email/email.service';
import { IpfsProviderService } from '../ipfs/services/ipfs-provider.service';
import { EscrowGateway } from '../../gateways/escrow.gateway';
import { User } from '../user/entities/user.entity';
import { Escrow } from '../escrow/entities/escrow.entity';

describe('HealthController', () => {
  let controller: HealthController;

  const typeOrmHealthIndicator = {
    pingCheck: jest.fn(),
  };
  const stellarService = {
    checkHealth: jest.fn(),
  };
  const escrowGateway = {
    isHealthy: jest.fn(),
  };
  const emailService = {
    isConfigured: false,
    checkHealth: jest.fn(),
  };
  const ipfsProviderService = {
    isConfigured: true,
    checkHealth: jest.fn(),
  };
  const configService = {
    get: jest.fn(
      (_key: string, defaultValue: unknown): unknown => defaultValue,
    ),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    // Healthy defaults; individual tests override as needed
    typeOrmHealthIndicator.pingCheck.mockResolvedValue({
      database: { status: 'up' },
    });
    stellarService.checkHealth.mockResolvedValue(true);
    escrowGateway.isHealthy.mockReturnValue(true);
    ipfsProviderService.checkHealth.mockResolvedValue(true);
    ipfsProviderService.isConfigured = true;
    emailService.isConfigured = false;

    const module: TestingModule = await Test.createTestingModule({
      imports: [TerminusModule],
      controllers: [HealthController],
      providers: [
        { provide: TypeOrmHealthIndicator, useValue: typeOrmHealthIndicator },
        { provide: StellarService, useValue: stellarService },
        { provide: EscrowGateway, useValue: escrowGateway },
        { provide: EmailService, useValue: emailService },
        { provide: IpfsProviderService, useValue: ipfsProviderService },
        { provide: ConfigService, useValue: configService },
        { provide: getRepositoryToken(User), useValue: { count: jest.fn() } },
        { provide: getRepositoryToken(Escrow), useValue: { count: jest.fn() } },
      ],
    }).compile();

    controller = module.get<HealthController>(HealthController);
  });

  describe('overall (GET /health)', () => {
    it('returns ok with per-dependency statuses when everything is up', async () => {
      const result = await controller.overall();

      expect(result.status).toBe('ok');
      expect(result.timestamp).toEqual(expect.any(String));
      expect(result.version).toEqual(expect.any(String));
      expect(result.uptime).toEqual(expect.any(Number));
      expect(result.dependencies.database.status).toBe('up');
      expect(result.dependencies.stellar.status).toBe('up');
      expect(result.dependencies.ipfs.status).toBe('up');
      expect(result.dependencies.websocket.status).toBe('up');
      expect(result.dependencies.email.status).toBe('up');
      expect(result.dependencies.email.configured).toBe(false);
    });

    it('reports degraded when a dependency is down without throwing', async () => {
      stellarService.checkHealth.mockResolvedValue(false);

      const result = await controller.overall();

      expect(result.status).toBe('degraded');
      expect(result.dependencies.stellar.status).toBe('down');
      expect(result.dependencies.database.status).toBe('up');
    });

    it('reports database as down when the ping check throws', async () => {
      typeOrmHealthIndicator.pingCheck.mockRejectedValue(
        new Error('connection lost'),
      );

      const result = await controller.overall();

      expect(result.status).toBe('degraded');
      expect(result.dependencies.database.status).toBe('down');
      expect(result.dependencies.database.error).toBe('connection lost');
    });
  });

  describe('live (GET /health/live)', () => {
    it('responds without touching any dependency', () => {
      const result = controller.live();

      expect(result.status).toBe('ok');
      expect(result.timestamp).toEqual(expect.any(String));
      expect(result.version).toEqual(expect.any(String));
      expect(result.uptime).toEqual(expect.any(Number));
      expect(typeOrmHealthIndicator.pingCheck).not.toHaveBeenCalled();
      expect(stellarService.checkHealth).not.toHaveBeenCalled();
      expect(ipfsProviderService.checkHealth).not.toHaveBeenCalled();
    });
  });

  describe('ready (GET /health/ready)', () => {
    it('returns ok when all dependencies are reachable', async () => {
      const result = await controller.ready();

      expect(result.status).toBe('ok');
      expect(result.details.database.status).toBe('up');
      expect(result.details.stellar.status).toBe('up');
      expect(result.details.ipfs.status).toBe('up');
      expect(result.details.websocket.status).toBe('up');
      expect(result.details.email.status).toBe('up');
    });

    it('fails when Stellar Horizon is unreachable', async () => {
      stellarService.checkHealth.mockResolvedValue(false);

      await expect(controller.ready()).rejects.toMatchObject({
        response: expect.objectContaining({ status: 'error' }),
      });
    });

    it('fails when the configured IPFS node is unreachable', async () => {
      ipfsProviderService.checkHealth.mockResolvedValue(false);

      await expect(controller.ready()).rejects.toMatchObject({
        response: expect.objectContaining({ status: 'error' }),
      });
    });

    it('does not fail when IPFS is not configured', async () => {
      ipfsProviderService.isConfigured = false;

      const result = await controller.ready();

      expect(result.status).toBe('ok');
      expect(result.details.ipfs).toMatchObject({
        status: 'up',
        configured: false,
      });
      expect(ipfsProviderService.checkHealth).not.toHaveBeenCalled();
    });
  });

  describe('timeout handling', () => {
    it('marks a hanging dependency as down after the timeout', async () => {
      // Shrink the timeout so the test completes quickly
      configService.get.mockImplementation(
        (key: string, defaultValue: unknown): unknown =>
          key === 'HEALTH_CHECK_TIMEOUT_MS' ? 50 : defaultValue,
      );
      const module: TestingModule = await Test.createTestingModule({
        imports: [TerminusModule],
        controllers: [HealthController],
        providers: [
          {
            provide: TypeOrmHealthIndicator,
            useValue: typeOrmHealthIndicator,
          },
          { provide: StellarService, useValue: stellarService },
          { provide: EscrowGateway, useValue: escrowGateway },
          { provide: EmailService, useValue: emailService },
          { provide: IpfsProviderService, useValue: ipfsProviderService },
          { provide: ConfigService, useValue: configService },
          { provide: getRepositoryToken(User), useValue: { count: jest.fn() } },
          {
            provide: getRepositoryToken(Escrow),
            useValue: { count: jest.fn() },
          },
        ],
      }).compile();
      const timedController = module.get<HealthController>(HealthController);

      stellarService.checkHealth.mockReturnValue(
        new Promise<boolean>(() => {
          // never resolves — simulates a hanging Horizon request
        }),
      );

      const result = await timedController.overall();

      expect(result.status).toBe('degraded');
      expect(result.dependencies.stellar.status).toBe('down');
    });
  });
});
