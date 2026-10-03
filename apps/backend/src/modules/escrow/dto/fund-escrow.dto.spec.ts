import { validate } from 'class-validator';
import { FundEscrowDto } from './fund-escrow.dto';

describe('FundEscrowDto', () => {
  const valid = async (amount: string) => {
    const dto = Object.assign(new FundEscrowDto(), { amount });
    return validate(dto);
  };

  it('accepts exact decimal strings, including one base unit and maximum precision', async () => {
    await expect(valid('0.0000001')).resolves.toHaveLength(0);
    await expect(valid('100')).resolves.toHaveLength(0);
    await expect(valid('100.1234567')).resolves.toHaveLength(0);
  });

  it.each(['0', '0.0000000', '-1', '1e3', '1.12345678', '01', ' 1', '1.'])(
    'rejects malformed, zero, or over-precision amount %s',
    async (amount) => {
      await expect(valid(amount)).resolves.toHaveLength(1);
    },
  );

  it('rejects JSON numbers to prevent precision loss before validation', async () => {
    const dto = Object.assign(new FundEscrowDto(), { amount: 100.5 });
    await expect(validate(dto)).resolves.toHaveLength(1);
  });
});
