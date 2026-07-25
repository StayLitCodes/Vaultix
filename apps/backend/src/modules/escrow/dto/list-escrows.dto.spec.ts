import { validate } from 'class-validator';
import { ListEscrowsDto } from './list-escrows.dto';
import { EscrowStatus, EscrowType } from '../entities/escrow.entity';
import { PartyRole } from '../entities/party.entity';

describe('ListEscrowsDto', () => {
  it('should validate with no filters', async () => {
    const dto = new ListEscrowsDto();
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
  });

  it('should validate with pagination', async () => {
    const dto = new ListEscrowsDto();
    dto.page = 2;
    dto.limit = 20;
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
  });

  it('should validate with status filter', async () => {
    const dto = new ListEscrowsDto();
    dto.status = EscrowStatus.ACTIVE;
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
  });

  it('should validate with type filter', async () => {
    const dto = new ListEscrowsDto();
    dto.type = EscrowType.MILESTONE;
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
  });

  it('should validate with role filter', async () => {
    const dto = new ListEscrowsDto();
    dto.role = PartyRole.BUYER;
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
  });

  it('should validate with search term', async () => {
    const dto = new ListEscrowsDto();
    dto.search = 'test';
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
  });

  it('should validate with asset code', async () => {
    const dto = new ListEscrowsDto();
    dto.assetCode = 'XLM';
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
  });

  it('should validate with asset issuer', async () => {
    const dto = new ListEscrowsDto();
    dto.assetIssuer =
      'GD5JDQXKEVPR7QD2R7LXKXN7M4ZGAPYI7F7DQ7K7D7D7D7D7D7D7DABC';
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
  });

  it('should reject empty search term', async () => {
    const dto = new ListEscrowsDto();
    dto.search = '';
    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
  });

  it('should reject empty asset code', async () => {
    const dto = new ListEscrowsDto();
    dto.assetCode = '';
    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
  });

  it('should reject asset code exceeding max length', async () => {
    const dto = new ListEscrowsDto();
    dto.assetCode = 'A'.repeat(13);
    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
  });

  it('should reject invalid asset issuer', async () => {
    const dto = new ListEscrowsDto();
    dto.assetIssuer = 'invalid';
    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
  });

  it('should reject page less than 1', async () => {
    const dto = new ListEscrowsDto();
    dto.page = 0;
    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
  });

  it('should reject limit less than 1', async () => {
    const dto = new ListEscrowsDto();
    dto.limit = 0;
    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
  });

  it('should reject limit greater than 100', async () => {
    const dto = new ListEscrowsDto();
    dto.limit = 101;
    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
  });
});
