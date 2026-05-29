import { Keypair } from '@stellar/stellar-sdk';
import { extractWalletCallback, verifyWalletSignature } from './wallet';

describe('wallet deep-link helpers', () => {
  it('verifies a valid signature and rejects invalid data', () => {
    const keypair = Keypair.random();
    const challenge = 'Vaultix mobile connect challenge 123';
    const message = Buffer.from(challenge, 'utf8');
    const signature = keypair.sign(message).toString('base64');

    expect(verifyWalletSignature(keypair.publicKey(), challenge, signature)).toBe(true);
    expect(verifyWalletSignature(keypair.publicKey(), challenge, 'invalid-signature')).toBe(false);
  });

  it('extracts callback parameters from the wallet redirect URL', () => {
    const publicKey = Keypair.random().publicKey();
    const signature = 'signature-payload';
    const challenge = 'challenge-token';
    const callbackUrl = `vaultix://wallet/callback?publicKey=${encodeURIComponent(publicKey)}&signature=${encodeURIComponent(signature)}&challenge=${encodeURIComponent(challenge)}`;

    expect(extractWalletCallback(callbackUrl)).toEqual({
      publicKey,
      signature,
      challenge,
    });
  });
});
