import { validate } from 'class-validator';
import { FileDisputeDto, ResolveDisputeDto } from './dispute.dto';
import { DisputeOutcome } from '../entities/dispute.entity';

describe('Dispute DTOs', () => {
  describe('FileDisputeDto', () => {
    it('should validate with reason', async () => {
      const dto = new FileDisputeDto();
      dto.reason = 'Product arrived damaged';
      const errors = await validate(dto);
      expect(errors).toHaveLength(0);
    });

    it('should validate with evidence array', async () => {
      const dto = new FileDisputeDto();
      dto.reason = 'Product arrived damaged';
      dto.evidence = ['ipfs://QmHash1', 'ipfs://QmHash2'];
      const errors = await validate(dto);
      expect(errors).toHaveLength(0);
    });

    it('should reject empty reason', async () => {
      const dto = new FileDisputeDto();
      dto.reason = '';
      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
    });

    it('should reject reason exceeding max length', async () => {
      const dto = new FileDisputeDto();
      dto.reason = 'A'.repeat(2001);
      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
    });

    it('should reject evidence item exceeding max length', async () => {
      const dto = new FileDisputeDto();
      dto.reason = 'Test';
      dto.evidence = ['A'.repeat(501)];
      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
    });

    it('should reject empty evidence item', async () => {
      const dto = new FileDisputeDto();
      dto.reason = 'Test';
      dto.evidence = [''];
      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
    });
  });

  describe('ResolveDisputeDto', () => {
    it('should validate with outcome and notes', async () => {
      const dto = new ResolveDisputeDto();
      dto.outcome = DisputeOutcome.REFUNDED_TO_BUYER;
      dto.resolutionNotes = 'Refund approved due to damaged goods';
      const errors = await validate(dto);
      expect(errors).toHaveLength(0);
    });

    it('should validate with split outcome and percentages', async () => {
      const dto = new ResolveDisputeDto();
      dto.outcome = DisputeOutcome.SPLIT;
      dto.resolutionNotes = 'Partial refund';
      dto.sellerPercent = 70;
      dto.buyerPercent = 30;
      const errors = await validate(dto);
      expect(errors).toHaveLength(0);
    });

    it('should reject empty resolution notes', async () => {
      const dto = new ResolveDisputeDto();
      dto.outcome = DisputeOutcome.REFUNDED_TO_BUYER;
      dto.resolutionNotes = '';
      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
    });

    it('should reject seller percent outside range', async () => {
      const dto = new ResolveDisputeDto();
      dto.outcome = DisputeOutcome.SPLIT;
      dto.resolutionNotes = 'Test';
      dto.sellerPercent = 150;
      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
    });

    it('should reject negative buyer percent', async () => {
      const dto = new ResolveDisputeDto();
      dto.outcome = DisputeOutcome.SPLIT;
      dto.resolutionNotes = 'Test';
      dto.buyerPercent = -10;
      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
    });
  });
});
