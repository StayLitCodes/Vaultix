import { NotFoundException } from '@nestjs/common';
import { EscrowChainIdService } from './escrow-chain-id.service';
import { validateSorobanU64 } from '../utils/soroban-u64.util';
import { EscrowChainIdStatus } from '../entities/escrow-chain-id.entity';

describe('EscrowChainIdService', () => {
  const mappings: Array<Record<string, any>> = [];
  const repo = {
    findOne: jest.fn(
      ({ where }: any) =>
        mappings.find((row) =>
          Object.entries(where).every(([key, value]) => row[key] === value),
        ) || null,
    ),
    insert: jest.fn((row: Record<string, any>) => {
      if (
        mappings.some(
          (item) =>
            item.network === row.network &&
            item.contractId === row.contractId &&
            (item.escrowId === row.escrowId ||
              item.onChainId === row.onChainId),
        )
      )
        throw new Error('unique constraint');
      mappings.push({ ...row, id: `${mappings.length + 1}` });
    }),
    update: jest.fn(({ id }: any, values: any) => {
      const row = mappings.find(
        (item) =>
          item.id === id &&
          item.onChainId == null &&
          item.status === EscrowChainIdStatus.UNMAPPED,
      );
      if (!row) return { affected: 0 };
      Object.assign(row, values);
      return { affected: 1 };
    }),
  };
  const makeService = (network: string, contractId: string) => {
    process.env.STELLAR_CONTRACT_ID = contractId;
    return new EscrowChainIdService({ network } as any, repo as any);
  };

  beforeEach(() => {
    mappings.splice(0);
    jest.clearAllMocks();
    process.env.STELLAR_CONTRACT_ID = 'contract-A';
  });

  it('preserves u64 values above Number.MAX_SAFE_INTEGER as decimal strings', () => {
    const large = '18446744073709551615';
    expect(validateSorobanU64(large)).toBe(large);
    expect(() => validateSorobanU64('18446744073709551616')).toThrow(
      RangeError,
    );
    expect(() => validateSorobanU64('01')).toThrow(RangeError);
  });

  it('allocates once under concurrent requests and round-trips UUID and chain ID', async () => {
    const service = makeService('testnet', 'contract-A');
    const [first, second] = await Promise.all([
      service.allocate('escrow-uuid'),
      service.allocate('escrow-uuid'),
    ]);
    expect(first).toBe(second);
    expect(await service.requireForEscrow('escrow-uuid')).toBe(first);
    expect(await service.findEscrowId(first)).toBe('escrow-uuid');
    expect(validateSorobanU64(first)).toBe(first);
  });

  it('keeps mappings scoped by network and contract', async () => {
    const a = makeService('testnet', 'contract-A');
    const id = await a.allocate('uuid');
    process.env.STELLAR_CONTRACT_ID = 'contract-B';
    const other = makeService('testnet', 'contract-B');
    expect(await other.findEscrowId(id)).toBeNull();
    await other.allocate('uuid');
    expect(mappings).toHaveLength(2);
  });

  it('rejects historical records until a verified mapping is present', async () => {
    mappings.push({
      id: 'old',
      network: 'testnet',
      contractId: 'contract-A',
      escrowId: 'old-uuid',
      onChainId: null,
      status: EscrowChainIdStatus.UNMAPPED,
    });
    const service = makeService('testnet', 'contract-A');
    await expect(service.requireForEscrow('old-uuid')).rejects.toBeInstanceOf(
      NotFoundException,
    );
    await expect(service.allocate('old-uuid')).rejects.toThrow(
      'unmapped historical Soroban ID',
    );
  });
});
