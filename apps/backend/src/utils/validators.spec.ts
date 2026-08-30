import { validate } from 'class-validator';
import { IsStellarAddress } from './validators';

class TestDto {
  @IsStellarAddress()
  address: string;
}

describe('IsStellarAddress', () => {
  it('should validate a valid Stellar public key', async () => {
    const dto = new TestDto();
    dto.address = 'GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA'; // 56 chars starting with G
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
  });

  it('should reject invalid Stellar public key - wrong length', async () => {
    const dto = new TestDto();
    dto.address = 'GABCD'; // Too short
    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0].constraints).toHaveProperty('isStellarAddress');
  });

  it('should reject invalid Stellar public key - wrong prefix', async () => {
    const dto = new TestDto();
    dto.address = 'XABCD1234567890ABCDEFGHIJKLMNOPQRSTUVWXYZABCDEFGHIJ'; // Starts with X
    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0].constraints).toHaveProperty('isStellarAddress');
  });

  it('should reject invalid Stellar public key - lowercase letters', async () => {
    const dto = new TestDto();
    dto.address = 'gabcd1234567890abcdefghijklmnopqrstuvwxyzabcdefghij'; // Lowercase
    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0].constraints).toHaveProperty('isStellarAddress');
  });

  it('should reject non-string values', async () => {
    const dto = new TestDto();
    dto.address = 123 as any;
    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
  });

  it('should reject empty string', async () => {
    const dto = new TestDto();
    dto.address = '';
    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0].constraints).toHaveProperty('isStellarAddress');
  });

  it('should accept a real Stellar public key format', async () => {
    const dto = new TestDto();
    dto.address = 'GD5JDQXKEVPR7QD2R7LXKXN7M4ZGAPYI7F7DQ7K7D7D7D7D7D7D7DAAA';
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
  });
});
