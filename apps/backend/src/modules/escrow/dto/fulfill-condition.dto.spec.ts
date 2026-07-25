import { validate } from 'class-validator';
import { FulfillConditionDto } from './fulfill-condition.dto';

describe('FulfillConditionDto', () => {
  it('should validate with notes', async () => {
    const dto = new FulfillConditionDto();
    dto.notes = 'Condition fulfilled successfully';
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
  });

  it('should validate with evidence', async () => {
    const dto = new FulfillConditionDto();
    dto.evidence = 'ipfs://QmHash123';
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
  });

  it('should validate with both notes and evidence', async () => {
    const dto = new FulfillConditionDto();
    dto.notes = 'Condition fulfilled';
    dto.evidence = 'ipfs://QmHash123';
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
  });

  it('should validate without any fields (all optional)', async () => {
    const dto = new FulfillConditionDto();
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
  });

  it('should reject empty notes when provided', async () => {
    const dto = new FulfillConditionDto();
    dto.notes = '';
    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
  });

  it('should reject empty evidence when provided', async () => {
    const dto = new FulfillConditionDto();
    dto.evidence = '';
    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
  });

  it('should reject notes exceeding max length', async () => {
    const dto = new FulfillConditionDto();
    dto.notes = 'A'.repeat(2001);
    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
  });

  it('should reject evidence exceeding max length', async () => {
    const dto = new FulfillConditionDto();
    dto.evidence = 'A'.repeat(501);
    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
  });
});
