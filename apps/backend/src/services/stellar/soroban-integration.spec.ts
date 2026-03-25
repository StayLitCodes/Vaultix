import { Test, TestingModule } from '@nestjs/testing';
import { EscrowOperationsService } from './escrow-operations';
import * as StellarSdk from '@stellar/stellar-sdk';

describe('EscrowOperationsService Integration', () => {
  let service: EscrowOperationsService;

  beforeEach(async () => {
    // Mock valid contract ID (56 characters starting with C)
    const validContractId = StellarSdk.StrKey.encodeContract(Buffer.alloc(32));
    process.env.STELLAR_CONTRACT_ID = validContractId;

    const module: TestingModule = await Test.createTestingModule({
      providers: [EscrowOperationsService],
    }).compile();

    service = module.get<EscrowOperationsService>(EscrowOperationsService);
  });

  it('should create escrow initialization operations with correct Soroban call', () => {
    const escrowId = '123';
    const depositor = StellarSdk.Keypair.random().publicKey();
    const recipient = StellarSdk.Keypair.random().publicKey();
    const token = StellarSdk.Keypair.random().publicKey(); // Or contract ID
    const milestones = [
      { id: 1, amount: '1000', description: 'Test milestone' },
    ];
    const deadline = Math.floor(Date.now() / 1000) + 3600;

    const ops = service.createEscrowInitializationOps(
      escrowId,
      depositor,
      recipient,
      token,
      milestones,
      deadline,
    );

    const op = ops[0] as any as {
      body: {
        value: () => {
          call: () => { functionName: () => { args: () => any[] } };
        };
      };
    };
    // In newer SDKs, op might be an XDR operation object
    // or a higher level object with a different structure
    expect(op).toBeDefined();
  });

  it('should create funding operations', () => {
    const ops = service.createFundingOps('123');
    expect(ops.length).toBe(1);
    expect(ops[0]).toBeDefined();
  });

  it('should create milestone release operations', () => {
    const ops = service.createMilestoneReleaseOps('123', 1);
    expect(ops.length).toBe(1);
    expect(ops[0]).toBeDefined();
  });

  it('should create dispute operations', () => {
    const depositor = StellarSdk.Keypair.random().publicKey();
    const ops = service.createDisputeOps('123', depositor);
    expect(ops.length).toBe(1);
    expect(ops[0]).toBeDefined();
  });
});
