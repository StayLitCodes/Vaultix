import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { IpfsService } from './ipfs.service';
import { IpfsProviderService } from './services/ipfs-provider.service';
import { Escrow } from '../escrow/entities/escrow.entity';
import { computeMetadataHash } from './utils/metadata-hash.util';
import ipfsConfig from '../../config/ipfs.config';

describe('IpfsService', () => {
  let service: IpfsService;
  let providerService: IpfsProviderService;
  let escrowRepository: Repository<Escrow>;

  const mockEscrowRepository = {
    findOne: jest.fn(),
    save: jest.fn(),
  };

  const mockProviderService = {
    pinJson: jest.fn(),
    getJson: jest.fn(),
  };

  const mockConfig = {
    provider: 'pinata',
    pinataJwt: 'test-jwt',
    gatewayUrl: 'https://gateway.pinata.cloud/ipfs/',
    localNodeUrl: 'http://localhost:5001',
    maxRetries: 1,
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        IpfsService,
        {
          provide: getRepositoryToken(Escrow),
          useValue: mockEscrowRepository,
        },
        {
          provide: IpfsProviderService,
          useValue: mockProviderService,
        },
        {
          provide: ipfsConfig.KEY,
          useValue: mockConfig,
        },
      ],
    }).compile();

    service = module.get<IpfsService>(IpfsService);
    providerService = module.get<IpfsProviderService>(IpfsProviderService);
    escrowRepository = module.get<Repository<Escrow>>(
      getRepositoryToken(Escrow),
    );
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('pinMetadata', () => {
    it('should pin metadata to IPFS and update escrow', async () => {
      const escrowId = 'test-escrow-id';
      const mockEscrow = {
        id: escrowId,
        parties: [
          { role: 'buyer', userId: 'buyer-1' },
          { role: 'seller', userId: 'seller-1' },
        ],
        conditions: [
          { description: 'Condition 1', type: 'delivery', isFulfilled: false },
        ],
        amount: 100,
        assetCode: 'XLM',
        expiresAt: new Date('2026-12-31'),
        status: 'active',
        ipfsVersion: 0,
      };

      mockEscrowRepository.findOne.mockResolvedValue(mockEscrow);
      mockProviderService.pinJson.mockResolvedValue('test-cid');
      mockEscrowRepository.save.mockResolvedValue({
        ...mockEscrow,
        ipfsCid: 'test-cid',
        ipfsMetadataHash: 'test-hash',
        ipfsVersion: 1,
      });

      const result = await service.pinMetadata(escrowId, {});

      expect(result).toEqual({
        cid: 'test-cid',
        metadataHash: expect.any(String),
      });
      expect(mockProviderService.pinJson).toHaveBeenCalled();
      expect(mockEscrowRepository.save).toHaveBeenCalled();
    });

    it('should throw error when escrow not found', async () => {
      mockEscrowRepository.findOne.mockResolvedValue(null);

      await expect(service.pinMetadata('non-existent', {})).rejects.toThrow(
        'IPFS metadata pinning failed',
      );
    });
  });

  describe('getMetadata', () => {
    it('should retrieve metadata from IPFS', async () => {
      const escrowId = 'test-escrow-id';
      const mockEscrow = {
        id: escrowId,
        ipfsCid: 'test-cid',
      };

      const mockMetadata = {
        escrowId,
        buyer: 'buyer-1',
        seller: 'seller-1',
        amount: '100',
        asset: 'XLM',
        conditions: [],
        deadline: '2026-12-31',
        status: 'active',
        timestamp: new Date().toISOString(),
        version: 1,
      };

      mockEscrowRepository.findOne.mockResolvedValue(mockEscrow);
      mockProviderService.getJson.mockResolvedValue(mockMetadata);

      const result = await service.getMetadata(escrowId);

      expect(result).toEqual(mockMetadata);
      expect(mockProviderService.getJson).toHaveBeenCalledWith('test-cid');
    });

    it('should throw error when no IPFS metadata found', async () => {
      mockEscrowRepository.findOne.mockResolvedValue({
        id: 'test-escrow-id',
        ipfsCid: null,
      });

      await expect(service.getMetadata('test-escrow-id')).rejects.toThrow(
        'Failed to retrieve IPFS metadata',
      );
    });
  });

  describe('verifyMetadata', () => {
    it('should verify metadata hash is valid', async () => {
      const escrowId = 'test-escrow-id';
      const mockMetadata = {
        escrowId,
        buyer: 'buyer-1',
        seller: 'seller-1',
        amount: '100',
        asset: 'XLM',
        conditions: [],
        deadline: '2026-12-31',
        status: 'active',
        timestamp: new Date().toISOString(),
        version: 1,
      };

      const metadataHash = computeMetadataHash(mockMetadata);

      mockEscrowRepository.findOne.mockResolvedValue({
        id: escrowId,
        ipfsCid: 'test-cid',
        ipfsMetadataHash: metadataHash,
      });
      mockProviderService.getJson.mockResolvedValue(mockMetadata);

      const result = await service.verifyMetadata(escrowId);

      expect(result.isValid).toBe(true);
      expect(result.computedHash).toBe(metadataHash);
      expect(result.storedHash).toBe(metadataHash);
    });

    it('should return invalid when hash mismatch', async () => {
      const escrowId = 'test-escrow-id';
      const mockMetadata = {
        escrowId,
        buyer: 'buyer-1',
        amount: '100',
      };

      mockEscrowRepository.findOne.mockResolvedValue({
        id: escrowId,
        ipfsCid: 'test-cid',
        ipfsMetadataHash: 'wrong-hash',
      });
      mockProviderService.getJson.mockResolvedValue(mockMetadata);

      const result = await service.verifyMetadata(escrowId);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Hash mismatch detected');
    });
  });

  describe('getGatewayUrl', () => {
    it('should return correct gateway URL', () => {
      const cid = 'test-cid';
      const url = service.getGatewayUrl(cid);

      expect(url).toBe('https://gateway.pinata.cloud/ipfs/test-cid');
    });
  });
});
