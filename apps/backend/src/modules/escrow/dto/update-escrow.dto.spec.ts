import { validate } from 'class-validator';
import { UpdateEscrowDto } from './update-escrow.dto';

describe('UpdateEscrowDto', () => {
  it('should validate with title', async () => {
    const dto = new UpdateEscrowDto();
    dto.title = 'Updated title';
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
  });

  it('should validate with description', async () => {
    const dto = new UpdateEscrowDto();
    dto.description = 'Updated description';
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
  });

  it('should validate with expiresAt', async () => {
    const dto = new UpdateEscrowDto();
    dto.expiresAt = '2026-12-31T23:59:59.999Z';
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
  });

  it('should validate with all fields', async () => {
    const dto = new UpdateEscrowDto();
    dto.title = 'Updated title';
    dto.description = 'Updated description';
    dto.expiresAt = '2026-12-31T23:59:59.999Z';
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
  });

  it('should validate without any fields (all optional)', async () => {
    const dto = new UpdateEscrowDto();
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
  });

  it('should reject empty title when provided', async () => {
    const dto = new UpdateEscrowDto();
    dto.title = '';
    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
  });

  it('should reject empty description when provided', async () => {
    const dto = new UpdateEscrowDto();
    dto.description = '';
    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
  });

  it('should reject title exceeding max length', async () => {
    const dto = new UpdateEscrowDto();
    dto.title = 'A'.repeat(256);
    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
  });

  it('should reject description exceeding max length', async () => {
    const dto = new UpdateEscrowDto();
    dto.description = 'A'.repeat(2001);
    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
  });

  it('should reject invalid date format', async () => {
    const dto = new UpdateEscrowDto();
    dto.expiresAt = 'invalid-date';
    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
  });
});
