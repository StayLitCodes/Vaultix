import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { Repository } from 'typeorm';
import { Response } from 'express';
import { EscrowEvidenceService } from './escrow-evidence.service';
import { IpfsService } from '../../ipfs/ipfs.service';
import { Dispute } from '../entities/dispute.entity';
import { Escrow } from '../entities/escrow.entity';
import { EvidenceFileMetadataDto } from '../dto/upload-evidence.dto';

describe('EscrowEvidenceService', () => {
  let service: EscrowEvidenceService;
  let disputeRepo: jest.Mocked<Repository<Dispute>>;
  let escrowRepo: jest.Mocked<Repository<Escrow>>;
  let ipfsService: jest.Mocked<IpfsService>;

  const mockEscrowId = 'escrow-123';
  const mockDisputeId = 'dispute-123';
  const mockUserId = 'user-123';
  const mockCid = 'QmAbc123...';

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EscrowEvidenceService,
        {
          provide: getRepositoryToken(Dispute),
          useValue: {
            findOne: jest.fn(),
            save: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(Escrow),
          useValue: {
            findOne: jest.fn(),
          },
        },
        {
          provide: IpfsService,
          useValue: {
            uploadFile: jest.fn(),
            getGatewayUrl: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<EscrowEvidenceService>(EscrowEvidenceService);
    disputeRepo = module.get(getRepositoryToken(Dispute));
    escrowRepo = module.get(getRepositoryToken(Escrow));
    ipfsService = module.get(IpfsService);
  });

  describe('uploadEvidence', () => {
    it('should upload files to IPFS and persist CIDs to dispute', async () => {
      // Mock files
      const files = [
        {
          buffer: Buffer.from('pdf content'),
          originalname: 'document.pdf',
          mimetype: 'application/pdf',
          size: 1024,
        } as Express.Multer.File,
        {
          buffer: Buffer.from('image content'),
          originalname: 'screenshot.png',
          mimetype: 'image/png',
          size: 2048,
        } as Express.Multer.File,
      ];

      const mockDispute: Dispute = {
        id: mockDisputeId,
        escrowId: mockEscrowId,
        evidenceFiles: [],
        reason: 'Non-delivery',
        status: 'open' as any,
        createdAt: new Date(),
        updatedAt: new Date(),
      } as Dispute;

      const mockEscrow: Escrow = {
        id: mockEscrowId,
      } as Escrow;

      escrowRepo.findOne.mockResolvedValue(mockEscrow);
      disputeRepo.findOne.mockResolvedValue(mockDispute);
      ipfsService.uploadFile.mockResolvedValueOnce(mockCid);
      ipfsService.uploadFile.mockResolvedValueOnce('QmDef456...');

      const savedDispute = { ...mockDispute };
      disputeRepo.save.mockResolvedValue(savedDispute);

      const result = await service.uploadEvidence(mockEscrowId, files, mockUserId);

      expect(result.escrowId).toBe(mockEscrowId);
      expect(result.disputeId).toBe(mockDisputeId);
      expect(result.uploadedFiles).toHaveLength(2);
      expect(result.uploadedFiles[0].cid).toBe(mockCid);
      expect(result.uploadedFiles[0].name).toBe('document.pdf');
      expect(result.uploadedFiles[1].name).toBe('screenshot.png');
      expect(ipfsService.uploadFile).toHaveBeenCalledTimes(2);
      expect(disputeRepo.save).toHaveBeenCalled();
    });

    it('should reject files with invalid MIME types', async () => {
      const invalidFile = {
        buffer: Buffer.from('executable'),
        originalname: 'malware.exe',
        mimetype: 'application/x-msdownload',
        size: 1024,
      } as Express.Multer.File;

      const mockEscrow: Escrow = { id: mockEscrowId } as Escrow;
      const mockDispute: Dispute = {
        id: mockDisputeId,
        escrowId: mockEscrowId,
      } as Dispute;

      escrowRepo.findOne.mockResolvedValue(mockEscrow);
      disputeRepo.findOne.mockResolvedValue(mockDispute);

      await expect(
        service.uploadEvidence(mockEscrowId, [invalidFile], mockUserId),
      ).rejects.toThrow(BadRequestException);
    });

    it('should reject files over 10MB', async () => {
      const largeFile = {
        buffer: Buffer.alloc(11 * 1024 * 1024),
        originalname: 'large.pdf',
        mimetype: 'application/pdf',
        size: 11 * 1024 * 1024,
      } as Express.Multer.File;

      const mockEscrow: Escrow = { id: mockEscrowId } as Escrow;
      const mockDispute: Dispute = {
        id: mockDisputeId,
        escrowId: mockEscrowId,
      } as Dispute;

      escrowRepo.findOne.mockResolvedValue(mockEscrow);
      disputeRepo.findOne.mockResolvedValue(mockDispute);

      await expect(
        service.uploadEvidence(mockEscrowId, [largeFile], mockUserId),
      ).rejects.toThrow(BadRequestException);
    });

    it('should append evidence without replacing existing files', async () => {
      const existingFile: EvidenceFileMetadataDto = {
        cid: 'QmExisting',
        name: 'existing.pdf',
        type: 'application/pdf',
        size: 1024,
        uploadedAt: new Date().toISOString(),
        uploadedBy: 'user-old',
      };

      const newFile = {
        buffer: Buffer.from('content'),
        originalname: 'new.png',
        mimetype: 'image/png',
        size: 2048,
      } as Express.Multer.File;

      const mockDispute: Dispute = {
        id: mockDisputeId,
        escrowId: mockEscrowId,
        evidenceFiles: [existingFile],
      } as Dispute;

      const mockEscrow: Escrow = { id: mockEscrowId } as Escrow;

      escrowRepo.findOne.mockResolvedValue(mockEscrow);
      disputeRepo.findOne.mockResolvedValue(mockDispute);
      ipfsService.uploadFile.mockResolvedValue('QmNewCid');

      const updatedDispute = { ...mockDispute };
      disputeRepo.save.mockResolvedValue(updatedDispute);

      const result = await service.uploadEvidence(
        mockEscrowId,
        [newFile],
        mockUserId,
      );

      // Verify that the saved dispute has both old and new files
      const savedCall = disputeRepo.save.mock.calls[0][0];
      expect(savedCall.evidenceFiles).toHaveLength(2);
      expect(savedCall.evidenceFiles[0]).toEqual(existingFile);
      expect(savedCall.evidenceFiles[1].name).toBe('new.png');
    });
  });

  describe('getEvidence', () => {
    it('should return evidence list for dispute parties', async () => {
      const mockMetadata: EvidenceFileMetadataDto[] = [
        {
          cid: mockCid,
          name: 'document.pdf',
          type: 'application/pdf',
          size: 1024,
          uploadedAt: new Date().toISOString(),
          uploadedBy: mockUserId,
        },
      ];

      const mockEscrow: Escrow = {
        id: mockEscrowId,
        parties: [{ userId: mockUserId }] as any,
      } as Escrow;

      const mockDispute: Dispute = {
        id: mockDisputeId,
        escrowId: mockEscrowId,
        evidenceFiles: mockMetadata,
      } as Dispute;

      escrowRepo.findOne.mockResolvedValue(mockEscrow);
      disputeRepo.findOne.mockResolvedValue(mockDispute);

      const result = await service.getEvidence(mockEscrowId, mockUserId);

      expect(result).toEqual(mockMetadata);
    });

    it('should throw 403 for non-party callers', async () => {
      const differentUserId = 'user-999';

      const mockEscrow: Escrow = {
        id: mockEscrowId,
        parties: [{ userId: mockUserId }] as any,
      } as Escrow;

      escrowRepo.findOne.mockResolvedValue(mockEscrow);

      await expect(
        service.getEvidence(mockEscrowId, differentUserId),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should throw NotFoundException if no dispute exists', async () => {
      const mockEscrow: Escrow = {
        id: mockEscrowId,
        parties: [{ userId: mockUserId }] as any,
      } as Escrow;

      escrowRepo.findOne.mockResolvedValue(mockEscrow);
      disputeRepo.findOne.mockResolvedValue(null);

      await expect(
        service.getEvidence(mockEscrowId, mockUserId),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('getEvidenceFile', () => {
    it('should stream file from IPFS with correct Content-Type', async () => {
      const mockMetadata: EvidenceFileMetadataDto = {
        cid: mockCid,
        name: 'document.pdf',
        type: 'application/pdf',
        size: 1024,
        uploadedAt: new Date().toISOString(),
        uploadedBy: mockUserId,
      };

      const mockEscrow: Escrow = {
        id: mockEscrowId,
        parties: [{ userId: mockUserId }] as any,
      } as Escrow;

      const mockDispute: Dispute = {
        id: mockDisputeId,
        escrowId: mockEscrowId,
        evidenceFiles: [mockMetadata],
      } as Dispute;

      const mockResponse = {
        setHeader: jest.fn(),
        redirect: jest.fn(),
      } as unknown as Response;

      escrowRepo.findOne.mockResolvedValue(mockEscrow);
      disputeRepo.findOne.mockResolvedValue(mockDispute);
      ipfsService.getGatewayUrl.mockReturnValue('https://gateway.ipfs.io/ipfs/Qm...');

      await service.getEvidenceFile(mockEscrowId, mockCid, mockUserId, mockResponse);

      expect(mockResponse.setHeader).toHaveBeenCalledWith(
        'Content-Type',
        'application/pdf',
      );
      expect(mockResponse.redirect).toHaveBeenCalledWith(
        302,
        'https://gateway.ipfs.io/ipfs/Qm...',
      );
    });

    it('should throw NotFoundException if CID not found', async () => {
      const mockEscrow: Escrow = {
        id: mockEscrowId,
        parties: [{ userId: mockUserId }] as any,
      } as Escrow;

      const mockDispute: Dispute = {
        id: mockDisputeId,
        escrowId: mockEscrowId,
        evidenceFiles: [],
      } as Dispute;

      const mockResponse = {} as Response;

      escrowRepo.findOne.mockResolvedValue(mockEscrow);
      disputeRepo.findOne.mockResolvedValue(mockDispute);

      await expect(
        service.getEvidenceFile(mockEscrowId, 'QmNonExistent', mockUserId, mockResponse),
      ).rejects.toThrow(NotFoundException);
    });
  });
});
