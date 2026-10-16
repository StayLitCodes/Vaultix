import { BadRequestException } from '@nestjs/common';
import { CursorPage } from './cursor-pagination.dto';

export interface CursorPayload {
  /** Sort key (ISO date string) of the last item on the previous page */
  c: string;
  /** Row id of the last item, used as a tie-breaker for a stable order */
  i: string;
}

export function encodeCursor(sortKey: Date, id: string): string {
  const payload: CursorPayload = { c: sortKey.toISOString(), i: id };
  return Buffer.from(JSON.stringify(payload)).toString('base64url');
}

export function decodeCursor(cursor: string): { sortKey: Date; id: string } {
  try {
    const parsed = JSON.parse(
      Buffer.from(cursor, 'base64url').toString('utf8'),
    ) as Partial<CursorPayload>;
    const sortKey = new Date(String(parsed.c));
    if (
      typeof parsed.c !== 'string' ||
      typeof parsed.i !== 'string' ||
      !parsed.i ||
      Number.isNaN(sortKey.getTime())
    ) {
      throw new Error('malformed');
    }
    return { sortKey, id: parsed.i };
  } catch {
    throw new BadRequestException('Invalid cursor');
  }
}

/**
 * Builds a page from `limit + 1` fetched rows: the extra row only signals
 * that another page exists and is never returned.
 */
export function buildCursorPage<T extends { id: string }>(
  rows: T[],
  limit: number,
  getSortKey: (row: T) => Date,
): CursorPage<T> {
  const hasMore = rows.length > limit;
  const items = hasMore ? rows.slice(0, limit) : rows;
  const last = items[items.length - 1];
  return {
    items,
    nextCursor:
      hasMore && last ? encodeCursor(getSortKey(last), last.id) : null,
  };
}

/**
 * SQLite stores timestamps as 'YYYY-MM-DD HH:MM:SS' text, so Date params
 * must be formatted to compare correctly. Other drivers take Date as-is.
 */
export function toDbDate(date: Date, dbType: string): Date | string {
  if (dbType === 'sqlite' || dbType === 'better-sqlite3') {
    return date.toISOString().slice(0, 19).replace('T', ' ');
  }
  return date;
}
