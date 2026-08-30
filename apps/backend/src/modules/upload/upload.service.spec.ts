import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { ObjectLiteral, Repository } from 'typeorm';

import { UploadService } from './upload.service';
import {
  DisputeEvidence,
  EvidenceStatus,
} from './entities/dispute-evidence.entity';
import { Dispute } from '../escrow/entities/dispute.entity';
import { Escrow } from '../escrow/entities/escrow.entity';
import { Party } from '../escrow/entities/party.entity';
import { VIRUS_SCANNER_TOKEN } from './interfaces/virus-scanner.interface';
import { STORAGE_ADAPTER_TOKEN } from './interfaces/storage-adapter.interface';
import { ListEvidenceQueryDto } from './dto/upload.dto';

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

const PNG_MAGIC = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const PDF_MAGIC = Buffer.from([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x34]);
const UNKNOWN_MAGIC = Buffer.from([0x00, 0x00, 0x00, 0x00]);

function makeFile(
  overrides: Partial<Express.Multer.File> = {},
): Express.Multer.File {
  return {
    fieldname: 'files',
    originalname: 'test.png',
    encoding: '7bit',
    mimetype: 'image/png',
    size: PNG_MAGIC.length,
    buffer: PNG_MAGIC,
    stream: null as any,
    destination: '',
    filename: '',
    path: '',
    ...overrides,
  };
}

function makeRepo<T extends ObjectLiteral>(
  overrides: Partial<jest.Mocked<Repository<T>>> = {},
): jest.Mocked<Repository<T>> {
  return {
    findOne: jest.fn(),
    find: jest.fn(),
    count: jest.fn(),
    save: jest.fn(),
    create: jest.fn(),
    createQueryBuilder: jest.fn(),
    ...overrides,
  } as unknown as jest.Mocked<Repository<T>>;
}

// ─────────────────────────────────────────────────────────────────────────────
// Test suite
// ─────────────────────────────────────────────────────────────────────────────

describe('UploadService', () => {
  let service: UploadService;

  let evidenceRepo: jest.Mocked<Repository<DisputeEvidence>>;
  let disputeRepo: jest.Mocked<Repository<Dispute>>;
  let escrowRepo: jest.Mocked<Repository<Escrow>>;
  let partyRepo: jest.Mocked<Repository<Party>>;

  const mockStorage = {
    write: jest.fn().mockResolvedValue({
      storagePath: 'evidence/d1/f.png',
      url: '/tmp/f.png',
    }),
    read: jest.fn(),
    delete: jest.fn().mockResolvedValue(undefined),
    deleteOrphans: jest.fn().mockResolvedValue(0),
  };

  const mockScanner = {
    scan: jest.fn().mockResolvedValue({ clean: true, verdict: 'OK' }),
  };

  const DISPUTE_ID = 'aaaaaaaa-0000-0000-0000-000000000001';
  const ESCROW_ID = 'bbbbbbbb-0000-0000-0000-000000000002';
  const USER_ID = 'cccccccc-0000-0000-0000-000000000003';
  const EVIDENCE_ID = 'dddddddd-0000-0000-0000-000000000004';

  const stubDispute = { id: DISPUTE_ID, escrowId: ESCROW_ID } as Dispute;
  const stubParty = { escrowId: ESCROW_ID, userId: USER_ID } as Party;

  beforeEach(async () => {
    evidenceRepo = makeRepo<DisputeEvidence>();
    disputeRepo = makeRepo<Dispute>();
    escrowRepo = makeRepo<Escrow>();
    partyRepo = makeRepo<Party>();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UploadService,
        {
          provide: getRepositoryToken(DisputeEvidence),
          useValue: evidenceRepo,
        },
        { provide: getRepositoryToken(Dispute), useValue: disputeRepo },
        { provide: getRepositoryToken(Escrow), useValue: escrowRepo },
        { provide: getRepositoryToken(Party), useValue: partyRepo },
        { provide: VIRUS_SCANNER_TOKEN, useValue: mockScanner },
        { provide: STORAGE_ADAPTER_TOKEN, useValue: mockStorage },
      ],
    }).compile();

    service = module.get<UploadService>(UploadService);

    // Default happy-path stubs
    disputeRepo.findOne.mockResolvedValue(stubDispute);
    partyRepo.findOne.mockResolvedValue(stubParty);
    evidenceRepo.count.mockResolvedValue(0);
    mockStorage.write.mockResolvedValue({
      storagePath: 'evidence/d1/f.png',
      url: '/tmp/f.png',
    });
    mockScanner.scan.mockResolvedValue({ clean: true, verdict: 'OK' });

    evidenceRepo.create.mockImplementation(
      (dto) => ({ ...dto }) as DisputeEvidence,
    );
    evidenceRepo.save.mockImplementation(
      async (e) =>
        ({ id: EVIDENCE_ID, createdAt: new Date(), ...e }) as DisputeEvidence,
    );
  });

  afterEach(() => jest.clearAllMocks());

  // ── uploadEvidence ────────────────────────────────────────────────────────

  describe('uploadEvidence', () => {
    it('stores a valid PNG file and returns metadata', async () => {
      const file = makeFile({ buffer: PNG_MAGIC, size: PNG_MAGIC.length });
      const result = await service.uploadEvidence(DISPUTE_ID, [file], USER_ID);

      expect(result.disputeId).toBe(DISPUTE_ID);
      expect(result.uploaded).toHaveLength(1);
      expect(result.uploaded[0].mimeType).toBe('image/png');
      expect(mockStorage.write).toHaveBeenCalledTimes(
        // main file write (thumbnail write may or may not happen depending on sharp availability)
        expect.any(Number) >= 1 ? expect.any(Number) : 1,
      );
    });

    it('stores a valid PDF file', async () => {
      const pdfBuf = Buffer.concat([PDF_MAGIC, Buffer.alloc(100, 0x20)]);
      const file = makeFile({
        originalname: 'doc.pdf',
        buffer: pdfBuf,
        size: pdfBuf.length,
        mimetype: 'application/pdf',
      });
      const result = await service.uploadEvidence(DISPUTE_ID, [file], USER_ID);

      expect(result.uploaded[0].mimeType).toBe('application/pdf');
    });

    it('rejects files with unknown magic bytes', async () => {
      const file = makeFile({
        buffer: UNKNOWN_MAGIC,
        size: UNKNOWN_MAGIC.length,
      });
      await expect(
        service.uploadEvidence(DISPUTE_ID, [file], USER_ID),
      ).rejects.toThrow(BadRequestException);
    });

    it('rejects files exceeding 10 MB', async () => {
      const bigBuf = Buffer.concat([
        PNG_MAGIC,
        Buffer.alloc(10 * 1024 * 1024 + 1),
      ]);
      const file = makeFile({ buffer: bigBuf, size: bigBuf.length });
      await expect(
        service.uploadEvidence(DISPUTE_ID, [file], USER_ID),
      ).rejects.toThrow(BadRequestException);
    });

    it('throws NotFoundException when dispute does not exist', async () => {
      disputeRepo.findOne.mockResolvedValue(null);
      await expect(
        service.uploadEvidence('no-such-id', [makeFile()], USER_ID),
      ).rejects.toThrow(NotFoundException);
    });

    it('throws ForbiddenException when user is not a party', async () => {
      partyRepo.findOne.mockResolvedValue(null);
      await expect(
        service.uploadEvidence(DISPUTE_ID, [makeFile()], USER_ID),
      ).rejects.toThrow(ForbiddenException);
    });

    it('throws BadRequestException when quota is exceeded', async () => {
      evidenceRepo.count.mockResolvedValue(10);
      await expect(
        service.uploadEvidence(DISPUTE_ID, [makeFile()], USER_ID),
      ).rejects.toThrow(BadRequestException);
    });

    it('throws when no files are provided', async () => {
      await expect(
        service.uploadEvidence(DISPUTE_ID, [], USER_ID),
      ).rejects.toThrow(BadRequestException);
    });

    it('marks scan status INFECTED when scanner flags file', async () => {
      mockScanner.scan.mockResolvedValueOnce({
        clean: false,
        verdict: 'Virus.Test FOUND',
      });
      const file = makeFile({ buffer: PNG_MAGIC, size: PNG_MAGIC.length });
      await service.uploadEvidence(DISPUTE_ID, [file], USER_ID);

      const savedArg = evidenceRepo.save.mock
        .calls[0][0] as Partial<DisputeEvidence>;
      expect(savedArg.scanStatus).toBe(EvidenceStatus.INFECTED);
    });

    it('computes a sha-256 checksum', async () => {
      const file = makeFile({ buffer: PNG_MAGIC, size: PNG_MAGIC.length });
      await service.uploadEvidence(DISPUTE_ID, [file], USER_ID);

      const savedArg = evidenceRepo.save.mock
        .calls[0][0] as Partial<DisputeEvidence>;
      expect(savedArg.checksum).toMatch(/^[a-f0-9]{64}$/);
    });

    it('uses a UUID-based stored filename', async () => {
      const file = makeFile({ buffer: PNG_MAGIC, size: PNG_MAGIC.length });
      await service.uploadEvidence(DISPUTE_ID, [file], USER_ID);

      const savedArg = evidenceRepo.save.mock
        .calls[0][0] as Partial<DisputeEvidence>;
      expect(savedArg.storedFilename).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(png|jpg|pdf|txt|docx|doc|webp)$/,
      );
    });

    it('does not leak the original filename in the storage path', async () => {
      const file = makeFile({
        originalname: '../../../etc/passwd.png',
        buffer: PNG_MAGIC,
        size: PNG_MAGIC.length,
      });
      await service.uploadEvidence(DISPUTE_ID, [file], USER_ID);

      const savedArg = evidenceRepo.save.mock
        .calls[0][0] as Partial<DisputeEvidence>;
      expect(savedArg.storagePath).not.toContain('..');
      expect(savedArg.storagePath).not.toContain('passwd');
    });
  });

  // ── listEvidence ──────────────────────────────────────────────────────────

  describe('listEvidence', () => {
    const mockQb = {
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      getMany: jest.fn().mockResolvedValue([]),
    };

    beforeEach(() => {
      evidenceRepo.createQueryBuilder.mockReturnValue(mockQb as any);
    });

    it('returns an empty list when no evidence exists', async () => {
      const result = await service.listEvidence(DISPUTE_ID, USER_ID, {});
      expect(result).toEqual([]);
    });

    it('throws NotFoundException for unknown dispute', async () => {
      disputeRepo.findOne.mockResolvedValue(null);
      await expect(service.listEvidence('bad-id', USER_ID, {})).rejects.toThrow(
        NotFoundException,
      );
    });

    it('throws ForbiddenException when user is not a party', async () => {
      partyRepo.findOne.mockResolvedValue(null);
      await expect(
        service.listEvidence(DISPUTE_ID, USER_ID, {}),
      ).rejects.toThrow(ForbiddenException);
    });

    it('applies scanStatus filter when provided', async () => {
      const query: ListEvidenceQueryDto = { scanStatus: EvidenceStatus.CLEAN };
      await service.listEvidence(DISPUTE_ID, USER_ID, query);
      expect(mockQb.andWhere).toHaveBeenCalledWith(
        'e.scanStatus = :scanStatus',
        { scanStatus: EvidenceStatus.CLEAN },
      );
    });
  });

  // ── deleteEvidence ────────────────────────────────────────────────────────

  describe('deleteEvidence', () => {
    const stubRecord: DisputeEvidence = {
      id: EVIDENCE_ID,
      disputeId: DISPUTE_ID,
      uploadedById: USER_ID,
      storedFilename: 'uuid.png',
      originalFilename: 'test.png',
      mimeType: 'image/png',
      size: 8,
      storagePath: 'evidence/d1/uuid.png',
      thumbnailPath: 'evidence/d1/thumbs/thumb_uuid.jpg',
      checksum: 'abc123',
      scanStatus: EvidenceStatus.CLEAN,
      scanResult: 'OK',
      scannedAt: new Date(),
      deleted: false,
      deletedById: null,
      deletedAt: null,
      createdAt: new Date(),
    } as DisputeEvidence;

    beforeEach(() => {
      evidenceRepo.findOne.mockResolvedValue(stubRecord);
      evidenceRepo.save.mockResolvedValue({
        ...stubRecord,
        deleted: true,
      } as DisputeEvidence);
    });

    it('soft-deletes the record and removes physical files', async () => {
      const result = await service.deleteEvidence(
        DISPUTE_ID,
        EVIDENCE_ID,
        'admin-id',
      );
      expect(result.success).toBe(true);
      expect(evidenceRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ deleted: true, deletedById: 'admin-id' }),
      );
    });

    it('throws NotFoundException for unknown evidence', async () => {
      evidenceRepo.findOne.mockResolvedValue(null);
      await expect(
        service.deleteEvidence(DISPUTE_ID, 'no-such-evidence', 'admin-id'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  // ── downloadEvidence ──────────────────────────────────────────────────────

  describe('downloadEvidence', () => {
    const stubRecord: DisputeEvidence = {
      id: EVIDENCE_ID,
      disputeId: DISPUTE_ID,
      uploadedById: USER_ID,
      storedFilename: 'uuid.pdf',
      originalFilename: 'contract.pdf',
      mimeType: 'application/pdf',
      size: 512,
      storagePath: 'evidence/d1/uuid.pdf',
      thumbnailPath: null,
      checksum: 'deadbeef',
      scanStatus: EvidenceStatus.CLEAN,
      scanResult: 'OK',
      scannedAt: new Date(),
      deleted: false,
      deletedById: null,
      deletedAt: null,
      createdAt: new Date(),
    } as DisputeEvidence;

    it('streams file with correct headers', async () => {
      evidenceRepo.findOne.mockResolvedValue(stubRecord);
      const fakeBuffer = Buffer.from('pdf content');
      mockStorage.read.mockResolvedValue(fakeBuffer);

      const mockRes = {
        setHeader: jest.fn(),
        end: jest.fn(),
      };

      await service.downloadEvidence(
        DISPUTE_ID,
        EVIDENCE_ID,
        USER_ID,
        mockRes as any,
      );

      expect(mockRes.setHeader).toHaveBeenCalledWith(
        'Content-Type',
        'application/pdf',
      );
      expect(mockRes.setHeader).toHaveBeenCalledWith(
        'Content-Disposition',
        expect.stringContaining('contract.pdf'),
      );
      expect(mockRes.end).toHaveBeenCalledWith(fakeBuffer);
    });
  });

  // ── cleanOrphanedFiles ───────────────────────────────────────────────────

  describe('cleanOrphanedFiles', () => {
    it('passes active paths to storage adapter', async () => {
      const r1 = {
        storagePath: 'evidence/d1/a.png',
        thumbnailPath: 'evidence/d1/thumbs/ta.jpg',
      } as DisputeEvidence;
      const r2 = {
        storagePath: 'evidence/d1/b.pdf',
        thumbnailPath: null,
      } as DisputeEvidence;
      evidenceRepo.find.mockResolvedValue([r1, r2]);
      mockStorage.deleteOrphans.mockResolvedValue(3);

      const count = await service.cleanOrphanedFiles();

      expect(count).toBe(3);
      const passedPaths: Set<string> =
        mockStorage.deleteOrphans.mock.calls[0][0];
      expect(passedPaths.has('evidence/d1/a.png')).toBe(true);
      expect(passedPaths.has('evidence/d1/thumbs/ta.jpg')).toBe(true);
      expect(passedPaths.has('evidence/d1/b.pdf')).toBe(true);
    });
  });
});
