import { Test, TestingModule } from '@nestjs/testing';
import { AdminEscrowConsistencyController } from './admin-escrow-consistency.controller';
import { ConsistencyCheckerService } from '../services/consistency-checker.service';

describe('AdminEscrowConsistencyController', () => {
  let controller: AdminEscrowConsistencyController;
  let checkerService: jest.Mocked<ConsistencyCheckerService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AdminEscrowConsistencyController],
      providers: [
        {
          provide: ConsistencyCheckerService,
          useValue: {
            checkConsistency: jest.fn(),
          },
        },
      ],
    }).compile();

    controller = module.get<AdminEscrowConsistencyController>(
      AdminEscrowConsistencyController,
    );
    checkerService = module.get(ConsistencyCheckerService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('should call checkerService.checkConsistency', async () => {
    const mockResult = {
      reports: [],
      summary: {
        totalChecked: 1,
        totalInconsistent: 0,
        totalMissingInDb: 0,
        totalMissingOnChain: 0,
        totalErrored: 0,
      },
    };
    const spy = jest
      .spyOn(checkerService, 'checkConsistency')
      .mockResolvedValueOnce(mockResult);

    const result = await controller.checkConsistency({ escrowIds: [1] });
    expect(result.summary.totalChecked).toBe(1);
    expect(spy).toHaveBeenCalledWith({ escrowIds: [1] });
  });
});
