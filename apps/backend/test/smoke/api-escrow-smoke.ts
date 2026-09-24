import { Keypair } from 'stellar-sdk';

const apiUrl = (process.env.SMOKE_API_URL ?? 'http://127.0.0.1:3001').replace(
  /\/$/,
  '',
);
const horizonUrl = (process.env.HORIZON_URL ?? '').replace(/\/$/, '');
const expectedStatus = process.env.SMOKE_EXPECTED_STATUS ?? 'active';
const amount = 1;

const buyer = keypairFromEnv('SMOKE_BUYER_SECRET', 1);
const seller = keypairFromEnv('SMOKE_SELLER_SECRET', 2);

async function request<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const response = await fetch(`${apiUrl}${path}`, {
    ...options,
    headers: { 'content-type': 'application/json', ...options.headers },
  });
  const body = (await response.json()) as T;
  if (!response.ok) {
    throw new Error(`${options.method ?? 'GET'} ${path} failed (${response.status}): ${JSON.stringify(body)}`);
  }
  return body;
}

async function signIn(keypair: Keypair): Promise<string> {
  const challenge = await request<{ nonce: string; message: string }>(
    '/v1/auth/challenge',
    {
      method: 'POST',
      body: JSON.stringify({ walletAddress: keypair.publicKey() }),
    },
  );
  const verified = await request<{ accessToken: string }>('/v1/auth/verify', {
    method: 'POST',
    body: JSON.stringify({
      publicKey: keypair.publicKey(),
      signature: keypair.sign(Buffer.from(challenge.message)).toString('hex'),
    }),
  });
  return verified.accessToken;
}

async function main(): Promise<void> {
  const buyerToken = await signIn(buyer);
  const sellerToken = await signIn(seller);
  const buyerUser = await request<{ id: string }>('/v1/auth/me', {
    headers: { authorization: `Bearer ${buyerToken}` },
  });
  const sellerUser = await request<{ id: string }>('/v1/auth/me', {
    headers: { authorization: `Bearer ${sellerToken}` },
  });

  const escrow = await request<{
    id: string;
    parties: Array<{ id: string; userId: string }>;
    status: string;
  }>('/v1/escrows', {
    method: 'POST',
    headers: { authorization: `Bearer ${buyerToken}` },
    body: JSON.stringify({
      title: `CI escrow ${Date.now()}`,
      description: 'Deterministic real-backend smoke flow',
      amount,
      asset: { code: 'XLM' },
      type: 'standard',
      parties: [{ userId: sellerUser.id, role: 'seller' }],
      conditions: [
        { description: 'Smoke condition', type: 'manual', metadata: {} },
      ],
      expiresAt: new Date(Date.now() + 86_400_000).toISOString(),
      metadataHash: '00'.repeat(32),
    }),
  });

  const sellerParty = escrow.parties.find(
    (party) => party.userId === sellerUser.id,
  );
  if (!sellerParty) {
    throw new Error('create did not return the seller party');
  }

  await request(`/v1/escrows/${escrow.id}/parties/${sellerParty.id}/accept`, {
    method: 'POST',
    headers: { authorization: `Bearer ${sellerToken}` },
  });

  const funded = await request<{ id: string; status: string; stellarTxHash?: string }>(
    `/v1/escrows/${escrow.id}/fund`,
    {
      method: 'POST',
      headers: { authorization: `Bearer ${buyerToken}` },
      body: JSON.stringify({ amount }),
    },
  );

  if (!funded.stellarTxHash) {
    throw new Error('fund did not return a Stellar transaction hash');
  }

  const finalTransaction = horizonUrl
    ? await waitForFinality(funded.stellarTxHash)
    : undefined;
  const finalEscrow = await waitForEscrowStatus(escrow.id, buyerToken);

  if (finalEscrow.status !== expectedStatus) {
    throw new Error(
      `protocol mismatch: expected escrow status ${expectedStatus}, received ${finalEscrow.status}`,
    );
  }

  console.log(
    JSON.stringify(
      {
        flow: 'sign-in/create/fund/finality',
        buyer: buyer.publicKey(),
        seller: seller.publicKey(),
        escrowId: escrow.id,
        transactionHash: funded.stellarTxHash,
        transactionSuccessful: finalTransaction?.successful ?? 'not-checked',
        status: finalEscrow.status,
        buyerUserId: buyerUser.id,
      },
      null,
      2,
    ),
  );
}

async function waitForEscrowStatus(
  escrowId: string,
  token: string,
): Promise<{ status: string }> {
  for (let attempt = 0; attempt < 30; attempt += 1) {
    const escrow = await request<{ status: string }>(`/v1/escrows/${escrowId}`, {
      headers: { authorization: `Bearer ${token}` },
    });
    if (escrow.status === expectedStatus) {
      return escrow;
    }
    await delay(1000);
  }
  throw new Error(`escrow ${escrowId} did not reach ${expectedStatus}`);
}

async function waitForFinality(
  transactionHash: string,
): Promise<{ successful: boolean }> {
  for (let attempt = 0; attempt < 30; attempt += 1) {
    const response = await fetch(`${horizonUrl}/transactions/${transactionHash}`);
    if (response.ok) {
      const transaction = (await response.json()) as { successful: boolean };
      if (!transaction.successful) {
        throw new Error(`Stellar transaction ${transactionHash} was not successful`);
      }
      return transaction;
    }
    await delay(1000);
  }
  throw new Error(`transaction ${transactionHash} did not reach finality`);
}

function keypairFromEnv(name: string, seedByte: number): Keypair {
  const secret = process.env[name];
  if (secret) {
    return Keypair.fromSecret(secret);
  }
  return Keypair.fromRawEd25519Seed(Buffer.alloc(32, seedByte));
}

function delay(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.stack ?? error.message : error);
  process.exitCode = 1;
});