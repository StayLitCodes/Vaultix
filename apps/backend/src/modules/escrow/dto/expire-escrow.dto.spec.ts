import { validate } from 'class-validator';
import { ExpireEscrowDto } from './expire-escrow.dto';

describe('ExpireEscrowDto', () => {
  it('should validate with valid reason', async () => {
    const dto = new ExpireEscrowDto();
    dto.reason = 'Escrow expired automatically';
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
  });

  it('should validate without reason (optional)', async () => {
    const dto = new ExpireEscrowDto();
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
  });

  it('should reject empty reason when provided', async () => {
    const dto = new ExpireEscrowDto();
    dto.reason = '';
    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
  });

  it('should reject reason exceeding max length', async () => {
    const dto = new ExpireEscrowDto();
    dto.reason = 'A'.repeat(1001);
    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
  });
});
