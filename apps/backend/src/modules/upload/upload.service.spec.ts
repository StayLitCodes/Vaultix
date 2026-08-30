import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { BadRequestException, NotFoundException, UnprocessableEntityException } from '@nestjs/common';
import { UploadService } from './upload.service';
import { DisputeEvidence } from './entities/dispute-evidence.entity';
import { Dispute, DisputeStatus } from '../escrow/entities/dispute.entity';
import { EscrowService } from '../escrow/services/escrow.service';
import { STORAGE_ADAPTER } from './interfaces/storage-adapter.interface';
import { VIRUS_SCANNER } from './interfaces/virus-scanner.interface';

const PNG_MAGIC = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const PDF_MAGIC = Buffer.from([0x25, 0x50, 0x44, 0x46, 0x2d]);
const DOCX_MAGIC = Buffer.from([0x50, 0x4b, 0x03, 0x04]);

function makeFile(buffer: Buffer, name = 'test.png'): Express.Multer.File {
  return {
    buffer,
    originalname: name,
    size: buffer.length,
    mimetype: 'image/png',
    fieldname: 'file',
    encoding: '7bit',
    destination: '',
    filename: '',
    path: '',
    stream: null as any,
  };
}

function makeDispute(id = 'dispute-1'): Dispute {
  return {
    id,
    escrowId: 'escrow-1',
    filedByUserId: 'user-1',
    reason: 'test',
    evidence: null,
    status: DisputeStatus.OPEN,
    resolvedByUserId: null,
    resolvedBy: null,
    resolutionNotes: null,
    sellerPercent: null,
    buyerPercent: null,
    outcome: null,
    resolvedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  } as unknown as Dispute;
}

describe('UploadService', () => {
  let service: UploadService;
  let evidenceRepo: jest.Mocked<Repository<DisputeEvidence>>;
  let disputeRepo: jest.Mocked<Repository<Dispute>>;
  let mockStorage: { save: jest.Mock; getReadStream: jest.Mock; delete: jest.Mock; exists: jest.Mock };
  let mockScanner: { scan: jest.Mock };
  let mockEscrowService: { isUserAdmin: jest.Mock; isUserPartyToEscrow: jest.Mock };

  beforeEach(async () => {
    mockStorage = {
      save: jest.fn().mockResolvedValue('/uploads/evidence/test.png'),
      getReadStream: jest.fn(),
      delete: jest.fn().mockResolvedValue(undefined),
      exists: jest.fn().mockResolvedValue(true),
    };

    mockScanner = {
      scan: jest.fn().mockResolvedValue({ clean: true }),
    };

    mockEscrowService = {
      isUserAdmin: jest.fn().mockResolvedValue(false),
      isUserPartyToEscrow: jest.fn().mockResolvedValue(true),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UploadService,
        {
          provide: getRepositoryToken(DisputeEvidence),
          useValue: {
            count: jest.fn().mockResolvedValue(0),
            create: jest.fn().mockImplementation((dto) => ({ ...dto, id: 'ev-1', createdAt: new Date() })),
            save: jest.fn().mockImplementation((e) => Promise.resolve({ ...e, id: 'ev-1', createdAt: new Date() })),
            findAndCount: jest.fn().mockResolvedValue([[], 0]),
            findOne: jest.fn(),
            find: jest.fn().mockResolvedValue([]),
          },
        },
        {
          provide: getRepositoryToken(Dispute),
          useValue: {
            findOne: jest.fn().mockResolvedValue(makeDispute()),
          },
        },
        { provide: STORAGE_ADAPTER, useValue: mockStorage },
        { provide: VIRUS_SCANNER, useValue: mockScanner },
        { provide: EscrowService, useValue: mockEscrowService },
      ],
    }).compile();

    service = module.get(UploadService);
    evidenceRepo = module.get(getRepositoryToken(DisputeEvidence));
    disputeRepo = module.get(getRepositoryToken(Dispute));
  });

  describe('uploadEvidence', () => {
    it('saves a valid PNG and returns response dto', async () => {
      const buf = Buffer.concat([PNG_MAGIC, Buffer.alloc(100)]);
      const file = makeFile(buf, 'photo.png');

      const result = await service.uploadEvidence('dispute-1', 'user-1', file);

      expect(mockStorage.save).toHaveBeenCalled();
      expect(result).toMatchObject({
        disputeId: 'dispute-1',
        uploadedByUserId: 'user-1',
        originalName: 'photo.png',
        mimeType: 'image/png',
      });
    });

    it('saves a valid PDF', async () => {
      const buf = Buffer.concat([PDF_MAGIC, Buffer.alloc(50)]);
      const file = makeFile(buf, 'doc.pdf');

      const result = await service.uploadEvidence('dispute-1', 'user-1', file);
      expect(result.mimeType).toBe('application/pdf');
    });

    it('saves a valid DOCX', async () => {
      const buf = Buffer.concat([DOCX_MAGIC, Buffer.alloc(50)]);
      const file = makeFile(buf, 'doc.docx');

      const result = await service.uploadEvidence('dispute-1', 'user-1', file);
      expect(result.mimeType).toBe(
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      );
    });

    it('rejects unknown binary file type', async () => {
      const buf = Buffer.from([0x00, 0x01, 0x02, 0x03]);
      const file = makeFile(buf, 'bad.exe');

      await expect(
        service.uploadEvidence('dispute-1', 'user-1', file),
      ).rejects.toBeInstanceOf(UnprocessableEntityException);
    });

    it('rejects files exceeding 10 MB', async () => {
      const buf = Buffer.alloc(11 * 1024 * 1024);
      buf[0] = 0x89; buf[1] = 0x50; buf[2] = 0x4e; buf[3] = 0x47;
      const file = { ...makeFile(buf), size: buf.length };

      await expect(
        service.uploadEvidence('dispute-1', 'user-1', file),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('rejects when dispute has 10 evidence files already', async () => {
      (evidenceRepo.count as jest.Mock).mockResolvedValue(10);
      const buf = Buffer.concat([PNG_MAGIC, Buffer.alloc(20)]);
      const file = makeFile(buf);

      await expect(
        service.uploadEvidence('dispute-1', 'user-1', file),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('rejects when virus scanner flags the file', async () => {
      mockScanner.scan.mockResolvedValue({ clean: false, threat: 'EICAR' });
      const buf = Buffer.concat([PNG_MAGIC, Buffer.alloc(20)]);
      const file = makeFile(buf);

      await expect(
        service.uploadEvidence('dispute-1', 'user-1', file),
      ).rejects.toBeInstanceOf(UnprocessableEntityException);
    });

    it('throws NotFoundException for unknown dispute', async () => {
      (disputeRepo.findOne as jest.Mock).mockResolvedValue(null);
      const buf = Buffer.concat([PNG_MAGIC, Buffer.alloc(20)]);
      const file = makeFile(buf);

      await expect(
        service.uploadEvidence('non-existent', 'user-1', file),
      ).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('listEvidence', () => {
    it('returns paginated evidence list', async () => {
      const ev = {
        id: 'ev-1',
        disputeId: 'dispute-1',
        uploadedByUserId: 'user-1',
        originalName: 'photo.png',
        mimeType: 'image/png',
        size: 1024,
        thumbnailPath: null,
        createdAt: new Date(),
      } as DisputeEvidence;
      (evidenceRepo.findAndCount as jest.Mock).mockResolvedValue([[ev], 1]);

      const result = await service.listEvidence('dispute-1');
      expect(result.total).toBe(1);
      expect(result.data[0].id).toBe('ev-1');
    });
  });

  describe('downloadEvidence', () => {
    it('throws NotFoundException for missing evidence record', async () => {
      (evidenceRepo.findOne as jest.Mock).mockResolvedValue(null);

      await expect(
        service.downloadEvidence('dispute-1', 'ev-missing'),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('throws NotFoundException when file missing from storage', async () => {
      (evidenceRepo.findOne as jest.Mock).mockResolvedValue({
        id: 'ev-1',
        storagePath: '/missing/file.png',
      } as DisputeEvidence);
      mockStorage.exists.mockResolvedValue(false);

      await expect(
        service.downloadEvidence('dispute-1', 'ev-1'),
      ).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('deleteEvidence', () => {
    it('soft-deletes evidence as admin', async () => {
      mockEscrowService.isUserAdmin.mockResolvedValue(true);
      (evidenceRepo.findOne as jest.Mock).mockResolvedValue({
        id: 'ev-1',
        disputeId: 'dispute-1',
        storagePath: '/uploads/evidence/ev-1.png',
        thumbnailPath: null,
        isDeleted: false,
      } as DisputeEvidence);

      await service.deleteEvidence('dispute-1', 'ev-1', 'admin-user');

      expect(evidenceRepo.save).toHaveBeenCalled();
      expect(mockStorage.delete).toHaveBeenCalled();
    });

    it('throws ForbiddenException for non-admin', async () => {
      mockEscrowService.isUserAdmin.mockResolvedValue(false);

      await expect(
        service.deleteEvidence('dispute-1', 'ev-1', 'regular-user'),
      ).rejects.toThrow('Only admins can delete evidence');
    });
  });
});
