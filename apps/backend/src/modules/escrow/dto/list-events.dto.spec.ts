import { validate } from 'class-validator';
import { ListEventsDto } from './list-events.dto';
import { EscrowEventType } from '../entities/escrow-event.entity';

describe('ListEventsDto', () => {
  it('should validate with no filters', async () => {
    const dto = new ListEventsDto();
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
  });

  it('should validate with pagination', async () => {
    const dto = new ListEventsDto();
    dto.page = 2;
    dto.limit = 20;
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
  });

  it('should validate with event type filter', async () => {
    const dto = new ListEventsDto();
    dto.eventType = EscrowEventType.FUNDED;
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
  });

  it('should validate with valid UUID actorId', async () => {
    const dto = new ListEventsDto();
    dto.actorId = '123e4567-e89b-12d3-a456-426614174000';
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
  });

  it('should validate with date range', async () => {
    const dto = new ListEventsDto();
    dto.dateFrom = '2026-01-01T00:00:00.000Z';
    dto.dateTo = '2026-12-31T23:59:59.999Z';
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
  });

  it('should validate with valid UUID escrowId', async () => {
    const dto = new ListEventsDto();
    dto.escrowId = '123e4567-e89b-12d3-a456-426614174000';
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
  });

  it('should validate with cursor', async () => {
    const dto = new ListEventsDto();
    dto.cursor = 'cursor123';
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
  });

  it('should validate with after cursor', async () => {
    const dto = new ListEventsDto();
    dto.after = 'after123';
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
  });

  it('should validate with before cursor', async () => {
    const dto = new ListEventsDto();
    dto.before = 'before123';
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
  });

  it('should reject invalid UUID actorId', async () => {
    const dto = new ListEventsDto();
    dto.actorId = 'invalid-uuid';
    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
  });

  it('should reject invalid UUID escrowId', async () => {
    const dto = new ListEventsDto();
    dto.escrowId = 'invalid-uuid';
    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
  });

  it('should reject empty cursor', async () => {
    const dto = new ListEventsDto();
    dto.cursor = '';
    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
  });

  it('should reject empty after', async () => {
    const dto = new ListEventsDto();
    dto.after = '';
    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
  });

  it('should reject empty before', async () => {
    const dto = new ListEventsDto();
    dto.before = '';
    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
  });

  it('should reject invalid date format', async () => {
    const dto = new ListEventsDto();
    dto.dateFrom = 'invalid-date';
    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
  });

  it('should reject page less than 1', async () => {
    const dto = new ListEventsDto();
    dto.page = 0;
    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
  });

  it('should reject limit less than 1', async () => {
    const dto = new ListEventsDto();
    dto.limit = 0;
    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
  });

  it('should reject limit greater than 100', async () => {
    const dto = new ListEventsDto();
    dto.limit = 101;
    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
  });
});
