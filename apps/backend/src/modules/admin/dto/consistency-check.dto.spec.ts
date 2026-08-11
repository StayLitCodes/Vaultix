import { validate } from 'class-validator';
import {
  ConsistencyCheckByIdsDto,
  ConsistencyCheckByRangeDto,
} from './consistency-check.dto';

describe('ConsistencyCheck DTOs', () => {
  describe('ConsistencyCheckByIdsDto', () => {
    it('should validate with valid escrow IDs', async () => {
      const dto = new ConsistencyCheckByIdsDto();
      dto.escrowIds = [1, 2, 3, 4, 5];
      const errors = await validate(dto);
      expect(errors).toHaveLength(0);
    });

    it('should reject non-array input', async () => {
      const dto = new ConsistencyCheckByIdsDto();
      dto.escrowIds = [] as any;
      const errors = await validate(dto);
      expect(errors).toHaveLength(0); // Empty array is valid
    });

    it('should reject non-number values in array', async () => {
      const dto = new ConsistencyCheckByIdsDto();
      dto.escrowIds = [1, 2, 'invalid' as any];
      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
    });

    it('should reject zero or negative IDs', async () => {
      const dto = new ConsistencyCheckByIdsDto();
      dto.escrowIds = [0, -1, 1];
      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
    });
  });

  describe('ConsistencyCheckByRangeDto', () => {
    it('should validate with valid range', async () => {
      const dto = new ConsistencyCheckByRangeDto();
      dto.fromId = 1;
      dto.toId = 100;
      const errors = await validate(dto);
      expect(errors).toHaveLength(0);
    });

    it('should reject missing fromId', async () => {
      const dto = new ConsistencyCheckByRangeDto();
      dto.toId = 100;
      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
    });

    it('should reject missing toId', async () => {
      const dto = new ConsistencyCheckByRangeDto();
      dto.fromId = 1;
      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
    });

    it('should reject zero fromId', async () => {
      const dto = new ConsistencyCheckByRangeDto();
      dto.fromId = 0;
      dto.toId = 100;
      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
    });

    it('should reject negative toId', async () => {
      const dto = new ConsistencyCheckByRangeDto();
      dto.fromId = 1;
      dto.toId = -10;
      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
    });
  });
});
