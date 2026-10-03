import { Test, TestingModule } from '@nestjs/testing';
import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import * as StellarSdk from '@stellar/stellar-sdk';

import { SorobanIntentService } from './soroban-intent.service';
import {
  SorobanTxIntent,
  SorobanIntentStatus,
  SorobanOperation,
} from '../entities/soroban-tx-intent.entity';
import { Escrow } from '../entities/escrow.entity';
import { PartyRole } from '../entities/party.entity';
import { StellarService } from '../../../services/stellar.service';
import { EscrowOperationsService } from '../../../services/stellar/escrow-operations';
import { SorobanClientService } from '../../../services/stellar/soroban-client.service';
import stellarConfig from '../../../config/stellar.config';

jest.mock('@stellar/stellar-sdk', () => {
  const actual = jest.requireActual('@stellar/stellar-sdk');
  return {
    ...actual,
    rpc: { ...actual.rpc, assembleTransaction: jest.fn() },
  };
});

const assembleTransaction = (
  jest.requireMock('@stellar/stellar-sdk').rpc as {
    assembleTransaction: jest.Mock;
  }
).assembleTransaction;

const CONTRACT_ID = StellarSdk.StrKey.encodeContract(Buffer.alloc(32, 3));
const NETWORK = 'Test SDF Network ; September 2015';
const USER_ID = 'user-1';
const WALLET = StellarSdk.Keypair.random().publicKey();
const SELLER_WALLET = StellarSdk.Keypair.random().publicKey();

/** A real invokeHostFunction operation, so TransactionBuilder.build() works. */
function invokeContractOp(functionName: string): StellarSdk.xdr.Operation {
  return StellarSdk.Operation.invokeHostFunction({
    func: StellarSdk.xdr.HostFunction.hostFunctionTypeInvokeContract(
      new StellarSdk.xdr.InvokeContractArgs({
        contractAddress: new StellarSdk.Address(CONTRACT_ID)
          .toScVal()
          .address(),
        functionName,
        args: [],
      }),
    ),
    auth: [],
  });
}

/**
 * The simulated auth payload is modelled rather than built from real XDR: the
 * point under test is how the service flattens whatever the SDK's simulator
 * hands back, not the SDK's own XDR codec.
 */
function authEntryFor(publicKey: string) {
  return {
    credentials: () => ({
      switch: () => ({ name: 'sorobanCredentialsAddress' }),
      address: () => ({
        address: () => ({
          switch: () => ({ name: 'scAddressTypeAccount' }),
          accountId: () =>
            Buffer.from(
              StellarSdk.Keypair.fromPublicKey(publicKey).rawPublicKey(),
            ),
        }),
      }),
    }),
  } as unknown as StellarSdk.xdr.SorobanAuthorizationEntry;
}

describe('SorobanIntentService', () => {
  let service: SorobanIntentService;
  let intentRepo: jest.Mocked<any>;
  let escrowRepo: jest.Mocked<any>;
  let stellarService: jest.Mocked<any>;
  let escrowOps: jest.Mocked<any>;
  let sorobanClient: jest.Mocked<any>;
  let simulateTransaction: jest.Mock;

  const now = () => Math.floor(Date.now() / 1000);

  beforeEach(async () => {
    simulateTransaction = jest.fn();

    // assembleTransaction needs a full RPC simulation we cannot synthesise
    // offline, so the assembly step is stubbed and verified separately.
    assembleTransaction.mockReset();
    assembleTransaction.mockReturnValue({
      build: () => ({
        fee: '200',
        toXDR: () => 'AAAA-BASE64-XDR',
      }),
    });

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SorobanIntentService,
        {
          provide: stellarConfig.KEY,
          useValue: { networkPassphrase: NETWORK },
        },
        {
          provide: StellarService,
          useValue: {
            getAccount: jest
              .fn()
              .mockResolvedValue({ sequenceNumber: () => '42' }),
          },
        },
        {
          provide: EscrowOperationsService,
          useValue: {
            createEscrowInitializationOps: jest
              .fn()
              .mockReturnValue([invokeContractOp('create_escrow')]),
            createFundingOps: jest
              .fn()
              .mockReturnValue([invokeContractOp('deposit_funds')]),
          },
        },
        {
          provide: SorobanClientService,
          useValue: {
            getContractId: jest.fn().mockReturnValue(CONTRACT_ID),
            getRpc: jest.fn().mockReturnValue({ simulateTransaction }),
            decodeContractError: jest.fn(
              (code: number) => `contract error ${code}`,
            ),
          },
        },
        {
          provide: getRepositoryToken(SorobanTxIntent),
          useValue: mockIntentRepo(),
        },
        { provide: getRepositoryToken(Escrow), useValue: mockEscrowRepo() },
      ],
    }).compile();

    service = module.get(SorobanIntentService);
    intentRepo = module.get(getRepositoryToken(SorobanTxIntent));
    escrowRepo = module.get(getRepositoryToken(Escrow));
    stellarService = module.get(StellarService);
    escrowOps = module.get(EscrowOperationsService);
    sorobanClient = module.get(SorobanClientService);
  });

  function mockIntentRepo() {
    return {
      create: jest.fn((data) => ({ ...data, id: 'intent-1' })),
      save: jest.fn((entity) => Promise.resolve(entity)),
      findOne: jest.fn(),
      update: jest.fn().mockResolvedValue({ affected: 1 }),
    };
  }

  function mockEscrowRepo() {
    const existsQuery = chainable({
      getExists: jest.fn().mockResolvedValue(true),
    });
    const maxQuery = chainable({
      getRawOne: jest.fn().mockResolvedValue({ maxId: '7' }),
    });
    return {
      findOne: jest.fn(),
      update: jest.fn().mockResolvedValue({ affected: 1 }),
      createQueryBuilder: jest.fn((alias: string) =>
        alias === 'party' ? existsQuery : maxQuery,
      ),
      __existsQuery: existsQuery,
      __maxQuery: maxQuery,
    };
  }

  /** A query-builder stub where every builder call is chainable. */
  function chainable(terminals: Record<string, jest.Mock>) {
    const builder: Record<string, unknown> = { ...terminals };
    for (const name of [
      'innerJoin',
      'where',
      'andWhere',
      'select',
      'orderBy',
      'limit',
    ]) {
      builder[name] = jest.fn(() => builder);
    }
    return builder;
  }

  function fullEscrow(overrides: Partial<Escrow> = {}): Escrow {
    return {
      id: 'escrow-1',
      metadataHash: 'a'.repeat(64),
      amount: '100000000',
      assetCode: 'XLM',
      expiresAt: new Date((now() + 86400) * 1000),
      parties: [
        { role: PartyRole.BUYER, user: { walletAddress: WALLET } },
        { role: PartyRole.SELLER, user: { walletAddress: SELLER_WALLET } },
      ],
      conditions: [],
      ...overrides,
    } as unknown as Escrow;
  }

  function successSimulation(authPublicKey = WALLET) {
    return {
      id: '1',
      latestLedger: 555,
      events: [],
      minResourceFee: '1200',
      transactionData: {} as StellarSdk.SorobanDataBuilder,
      result: {
        auth: [authEntryFor(authPublicKey)],
        retval: StellarSdk.xdr.ScVal.scvVoid(),
      },
    } as unknown as StellarSdk.rpc.Api.SimulateTransactionSuccessResponse;
  }

  describe('prepare', () => {
    it('returns a wallet-signable envelope bound to the caller and escrow', async () => {
      simulateTransaction.mockResolvedValue(successSimulation());
      escrowRepo.findOne.mockResolvedValue(fullEscrow());

      const result = await service.prepare(fullEscrow(), USER_ID, WALLET, {
        operation: SorobanOperation.CREATE_ESCROW,
      });

      expect(result.intentId).toBe('intent-1');
      expect(result.unsignedXdr).toBe('AAAA-BASE64-XDR');
      expect(result.contractId).toBe(CONTRACT_ID);
      expect(result.networkPassphrase).toBe(NETWORK);
      expect(result.sourceAccount).toBe(WALLET);
      expect(result.escrowId).toBe('escrow-1');
      // assembled fee folds the simulated resource fee into the classic fee
      expect(result.feeStroops).toBe('200');
      expect(result.resourceFeeStroops).toBe('1200');
      expect(result.simulatedAtLedger).toBe('555');
    });

    it('never exposes a secret key', async () => {
      simulateTransaction.mockResolvedValue(successSimulation());
      escrowRepo.findOne.mockResolvedValue(fullEscrow());

      const result = await service.prepare(fullEscrow(), USER_ID, WALLET, {
        operation: SorobanOperation.CREATE_ESCROW,
      });

      const serialised = JSON.stringify(result);
      expect(serialised).not.toMatch(/secret/i);
      expect(serialised).not.toMatch(/private/i);
      expect(Object.keys(result)).not.toContain('seed');
    });

    it('allocates and persists a u64 on-chain id for contract creation', async () => {
      simulateTransaction.mockResolvedValue(successSimulation());
      escrowRepo.findOne.mockResolvedValue(fullEscrow());

      const result = await service.prepare(fullEscrow(), USER_ID, WALLET, {
        operation: SorobanOperation.CREATE_ESCROW,
      });

      expect(result.onChainEscrowId).toBe('8');
      expect(escrowOps.createEscrowInitializationOps).toHaveBeenCalledWith(
        '8',
        WALLET,
        expect.any(String),
        expect.any(String),
        expect.any(Array),
        expect.any(Number),
        expect.any(String),
      );
    });

    it('reuses an already allocated on-chain id rather than minting a new one', async () => {
      simulateTransaction.mockResolvedValue(successSimulation());
      escrowRepo.findOne.mockResolvedValue(fullEscrow());

      const result = await service.prepare(
        fullEscrow({ onChainId: '42' }),
        USER_ID,
        WALLET,
        { operation: SorobanOperation.CREATE_ESCROW },
      );

      expect(result.onChainEscrowId).toBe('42');
      expect(escrowRepo.createQueryBuilder).not.toHaveBeenCalledWith('escrow');
    });

    it('orders the numeric max as a number, not lexically', async () => {
      simulateTransaction.mockResolvedValue(successSimulation());
      escrowRepo.findOne.mockResolvedValue(fullEscrow());
      escrowRepo.__maxQuery.getRawOne.mockResolvedValue({ maxId: '9' });

      const result = await service.prepare(fullEscrow(), USER_ID, WALLET, {
        operation: SorobanOperation.CREATE_ESCROW,
      });

      // '10' must beat '9'; a plain MAX() on a text column would hand back 9.
      expect(result.onChainEscrowId).toBe('10');
    });

    it('surfaces the addresses a wallet must authorize', async () => {
      const other = StellarSdk.Keypair.random().publicKey();
      simulateTransaction.mockResolvedValue(successSimulation(other));
      escrowRepo.findOne.mockResolvedValue(fullEscrow());

      const result = await service.prepare(fullEscrow(), USER_ID, WALLET, {
        operation: SorobanOperation.CREATE_ESCROW,
      });

      expect(result.authRequirements).toEqual([
        { type: 'sorobanCredentialsAddress', address: other },
      ]);
    });

    it('bakes in a finite absolute time window, not a doubled epoch', async () => {
      simulateTransaction.mockResolvedValue(successSimulation());
      escrowRepo.findOne.mockResolvedValue(fullEscrow());

      const result = await service.prepare(fullEscrow(), USER_ID, WALLET, {
        operation: SorobanOperation.CREATE_ESCROW,
      });

      expect(result.timeBounds.minTime).toBe(0);
      expect(result.timeBounds.maxTime).toBeGreaterThan(now());
      expect(result.timeBounds.maxTime).toBeLessThanOrEqual(now() + 601);
    });

    it('caps the server-side intent TTL below the transaction window', async () => {
      simulateTransaction.mockResolvedValue(successSimulation());
      escrowRepo.findOne.mockResolvedValue(fullEscrow());

      const result = await service.prepare(fullEscrow(), USER_ID, WALLET, {
        operation: SorobanOperation.CREATE_ESCROW,
      });

      const expiresAt = Math.floor(new Date(result.expiresAt).getTime() / 1000);
      expect(expiresAt).toBeLessThan(result.timeBounds.maxTime);
      expect(expiresAt).toBeLessThanOrEqual(now() + 301);
    });

    it('supersedes an outstanding intent for the same operation', async () => {
      simulateTransaction.mockResolvedValue(successSimulation());
      escrowRepo.findOne.mockResolvedValue(fullEscrow());

      await service.prepare(fullEscrow(), USER_ID, WALLET, {
        operation: SorobanOperation.CREATE_ESCROW,
      });

      expect(intentRepo.update).toHaveBeenCalledWith(
        {
          escrowId: 'escrow-1',
          userId: USER_ID,
          operation: SorobanOperation.CREATE_ESCROW,
          status: SorobanIntentStatus.PENDING,
        },
        { status: SorobanIntentStatus.EXPIRED },
      );
    });

    it('funds an already created escrow using its on-chain id', async () => {
      simulateTransaction.mockResolvedValue(successSimulation());
      escrowRepo.findOne.mockResolvedValue(fullEscrow({ onChainId: '12' }));

      const result = await service.prepare(
        fullEscrow({ onChainId: '12' }),
        USER_ID,
        WALLET,
        { operation: SorobanOperation.DEPOSIT_FUNDS },
      );

      expect(escrowOps.createFundingOps).toHaveBeenCalledWith('12');
      expect(result.operation).toBe(SorobanOperation.DEPOSIT_FUNDS);
    });

    it('refuses to fund an escrow with no on-chain id', async () => {
      await expect(
        service.prepare(fullEscrow(), USER_ID, WALLET, {
          operation: SorobanOperation.DEPOSIT_FUNDS,
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(simulateTransaction).not.toHaveBeenCalled();
    });

    it('rejects a malformed source account', async () => {
      await expect(
        service.prepare(fullEscrow(), USER_ID, WALLET, {
          operation: SorobanOperation.CREATE_ESCROW,
          sourceAccount: 'not-a-public-key',
        }),
      ).rejects.toThrow('Invalid source account');
    });

    it('refuses to simulate on behalf of an unrelated account', async () => {
      escrowRepo.__existsQuery.getExists.mockResolvedValue(false);

      await expect(
        service.prepare(fullEscrow(), USER_ID, WALLET, {
          operation: SorobanOperation.CREATE_ESCROW,
          sourceAccount: StellarSdk.Keypair.random().publicKey(),
        }),
      ).rejects.toBeInstanceOf(ForbiddenException);
      expect(simulateTransaction).not.toHaveBeenCalled();
    });

    it('allows a party on the escrow to be the source account', async () => {
      simulateTransaction.mockResolvedValue(successSimulation());
      const seller = (fullEscrow().parties as any).find(
        (p: any) => p.role === PartyRole.SELLER,
      ).user.walletAddress;
      escrowRepo.findOne.mockResolvedValue(fullEscrow());

      const result = await service.prepare(fullEscrow(), USER_ID, WALLET, {
        operation: SorobanOperation.CREATE_ESCROW,
        sourceAccount: seller,
      });

      expect(result.sourceAccount).toBe(seller);
    });

    it('reports a decoded contract error rather than raw XDR', async () => {
      simulateTransaction.mockResolvedValue({
        id: '1',
        latestLedger: 555,
        events: [],
        error: 'HostError: Error(Contract, #12)',
      } as unknown as StellarSdk.rpc.Api.SimulateTransactionErrorResponse);
      escrowRepo.findOne.mockResolvedValue(fullEscrow());

      await expect(
        service.prepare(fullEscrow(), USER_ID, WALLET, {
          operation: SorobanOperation.CREATE_ESCROW,
        }),
      ).rejects.toThrow('contract error 12 (code 12)');
    });

    it('reports an insufficient-resources simulation failure', async () => {
      simulateTransaction.mockResolvedValue({
        id: '1',
        latestLedger: 555,
        events: [],
        error: 'HostError: Error(Storage, #1) insufficient resources',
      } as unknown as StellarSdk.rpc.Api.SimulateTransactionErrorResponse);
      escrowRepo.findOne.mockResolvedValue(fullEscrow());

      await expect(
        service.prepare(fullEscrow(), USER_ID, WALLET, {
          operation: SorobanOperation.CREATE_ESCROW,
        }),
      ).rejects.toThrow(/insufficient resources/i);
    });

    it('rejects a simulation that produced no invocation result', async () => {
      simulateTransaction.mockResolvedValue({
        id: '1',
        latestLedger: 555,
        events: [],
        minResourceFee: '10',
        transactionData: {} as StellarSdk.SorobanDataBuilder,
      } as unknown as StellarSdk.rpc.Api.SimulateTransactionSuccessResponse);
      escrowRepo.findOne.mockResolvedValue(fullEscrow());

      await expect(
        service.prepare(fullEscrow(), USER_ID, WALLET, {
          operation: SorobanOperation.CREATE_ESCROW,
        }),
      ).rejects.toThrow('no invocation result');
    });

    it('rejects a contract that is not configured', async () => {
      sorobanClient.getContractId.mockReturnValue('');

      await expect(
        service.prepare(fullEscrow(), USER_ID, WALLET, {
          operation: SorobanOperation.CREATE_ESCROW,
        }),
      ).rejects.toThrow('not configured');
    });

    it('rejects an escrow missing the metadata hash the contract needs', async () => {
      await expect(
        service.prepare(
          fullEscrow({ metadataHash: undefined }),
          USER_ID,
          WALLET,
          {
            operation: SorobanOperation.CREATE_ESCROW,
          },
        ),
      ).rejects.toThrow('metadataHash');
    });
  });

  describe('assertUsable', () => {
    const stored = (overrides: Partial<SorobanTxIntent> = {}) =>
      ({
        id: 'intent-1',
        userId: USER_ID,
        escrowId: 'escrow-1',
        contractId: CONTRACT_ID,
        networkPassphrase: NETWORK,
        status: SorobanIntentStatus.PENDING,
        expiresAt: new Date(Date.now() + 60_000),
        ...overrides,
      }) as SorobanTxIntent;

    it('accepts a fresh intent owned by the caller', async () => {
      intentRepo.findOne.mockResolvedValue(stored());

      await expect(
        service.assertUsable('intent-1', USER_ID),
      ).resolves.toMatchObject({
        id: 'intent-1',
      });
    });

    it('does not disclose an intent belonging to another user', async () => {
      intentRepo.findOne.mockResolvedValue(stored({ userId: 'someone-else' }));

      await expect(
        service.assertUsable('intent-1', USER_ID),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('rejects an intent prepared for another network or contract', async () => {
      intentRepo.findOne.mockResolvedValue(stored({ contractId: 'COTHER' }));

      await expect(service.assertUsable('intent-1', USER_ID)).rejects.toThrow(
        'different network or contract',
      );
    });

    it('rejects and marks expired an intent past its TTL', async () => {
      const expired = stored({ expiresAt: new Date(Date.now() - 1000) });
      intentRepo.findOne.mockResolvedValue(expired);

      await expect(service.assertUsable('intent-1', USER_ID)).rejects.toThrow(
        'expired',
      );
      expect(intentRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ status: SorobanIntentStatus.EXPIRED }),
      );
    });

    it('rejects an intent that was already submitted', async () => {
      intentRepo.findOne.mockResolvedValue(
        stored({ status: SorobanIntentStatus.SUBMITTED }),
      );

      await expect(service.assertUsable('intent-1', USER_ID)).rejects.toThrow(
        'already submitted',
      );
    });

    it('404s an unknown intent', async () => {
      intentRepo.findOne.mockResolvedValue(null);

      await expect(
        service.assertUsable('nope', USER_ID),
      ).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('findOne', () => {
    it('scopes lookups to the owning user', async () => {
      intentRepo.findOne.mockResolvedValue(null);

      await expect(
        service.findOne('intent-1', 'other-user'),
      ).rejects.toBeInstanceOf(NotFoundException);
    });
  });
});
