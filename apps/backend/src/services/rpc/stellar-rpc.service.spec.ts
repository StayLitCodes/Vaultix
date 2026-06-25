import { Test, TestingModule } from '@nestjs/testing';
import { ConfigModule } from '@nestjs/config';
import { StellarRpcService } from './rpc/stellar-rpc.service';
import { StellarRpcClient } from './rpc/stellar-rpc-client.service';
import { CircuitBreaker, CircuitState } from './rpc/stellar-rpc-client.service';
import {
  StellarTimeoutError,
  StellarNetworkError,
  StellarTransactionError,
  StellarAccountError,
} from '../errors';

jest.mock('./rpc/stellar-rpc-client.service');

const mockStellarRpcClient = {
  executeWithRetry: jest.fn(),
  getCircuitState: jest.fn(),
  getFailures: jest.fn(),
  resetCircuit: jest.fn(),
};

const mockStellarRpcService = {
  onModuleInit: jest.fn(),
  getAccount: jest.fn(),
  validateAsset: jest.fn(),
  buildTransaction: jest.fn(),
  submitTransaction: jest.fn(),
  checkTransactionStatus: jest.fn(),
  getHealthStatus: jest.fn(),
  reset: jest.fn(),
};

describe('StellarRpcService', () => {
  let service: StellarRpcService;

  beforeEach(async () => {
    mockStellarRpcClient.executeWithRetry.mockClear();
    mockStellarRpcService.getAccount.mockClear();
    mockStellarRpcService.validateAsset.mockClear();
    mockStellarRpcService.buildTransaction.mockClear();
    mockStellarRpcService.submitTransaction.mockClear();
    mockStellarRpcService.checkTransactionStatus.mockClear();

    const module: TestingModule = await Test.createTestingModule({
      imports: [ConfigModule.forRoot({
        load: [stellarConfig],
      })],
      providers: [
        StellarRpcService,
        {
          provide: StellarRpcClient,
          useValue: mockStellarRpcClient,
        },
      ],
    }).compile();

    service = module.get<StellarRpcService>(StellarRpcService);
    service['rpcClient'] = mockStellarRpcClient;
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should get account successfully', async () => {
    const mockResponse = { success: true, data: { account_id: 'test-account' } };
    mockStellarRpcClient.executeWithRetry.mockResolvedValueOnce(mockResponse);

    const result = await service.getAccount('test-account');
    expect(result).toEqual(mockResponse);
    expect(mockStellarRpcClient.executeWithRetry).toHaveBeenCalledWith(
      expect.any(Function),
      'getAccount(test-account)',
    );
  });

  it('should handle account error', async () => {
    const error = new StellarAccountError('Account not found');
    const mockResponse = { success: false, error, data: null };
    mockStellarRpcClient.executeWithRetry.mockResolvedValueOnce(mockResponse);

    await expect(service.getAccount('test-account')).rejects.toThrow(StellarAccountError);
  });

  it('should validate asset successfully', async () => {
    const mockResponse = { success: true, data: { records: [{ id: 'test' }] } };
    mockStellarRpcClient.executeWithRetry.mockResolvedValueOnce(mockResponse);

    const result = await service.validateAsset('XLM', 'issuer');
    expect(result.success).toBe(true);
    expect(result.data).toEqual({ records: [{ id: 'test' }] });
  });

  it('should handle validation error', async () => {
    const error = new StellarTransactionError('Asset not found');
    const mockResponse = { success: false, error, data: null };
    mockStellarRpcClient.executeWithRetry.mockResolvedValueOnce(mockResponse);

    await expect(service.validateAsset('XYZ', 'issuer')).rejects.toThrow(StellarTransactionError);
  });

  it('should build transaction successfully', async () => {
    const mockResponse = { success: true, data: { hash: 'test-hash' } };
    mockStellarRpcClient.executeWithRetry.mockResolvedValueOnce(mockResponse);

    const result = await service.buildTransaction('source-account', []);
    expect(result.success).toBe(true);
    expect(mockStellarRpcClient.executeWithRetry).toHaveBeenCalledWith(
      expect.any(Function),
      expect.stringContaining('buildTransaction'),
    );
  });

  it('should submit transaction successfully', async () => {
    const mockResponse = { success: true, data: { hash: 'test-hash' } };
    mockStellarRpcClient.executeWithRetry.mockResolvedValueOnce(mockResponse);

    const result = await service.submitTransaction({ hash: 'test' });
    expect(result.success).toBe(true);
    expect(mockStellarRpcClient.executeWithRetry).toHaveBeenCalledWith(
      expect.any(Function),
      expect.stringContaining('submitTransaction'),
    );
  });

  it('should check transaction status successfully', async () => {
    const mockResponse = { success: true, data: { successful: true, id: 'test' } };
    mockStellarRpcClient.executeWithRetry.mockResolvedValueOnce(mockResponse);

    const result = await service.checkTransactionStatus('test-transaction');
    expect(result.success).toBe(true);
    expect(result.data.id).toBe('test');
  });

  it('should get health status', async () => {
    const mockHealth = {
      status: 'healthy',
      timestamp: '2024-01-01T00:00:00.000Z',
      latency: 100,
    };
    mockStellarRpcService.getHealthStatus.mockResolvedValueOnce(mockHealth);

    const result = await service.getHealthStatus();
    expect(result.status).toBe('healthy');
    expect(mockStellarRpcService.getHealthStatus).toHaveBeenCalled();
  });

  it('should reset circuit', async () => {
    mockStellarRpcService.reset.mockResolvedValueOnce(undefined);
    await service.reset();
    expect(mockStellarRpcService.reset).toHaveBeenCalled();
  });
});
