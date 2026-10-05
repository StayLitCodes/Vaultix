import * as StellarSdk from '@stellar/stellar-sdk';
import { EscrowCreationService } from './escrow-creation.service';
import { EscrowCreationIntentStatus } from '../entities/escrow-creation-intent.entity';
import { PrepareEscrowCreationDto } from '../dto/create-escrow-intent.dto';

describe('EscrowCreationService', () => {
  const sourceAddress = StellarSdk.Keypair.random().publicKey();
  const counterpartyAddress = StellarSdk.Keypair.random().publicKey();
  const payload: PrepareEscrowCreationDto = {
    intentId: '55f96cac-830a-4ee6-8a92-a1fb8bd934ac',
    title: 'Integration escrow',
    description: 'An escrow prepared for exact transaction signing.',
    category: 'service',
    amount: '1.0000001',
    asset: 'XLM',
    counterpartyAddress,
    deadline: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
    milestones: [
      { description: 'First delivery', amount: '0.4' },
      { description: 'Final delivery', amount: '0.6000001' },
    ],
    conditions: [],
  };

  let service: EscrowCreationService;
  let savedIntent: any;
  let intentRepository: any;
  let escrowOperations: any;
  let stellarService: any;
  let rpc: any;

  beforeEach(() => {
    process.env.STELLAR_CONTRACT_ID = StellarSdk.StrKey.encodeContract(
      Buffer.alloc(32, 2),
    );
    process.env.STELLAR_NATIVE_TOKEN_CONTRACT_ID =
      StellarSdk.StrKey.encodeContract(Buffer.alloc(32, 3));
    savedIntent = null;
    intentRepository = {
      findOne: jest.fn(() => Promise.resolve(savedIntent)),
      create: jest.fn((value) => value),
      save: jest.fn((value) => {
        savedIntent = value;
        return value;
      }),
    };
    rpc = {};
    stellarService = { buildTransaction: jest.fn().mockResolvedValue({}) };
    escrowOperations = {
      createEscrowInitializationOps: jest.fn().mockReturnValue([]),
    };
    const sorobanClient = {
      getRpc: () => rpc,
      prepareTransaction: jest.fn().mockResolvedValue('unsigned-envelope-xdr'),
    };
    const userRepository = {
      findOne: jest.fn().mockResolvedValue({ id: 'counterparty-user' }),
    };
    const assetRepository = {
      findOne: jest
        .fn()
        .mockResolvedValue({ code: 'XLM', issuer: null, decimals: 7 }),
    };
    const escrowRepository = {};
    const escrowService = {};
    service = new EscrowCreationService(
      intentRepository,
      escrowRepository,
      userRepository,
      assetRepository,
      escrowService as any,
      stellarService,
      sorobanClient as any,
      escrowOperations,
      { networkPassphrase: 'Test SDF Network ; September 2015' } as any,
    );
  });

  afterEach(() => jest.restoreAllMocks());

  it('prepares exact milestone units and reuses the same chain ID for an intent retry', async () => {
    const first = await service.prepare(payload, 'creator-user', sourceAddress);
    const second = await service.prepare(
      payload,
      'creator-user',
      sourceAddress,
    );

    expect(first).toEqual(second);
    expect(first.unsignedXdr).toBe('unsigned-envelope-xdr');
    expect(first.chainEscrowId).toBe(savedIntent.chainEscrowId);
    expect(escrowOperations.createEscrowInitializationOps).toHaveBeenCalledWith(
      first.chainEscrowId,
      sourceAddress,
      counterpartyAddress,
      expect.any(String),
      [
        { id: 0, amount: '0.4', description: 'First_delivery' },
        { id: 1, amount: '0.6000001', description: 'Final_delivery' },
      ],
      expect.any(Number),
      expect.any(String),
      7,
    );
    expect(savedIntent.status).toBe(EscrowCreationIntentStatus.PREPARED);
  });

  it('rejects fractional milestone totals that do not conserve the escrow amount', async () => {
    const invalid = {
      ...payload,
      milestones: [{ description: 'Only part', amount: '0.4' }],
    };

    await expect(
      service.prepare(invalid, 'creator-user', sourceAddress),
    ).rejects.toThrow(
      'Milestone amounts must add up exactly to the escrow total',
    );
    expect(stellarService.buildTransaction).not.toHaveBeenCalled();
    expect(intentRepository.save).not.toHaveBeenCalled();
  });

  it('reuses a signed intent after an ambiguous response and persists only after confirmation', async () => {
    const keypair = StellarSdk.Keypair.random();
    const signedTransaction = new StellarSdk.TransactionBuilder(
      new StellarSdk.Account(keypair.publicKey(), '1'),
      { fee: '100', networkPassphrase: 'Test SDF Network ; September 2015' },
    )
      .addOperation(
        StellarSdk.Operation.manageData({
          name: 'creation-intent',
          value: '1',
        }),
      )
      .setTimeout(30)
      .build();
    signedTransaction.sign(keypair);
    const signedXdr = signedTransaction.toXDR();
    const hash = signedTransaction.hash().toString('hex');
    savedIntent = {
      id: payload.intentId,
      creatorId: 'creator-user',
      sourceAddress: keypair.publicKey(),
      chainEscrowId: '9001',
      payload: {
        ...payload,
        milestones: payload.milestones,
        conditions: payload.conditions,
      },
      unsignedXdr: 'prepared-xdr',
      status: EscrowCreationIntentStatus.PREPARED,
    };
    const createEscrow = jest.fn().mockResolvedValue({ id: 'db-escrow-id' });
    (service as any).escrowService = { create: createEscrow };
    (service as any).escrowRepository = {
      findOne: jest.fn().mockResolvedValue(null),
      update: jest.fn().mockResolvedValue(undefined),
    };
    let reads = 0;
    rpc.getTransaction = jest.fn(() => {
      reads += 1;
      return Promise.resolve(
        reads === 1
          ? { status: StellarSdk.rpc.Api.GetTransactionStatus.NOT_FOUND }
          : { status: StellarSdk.rpc.Api.GetTransactionStatus.SUCCESS },
      );
    });
    rpc.sendTransaction = jest
      .fn()
      .mockResolvedValue({ status: 'PENDING', hash });

    const settled = await service.submit(
      payload.intentId,
      signedXdr,
      'creator-user',
      keypair.publicKey(),
    );
    const retried = await service.submit(
      payload.intentId,
      signedXdr,
      'creator-user',
      keypair.publicKey(),
    );

    expect(settled).toEqual({
      escrowId: 'db-escrow-id',
      transactionHash: hash,
      status: 'confirmed',
    });
    expect(retried).toEqual(settled);
    expect(rpc.sendTransaction).toHaveBeenCalledTimes(1);
    expect(createEscrow).toHaveBeenCalledTimes(1);
    expect(savedIntent.status).toBe(EscrowCreationIntentStatus.CONFIRMED);
  });
});
