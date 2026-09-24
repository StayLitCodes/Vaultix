/**
 * #550 — real Stellar challenge/response sign-in.
 *
 *   1. Resolve the built-in wallet keypair (created on first run, stored in the
 *      device keychain by `services/wallet.ts`).
 *   2. Ask the backend for a nonce-backed challenge for that address.
 *   3. Sign the challenge message with the keypair.
 *   4. Exchange the signature for a JWT pair and persist it in SecureStore.
 */
import { authApi } from './api';
import { saveSession, Session } from './session';
import { connectWithBuiltInWallet, signMessage } from './wallet';

export async function signInWithBuiltInWallet(): Promise<Session> {
  const { address } = await connectWithBuiltInWallet();

  const challenge = await authApi.requestChallenge(address);
  if (!challenge?.message) {
    throw new Error('The server returned an invalid sign-in challenge.');
  }

  const signature = await signMessage(challenge.message);

  const { accessToken, refreshToken } = await authApi.verifySignature(address, signature);
  if (!accessToken) {
    throw new Error('The server did not return an access token.');
  }

  const session: Session = { accessToken, refreshToken, walletAddress: address };
  await saveSession(session);
  return session;
}
