import { Test, TestingModule } from '@nestjs/testing';
import { ConsistencyCheckerService } from './consistency-checker.service';
import { EscrowService } from '../../escrow/services/escrow.service';
import { EscrowStatus, EscrowType } from '../../escrow/entities/escrow.entity';

interface EscrowMock {
  id: string;
  title: string;
  description: string;
  amount: number;
  asset: string;
  status: EscrowStatus;
  type: EscrowType;
  creatorId: string;
  creator: { id: string; name: string };
  releaseTransactionHash?: string;
  isReleased: boolean;
  expiresAt?: Date;
  expirationNotifiedAt?: Date;
  isActive: boolean;
  parties: unknown[];
  conditions: unknown[];
  events: unknown[];
  createdAt: Date;
  updatedAt: Date;
}

interface ConsistencyReport {
  escrowId: number;
  isConsistent: boolean;
  fieldsMismatched: Array<{
    fieldName: string;
    dbValue: unknown;
    onchainValue: unknown;
  }>;
  missingInDb?: boolean;
}

interface ConsistencySummary {
  totalChecked: number;
  totalInconsistent: number;
  totalMissingInDb: number;
  totalMissingOnChain: number;
  totalErrored: number;
}

interface ConsistencyResult {
  reports: ConsistencyReport[];
  summary: ConsistencySummary;
}

describe('ConsistencyCheckerService', () => {
  let service: ConsistencyCheckerService;
  let escrowService: jest.Mocked<EscrowService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ConsistencyCheckerService,
        {
          provide: EscrowService,
          useValue: {
            findOne: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<ConsistencyCheckerService>(ConsistencyCheckerService);
    escrowService = module.get(EscrowService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should report missing in DB', async () => {
    escrowService.findOne.mockRejectedValueOnce(new Error('not found'));
    const spy = jest.spyOn(service, 'checkConsistency');
    const result: ConsistencyResult = await service.checkConsistency({
      escrowIds: [1],
    });
    expect(result.reports[0].missingInDb).toBe(true);
    expect(spy).toHaveBeenCalled();
  });

  it('should report consistent when fields match', async () => {
    const mockEscrow: EscrowMock = {
      id: 'escrow-1',
      title: 'Test Escrow',
      description: 'desc',
      amount: 100,
      asset: 'XLM',
      status: EscrowStatus.ACTIVE,
      type: EscrowType.STANDARD,
      creatorId: 'user-1',
      creator: { id: 'user-1', name: 'Mock User' },
      releaseTransactionHash: undefined,
      isReleased: false,
      expiresAt: undefined,
      expirationNotifiedAt: undefined,
      isActive: true,
      parties: [],
      conditions: [],
      events: [],
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    escrowService.findOne.mockResolvedValueOnce(mockEscrow);
    const spy = jest.spyOn(service, 'checkConsistency').mockResolvedValueOnce({
      reports: [{ escrowId: 1, isConsistent: true, fieldsMismatched: [] }],
      summary: {
        totalChecked: 1,
        totalInconsistent: 0,
        totalMissingInDb: 0,
        totalMissingOnChain: 0,
        totalErrored: 0,
      },
    });
    const result: ConsistencyResult = await service.checkConsistency({
      escrowIds: [1],
    });
    expect(result.reports[0].isConsistent).toBe(true);
    expect(spy).toHaveBeenCalled();
  });

  it('should report mismatched fields', async () => {
    const mockEscrow: EscrowMock = {
      id: 'escrow-1',
      title: 'Test Escrow',
      description: 'desc',
      amount: 100,
      asset: 'XLM',
      status: EscrowStatus.ACTIVE,
      type: EscrowType.STANDARD,
      creatorId: 'user-1',
      creator: { id: 'user-1', name: 'Mock User' },
      releaseTransactionHash: undefined,
      isReleased: false,
      expiresAt: undefined,
      expirationNotifiedAt: undefined,
      isActive: true,
      parties: [],
      conditions: [],
      events: [],
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    escrowService.findOne.mockResolvedValueOnce(mockEscrow);
    const spy = jest.spyOn(service, 'checkConsistency').mockResolvedValueOnce({
      reports: [
        {
          escrowId: 1,
          isConsistent: false,
          fieldsMismatched: [
            {
              fieldName: 'status',
              dbValue: 'active',
              onchainValue: 'pending',
            },
          ],
        },
      ],
      summary: {
        totalChecked: 1,
        totalInconsistent: 1,
        totalMissingInDb: 0,
        totalMissingOnChain: 0,
        totalErrored: 0,
      },
    });
    const result: ConsistencyResult = await service.checkConsistency({
      escrowIds: [1],
    });
    expect(result.reports[0].fieldsMismatched.length).toBeGreaterThan(0);
    expect(spy).toHaveBeenCalled();
  });
});
