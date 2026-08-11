import { validate } from 'class-validator';
import { UpdateProfileDto } from './profile.dto';

describe('UpdateProfileDto', () => {
  it('should validate with all optional fields', async () => {
    const dto = new UpdateProfileDto();
    dto.displayName = 'John Doe';
    dto.email = 'john@example.com';
    dto.emailVerified = true;
    dto.bio = 'Software developer';
    dto.preferredAsset = 'XLM';
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
  });

  it('should validate with no fields (all optional)', async () => {
    const dto = new UpdateProfileDto();
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
  });

  it('should reject invalid email', async () => {
    const dto = new UpdateProfileDto();
    dto.email = 'invalid-email';
    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
  });

  it('should reject displayName exceeding max length', async () => {
    const dto = new UpdateProfileDto();
    dto.displayName = 'A'.repeat(101);
    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
  });

  it('should reject bio exceeding max length', async () => {
    const dto = new UpdateProfileDto();
    dto.bio = 'A'.repeat(501);
    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
  });

  it('should reject preferredAsset exceeding max length', async () => {
    const dto = new UpdateProfileDto();
    dto.preferredAsset = 'A'.repeat(21);
    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
  });

  it('should reject empty displayName', async () => {
    const dto = new UpdateProfileDto();
    dto.displayName = '';
    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
  });

  it('should reject empty bio when provided', async () => {
    const dto = new UpdateProfileDto();
    dto.bio = '';
    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
  });

  it('should reject empty preferredAsset when provided', async () => {
    const dto = new UpdateProfileDto();
    dto.preferredAsset = '';
    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
  });

  it('should reject preferredAsset exceeding max length', async () => {
    const dto = new UpdateProfileDto();
    dto.preferredAsset = 'A'.repeat(13);
    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
  });
});
