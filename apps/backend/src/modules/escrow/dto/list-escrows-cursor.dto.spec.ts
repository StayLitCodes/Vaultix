import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { ListEscrowsCursorDto } from './list-escrows-cursor.dto';

const check = (o: object) => validate(plainToInstance(ListEscrowsCursorDto, o));

describe('ListEscrowsCursorDto', () => {
  it('accepts valid filters', async () => {
    const errors = await check({
      status: 'pending',
      role: 'buyer',
      assetCode: 'USDC',
      createdFrom: '2026-01-01',
      createdTo: '2026-02-01T00:00:00Z',
      limit: '50',
      sortOrder: 'ASC',
    });
    expect(errors).toHaveLength(0);
  });

  it.each([
    { status: 'bogus' },
    { role: 'bogus' },
    { limit: '0' },
    { limit: '101' },
    { createdFrom: 'yesterday' },
    { sortOrder: 'sideways' },
    { assetCode: 'WAYTOOLONGASSETCODE' },
  ])('rejects %p', async (bad) => {
    expect((await check(bad)).length).toBeGreaterThan(0);
  });
});
