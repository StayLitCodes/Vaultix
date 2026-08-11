import { validate } from 'class-validator';
import { CreateAssetDto, UpdateAssetDto } from './asset.dto';

describe('Asset DTOs', () => {
  describe('CreateAssetDto', () => {
    it('should validate with all required fields', async () => {
      const dto = new CreateAssetDto();
      dto.code = 'XLM';
      dto.displayName = 'Stellar Lumens';
      const errors = await validate(dto);
      expect(errors).toHaveLength(0);
    });

    it('should validate with optional issuer', async () => {
      const dto = new CreateAssetDto();
      dto.code = 'USD';
      dto.issuer = 'GD5JDQXKEVPR7QD2R7LXKXN7M4ZGAPYI7F7DQ7K7D7D7D7D7D7D7DABC';
      dto.displayName = 'US Dollar';
      const errors = await validate(dto);
      expect(errors).toHaveLength(0);
    });

    it('should reject invalid issuer (not Stellar address)', async () => {
      const dto = new CreateAssetDto();
      dto.code = 'USD';
      dto.issuer = 'invalid';
      dto.displayName = 'US Dollar';
      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
    });

    it('should reject missing code', async () => {
      const dto = new CreateAssetDto();
      dto.displayName = 'Stellar Lumens';
      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
    });

    it('should reject missing displayName', async () => {
      const dto = new CreateAssetDto();
      dto.code = 'XLM';
      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
    });

    it('should reject code exceeding max length', async () => {
      const dto = new CreateAssetDto();
      dto.code = 'A'.repeat(13);
      dto.displayName = 'Test';
      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
    });

    it('should reject displayName exceeding max length', async () => {
      const dto = new CreateAssetDto();
      dto.code = 'XLM';
      dto.displayName = 'A'.repeat(256);
      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
    });

    it('should reject iconUrl exceeding max length', async () => {
      const dto = new CreateAssetDto();
      dto.code = 'XLM';
      dto.displayName = 'Test';
      dto.iconUrl = 'A'.repeat(501);
      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
    });

    it('should reject empty iconUrl when provided', async () => {
      const dto = new CreateAssetDto();
      dto.code = 'XLM';
      dto.displayName = 'Test';
      dto.iconUrl = '';
      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
    });

    it('should reject decimals outside range', async () => {
      const dto = new CreateAssetDto();
      dto.code = 'XLM';
      dto.displayName = 'Test';
      dto.decimals = 19;
      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
    });
  });

  describe('UpdateAssetDto', () => {
    it('should validate with no fields (all optional)', async () => {
      const dto = new UpdateAssetDto();
      const errors = await validate(dto);
      expect(errors).toHaveLength(0);
    });

    it('should validate with partial updates', async () => {
      const dto = new UpdateAssetDto();
      dto.displayName = 'Updated Name';
      const errors = await validate(dto);
      expect(errors).toHaveLength(0);
    });

    it('should reject invalid issuer', async () => {
      const dto = new UpdateAssetDto();
      dto.issuer = 'invalid';
      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
    });

    it('should reject code exceeding max length', async () => {
      const dto = new UpdateAssetDto();
      dto.code = 'A'.repeat(13);
      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
    });

    it('should reject empty code when provided', async () => {
      const dto = new UpdateAssetDto();
      dto.code = '';
      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
    });

    it('should reject empty displayName when provided', async () => {
      const dto = new UpdateAssetDto();
      dto.displayName = '';
      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
    });

    it('should reject displayName exceeding max length', async () => {
      const dto = new UpdateAssetDto();
      dto.displayName = 'A'.repeat(256);
      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
    });

    it('should reject empty iconUrl when provided', async () => {
      const dto = new UpdateAssetDto();
      dto.iconUrl = '';
      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
    });

    it('should reject iconUrl exceeding max length', async () => {
      const dto = new UpdateAssetDto();
      dto.iconUrl = 'A'.repeat(501);
      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
    });
  });
});
