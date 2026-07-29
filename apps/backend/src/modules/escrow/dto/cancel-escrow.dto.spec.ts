import { validate } from 'class-validator';
import { CancelEscrowDto } from './cancel-escrow.dto';

describe('CancelEscrowDto', () => {
  it('should validate with valid reason', async () => {
    const dto = new CancelEscrowDto();
    dto.reason = 'Buyer requested cancellation';
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
  });

  it('should validate without reason (optional)', async () => {
    const dto = new CancelEscrowDto();
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
  });

  it('should reject empty reason when provided', async () => {
    const dto = new CancelEscrowDto();
    dto.reason = '';
    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
  });

  it('should reject reason exceeding max length', async () => {
    const dto = new CancelEscrowDto();
    dto.reason = 'A'.repeat(1001);
    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
  });
});
