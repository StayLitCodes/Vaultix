import { validate } from 'class-validator';
import { ProposeMilestoneChangeDto } from './milestone-change.dto';

describe('ProposeMilestoneChangeDto', () => {
  it('should validate with amount', async () => {
    const dto = new ProposeMilestoneChangeDto();
    dto.amount = 100.5;
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
  });

  it('should validate with description', async () => {
    const dto = new ProposeMilestoneChangeDto();
    dto.description = 'Updated milestone description';
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
  });

  it('should validate with both amount and description', async () => {
    const dto = new ProposeMilestoneChangeDto();
    dto.amount = 100.5;
    dto.description = 'Updated milestone description';
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
  });

  it('should validate without any fields (all optional)', async () => {
    const dto = new ProposeMilestoneChangeDto();
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
  });

  it('should reject negative amount', async () => {
    const dto = new ProposeMilestoneChangeDto();
    dto.amount = -10;
    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
  });

  it('should reject amount exceeding max', async () => {
    const dto = new ProposeMilestoneChangeDto();
    dto.amount = 1e13 + 1;
    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
  });

  it('should reject empty description when provided', async () => {
    const dto = new ProposeMilestoneChangeDto();
    dto.description = '';
    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
  });

  it('should reject description exceeding max length', async () => {
    const dto = new ProposeMilestoneChangeDto();
    dto.description = 'A'.repeat(2001);
    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
  });
});
