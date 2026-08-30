import { validate } from 'class-validator';
import { FundEscrowDto } from './fund-escrow.dto';

describe('FundEscrowDto', () => {
  it('should validate with valid amount', async () => {
    const dto = new FundEscrowDto();
    dto.amount = 100;
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
  });

  it('should validate with decimal amount', async () => {
    const dto = new FundEscrowDto();
    dto.amount = 100.5;
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
  });

  it('should reject zero amount', async () => {
    const dto = new FundEscrowDto();
    dto.amount = 0;
    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
  });

  it('should reject negative amount', async () => {
    const dto = new FundEscrowDto();
    dto.amount = -100;
    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
  });

  it('should reject amount exceeding max', async () => {
    const dto = new FundEscrowDto();
    dto.amount = 1e13 + 1;
    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
  });
});
