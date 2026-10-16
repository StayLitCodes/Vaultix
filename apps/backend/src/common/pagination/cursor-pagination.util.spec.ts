import { BadRequestException } from '@nestjs/common';
import {
  buildCursorPage,
  decodeCursor,
  encodeCursor,
  toDbDate,
} from './cursor-pagination.util';

describe('cursor pagination util', () => {
  const rows = (n: number) =>
    Array.from({ length: n }, (_, i) => ({
      id: `id-${i}`,
      createdAt: new Date(Date.UTC(2026, 0, 1, 0, 0, i)),
    }));

  it('round-trips a cursor', () => {
    const d = new Date('2026-01-01T00:00:05.000Z');
    expect(decodeCursor(encodeCursor(d, 'abc'))).toEqual({
      sortKey: d,
      id: 'abc',
    });
  });

  it.each([
    'not-base64-json',
    Buffer.from('{"c":"x","i":"1"}').toString('base64url'),
    Buffer.from('{"c":"2026-01-01T00:00:00Z"}').toString('base64url'),
  ])('rejects malformed cursor %s', (cursor) => {
    expect(() => decodeCursor(cursor)).toThrow(BadRequestException);
  });

  it('returns nextCursor from the last returned item when more rows exist', () => {
    const page = buildCursorPage(rows(4), 3, (r) => r.createdAt);
    expect(page.items).toHaveLength(3);
    expect(decodeCursor(page.nextCursor as string).id).toBe('id-2');
  });

  it('returns null nextCursor on the last page', () => {
    const page = buildCursorPage(rows(3), 3, (r) => r.createdAt);
    expect(page.items).toHaveLength(3);
    expect(page.nextCursor).toBeNull();
  });

  it('handles an empty result', () => {
    expect(buildCursorPage([], 3, () => new Date())).toEqual({
      items: [],
      nextCursor: null,
    });
  });

  it('formats dates for sqlite only', () => {
    const d = new Date('2026-01-02T03:04:05.678Z');
    expect(toDbDate(d, 'sqlite')).toBe('2026-01-02 03:04:05');
    expect(toDbDate(d, 'postgres')).toBe(d);
  });
});
