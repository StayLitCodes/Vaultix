import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConsistencyCheckerService } from '../src/modules/admin/services/consistency-checker.service';
import { Escrow, EscrowStatus } from '../src/modules/escrow/entities/escrow.entity';
import { ConsistencyReport, ConsistencySeverity } from '../src/modules/admin/entities/consistency-report.entity';
import { SorobanClientService } from '../src/services/stellar/soroban-client.service';

describe('ConsistencyChecker (e2e)', () => {
  let app: INestApplication;
  let consistencyService: ConsistencyCheckerService;
  let escrowRepo: Repository<Escrow>;
  let reportRepo: Repository<ConsistencyReport>;
  let sorobanClient: SorobanClientService;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [], // Import your AppModule or relevant modules
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    consistencyService = moduleFixture.get<ConsistencyCheckerService>(
      ConsistencyCheckerService,
    );
    escrowRepo = moduleFixture.get<Repository<Escrow>>(
      getRepositoryToken(Escrow),
    );
    reportRepo = moduleFixture.get<Repository<ConsistencyReport>>(
      getRepositoryToken(ConsistencyReport),
    );
    sorobanClient = moduleFixture.get<SorobanClientService>(
      SorobanClientService,
    );
  });

  afterAll(async () => {
    await app.close();
  });

  it('should detect status mismatch between DB and on-chain', async () => {
    // Create escrow in DB with ACTIVE status
    const escrow = escrowRepo.create({
      id: 'test-escrow-1',
      title: 'Test Escrow',
      amount: 100,
      assetCode: 'XLM',
      status: EscrowStatus.ACTIVE,
      creatorId: 'test-user',
    });
    await escrowRepo.save(escrow);

    // Mock on-chain state with COMPLETED status
    jest.spyOn(sorobanClient, 'getEscrow').mockResolvedValue({
      status: 'Completed',
      amount: '100',
      depositor: 'test-user',
      recipient: 'recipient-user',
    });

    // Run consistency check
    const result = await consistencyService.checkConsistency({
      escrowIds: ['test-escrow-1'],
    });

    // Verify discrepancy detected
    expect(result.summary.totalInconsistent).toBe(1);
    expect(result.reports[0].isConsistent).toBe(false);
    expect(result.reports[0].fieldsMismatched).toContainEqual(
      expect.objectContaining({
        fieldName: 'status',
        dbValue: EscrowStatus.ACTIVE,
        onchainValue: 'Completed',
      }),
    );

    // Verify report saved
    const reports = await reportRepo.find({ where: { escrowId: 'test-escrow-1' } });
    expect(reports.length).toBeGreaterThan(0);
    expect(reports[0].severity).toBe(ConsistencySeverity.CRITICAL);
  });

  it('should detect amount mismatch', async () => {
    const escrow = escrowRepo.create({
      id: 'test-escrow-2',
      title: 'Test Escrow 2',
      amount: 100,
      assetCode: 'XLM',
      status: EscrowStatus.ACTIVE,
      creatorId: 'test-user',
    });
    await escrowRepo.save(escrow);

    jest.spyOn(sorobanClient, 'getEscrow').mockResolvedValue({
      status: 'Active',
      amount: '200',
      depositor: 'test-user',
      recipient: 'recipient-user',
    });

    const result = await consistencyService.checkConsistency({
      escrowIds: ['test-escrow-2'],
    });

    expect(result.summary.totalInconsistent).toBe(1);
    expect(result.reports[0].fieldsMismatched).toContainEqual(
      expect.objectContaining({
        fieldName: 'amount',
        dbValue: 100,
        onchainValue: '200',
      }),
    );
  });

  it('should resolve discrepancy by syncing to on-chain state', async () => {
    const escrow = escrowRepo.create({
      id: 'test-escrow-3',
      title: 'Test Escrow 3',
      amount: 100,
      assetCode: 'XLM',
      status: EscrowStatus.ACTIVE,
      creatorId: 'test-user',
    });
    await escrowRepo.save(escrow);

    jest.spyOn(sorobanClient, 'getEscrow').mockResolvedValue({
      status: 'Completed',
      amount: '100',
      depositor: 'test-user',
      recipient: 'recipient-user',
    });

    await consistencyService.checkConsistency({ escrowIds: ['test-escrow-3'] });

    // Resolve discrepancy
    await consistencyService.resolveDiscrepancy(
      'test-escrow-3',
      'admin-user',
      true,
    );

    // Verify DB updated
    const updated = await escrowRepo.findOne({ where: { id: 'test-escrow-3' } });
    expect(updated?.status).toBe(EscrowStatus.COMPLETED);

    // Verify report marked as resolved
    const reports = await reportRepo.find({
      where: { escrowId: 'test-escrow-3', resolved: true },
    });
    expect(reports.length).toBeGreaterThan(0);
  });
});
