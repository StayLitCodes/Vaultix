import { Test, TestingModuleBuilder } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { AppModule } from './../../src/app.module';
import { StellarService } from './../../src/services/stellar.service';
import { SorobanClientService } from './../../src/services/stellar/soroban-client.service';
import { StellarEventListenerService } from './../../src/modules/stellar/services/stellar-event-listener.service';
import { Keypair } from '@stellar/stellar-sdk';

const mockStellarService = {
  isValidPublicKey: (_key: string) => true,
  isValidSecretKey: (_key: string) => true,
  createKeypair: () => {
    return Keypair.random();
  },
  getAccount: jest.fn().mockResolvedValue({
    id: 'mock-account',
    sequenceNumber: () => '1',
    balances: [{ asset_type: 'native', balance: '1000000' }],
  }),
  validateAsset: jest.fn().mockResolvedValue(true),
  buildTransaction: jest.fn().mockResolvedValue({
    hash: () => Buffer.from('mock-hash-hex-code-here', 'hex'),
  }),
  submitTransaction: jest.fn().mockResolvedValue({
    hash: 'mock-tx-hash-here',
  }),
  streamTransactions: jest.fn().mockReturnValue({
    close: () => {},
  }),
  checkTransactionStatus: jest.fn().mockResolvedValue({
    successful: true,
  }),
};

const mockSorobanClientService = {
  getEscrow: jest.fn().mockResolvedValue({
    status: 'active',
    amount: '100',
    depositor: 'GD3...etc',
    recipient: 'GD4...etc',
  }),
  decodeContractError: jest.fn().mockReturnValue('MockError'),
  getContractId: jest.fn().mockReturnValue('CACVKL567TEST'),
  getRpc: jest.fn().mockReturnValue({
    getLatestLedger: jest.fn().mockResolvedValue({ sequence: 100 }),
    getEvents: jest.fn().mockResolvedValue({ events: [] }),
  }),
};

const mockStellarEventListenerService = {
  onModuleInit: jest.fn().mockResolvedValue(undefined),
  onModuleDestroy: jest.fn().mockResolvedValue(undefined),
  startEventListener: jest.fn().mockResolvedValue(undefined),
  stopEventListener: jest.fn().mockResolvedValue(undefined),
  syncFromLedger: jest.fn().mockResolvedValue(undefined),
  getSyncStatus: jest.fn().mockReturnValue({
    isRunning: false,
    lastProcessedLedger: 0,
    reconnectAttempts: 0,
  }),
};

export async function createTestApp(
  configureBuilder?: (builder: TestingModuleBuilder) => TestingModuleBuilder,
  configureApp?: (app: INestApplication) => void,
): Promise<INestApplication> {
  let builder = Test.createTestingModule({
    imports: [AppModule],
  })
    .overrideProvider(StellarService)
    .useValue(mockStellarService)
    .overrideProvider(SorobanClientService)
    .useValue(mockSorobanClientService)
    .overrideProvider(StellarEventListenerService)
    .useValue(mockStellarEventListenerService);

  if (configureBuilder) {
    builder = configureBuilder(builder);
  }

  const moduleRef = await builder.compile();

  const app = moduleRef.createNestApplication();
  if (configureApp) {
    configureApp(app);
  } else {
    app.useGlobalPipes(new ValidationPipe({ transform: true }));
  }
  await app.init();

  return app;
}
