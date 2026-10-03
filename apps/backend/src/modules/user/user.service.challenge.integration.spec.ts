import { DataSource } from 'typeorm';
import { UserService } from './user.service';
import { User } from './entities/user.entity';
import { RefreshToken } from './entities/refresh-token.entity';

describe('UserService.consumeChallenge (sqlite integration)', () => {
  let dataSource: DataSource;
  let service: UserService;
  let userId: string;

  const seedUser = async (
    nonce: string,
    nonceExpiresAt: Date,
  ): Promise<string> => {
    const repo = dataSource.getRepository(User);
    const user = repo.create({
      walletAddress: `G-${nonce}-${Date.now()}-${Math.random()}`,
      nonce,
      nonceExpiresAt,
      isActive: true,
    });
    const saved = await repo.save(user);
    return saved.id;
  };

  beforeAll(async () => {
    dataSource = new DataSource({
      type: 'sqlite',
      database: ':memory:',
      entities: [User, RefreshToken],
      synchronize: true,
    });
    await dataSource.initialize();
    service = new UserService(
      dataSource.getRepository(User),
      dataSource.getRepository(RefreshToken),
      dataSource,
    );
  });

  afterAll(async () => {
    if (dataSource?.isInitialized) {
      await dataSource.destroy();
    }
  });

  beforeEach(async () => {
    await dataSource.getRepository(User).clear();
  });

  it('consumes a valid challenge exactly once and clears the fields', async () => {
    const expiresAt = new Date(Date.now() + 60_000);
    userId = await seedUser('nonce-valid', expiresAt);

    const first = await service.consumeChallenge(userId, 'nonce-valid');
    const second = await service.consumeChallenge(userId, 'nonce-valid');

    expect(first).toBe(true);
    expect(second).toBe(false);

    const row = await dataSource
      .getRepository(User)
      .findOneByOrFail({ id: userId });
    expect(row.nonce).toBeNull();
    expect(row.nonceExpiresAt).toBeNull();
  });

  it('allows only one winner when two verifications race concurrently', async () => {
    userId = await seedUser('nonce-race', new Date(Date.now() + 60_000));

    const results = await Promise.all([
      service.consumeChallenge(userId, 'nonce-race'),
      service.consumeChallenge(userId, 'nonce-race'),
    ]);

    expect(results.filter(Boolean)).toHaveLength(1);
    expect(results.filter((r) => !r)).toHaveLength(1);
  });

  it('rejects a superseded challenge after a newer nonce is issued', async () => {
    userId = await seedUser('nonce-old', new Date(Date.now() + 60_000));
    const newer = new Date(Date.now() + 120_000);
    await service.setChallengeNonce(userId, 'nonce-new', newer);

    // The old nonce no longer matches the stored value.
    const stale = await service.consumeChallenge(userId, 'nonce-old');
    expect(stale).toBe(false);

    // The current nonce is still consumable.
    const current = await service.consumeChallenge(userId, 'nonce-new');
    expect(current).toBe(true);
  });

  it('rejects a replay of the same signature after consumption', async () => {
    userId = await seedUser('nonce-replay', new Date(Date.now() + 60_000));

    expect(await service.consumeChallenge(userId, 'nonce-replay')).toBe(true);
    expect(await service.consumeChallenge(userId, 'nonce-replay')).toBe(false);
    expect(await service.consumeChallenge(userId, 'nonce-replay')).toBe(false);
  });

  it('persists an expiry alongside the nonce', async () => {
    const expiresAt = new Date(Date.now() + 90_000);
    userId = await seedUser('nonce-exp', expiresAt);

    const row = await dataSource
      .getRepository(User)
      .findOneByOrFail({ id: userId });
    expect(row.nonceExpiresAt).toEqual(expiresAt);
  });
});
