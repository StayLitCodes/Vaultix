import { validate } from 'class-validator';
import { EscrowOverviewQueryDto } from './escrow-overview.dto';
import {
  EscrowOverviewRole,
  EscrowOverviewStatus,
} from './escrow-overview.dto';

describe('EscrowOverviewQueryDto', () => {
  it('should validate with no filters', async () => {
    const dto = new EscrowOverviewQueryDto();
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
  });

  it('should validate with role filter', async () => {
    const dto = new EscrowOverviewQueryDto();
    dto.role = EscrowOverviewRole.DEPOSITOR;
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
  });

  it('should validate with status filter', async () => {
    const dto = new EscrowOverviewQueryDto();
    dto.status = EscrowOverviewStatus.ACTIVE;
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
  });

  it('should validate with token filter', async () => {
    const dto = new EscrowOverviewQueryDto();
    dto.token = 'XLM';
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
  });

  it('should validate with date range', async () => {
    const dto = new EscrowOverviewQueryDto();
    dto.from = '2026-01-01T00:00:00.000Z';
    dto.to = '2026-12-31T23:59:59.999Z';
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
  });

  it('should validate with pagination', async () => {
    const dto = new EscrowOverviewQueryDto();
    dto.page = 2;
    dto.pageSize = 20;
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
  });

  it('should reject empty token when provided', async () => {
    const dto = new EscrowOverviewQueryDto();
    dto.token = '';
    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
  });

  it('should reject token exceeding max length', async () => {
    const dto = new EscrowOverviewQueryDto();
    dto.token = 'A'.repeat(13);
    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
  });

  it('should reject invalid date format', async () => {
    const dto = new EscrowOverviewQueryDto();
    dto.from = 'invalid-date';
    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
  });

  it('should reject page less than 1', async () => {
    const dto = new EscrowOverviewQueryDto();
    dto.page = 0;
    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
  });

  it('should reject pageSize less than 1', async () => {
    const dto = new EscrowOverviewQueryDto();
    dto.pageSize = 0;
    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
  });

  it('should reject pageSize greater than 100', async () => {
    const dto = new EscrowOverviewQueryDto();
    dto.pageSize = 101;
    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
  });
});
