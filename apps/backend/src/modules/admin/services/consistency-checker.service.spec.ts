import { ConsistencyCheckerService } from './consistency-checker.service';

describe('ConsistencyCheckerService escrow ID mapping', () => {
  const escrowService = { findOne: jest.fn() };
  const sorobanClient = { getEscrow: jest.fn() };
  const chainIds = { findByEscrowId: jest.fn(), findEscrowId: jest.fn() };
  let service: ConsistencyCheckerService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new ConsistencyCheckerService(
      escrowService as any,
      sorobanClient as any,
      chainIds as any,
    );
  });

  it('looks up chain state with exact decimal u64 and resolves its UUID mapping', async () => {
    const chainId = '9007199254740993';
    chainIds.findEscrowId.mockResolvedValue(
      '123e4567-e89b-12d3-a456-426614174000',
    );
    escrowService.findOne.mockResolvedValue(null);
    sorobanClient.getEscrow.mockResolvedValue({
      status: 'Active',
      amount: '1',
    });

    const result = await service.checkConsistency({ escrowIds: [chainId] });

    expect(sorobanClient.getEscrow).toHaveBeenCalledWith(chainId);
    expect(escrowService.findOne).toHaveBeenCalledWith(
      '123e4567-e89b-12d3-a456-426614174000',
    );
    expect(result.reports[0].escrowId).toBe(chainId);
    expect(result.reports[0].missingInDb).toBe(true);
  });

  it('flags historical UUID records without a verifiable mapping', async () => {
    const uuid = '123e4567-e89b-12d3-a456-426614174000';
    chainIds.findByEscrowId.mockResolvedValue(null);
    const result = await service.checkConsistency({ escrowIds: [uuid] });
    expect(result.reports[0].unmappedHistorical).toBe(true);
    expect(sorobanClient.getEscrow).not.toHaveBeenCalled();
  });
});
