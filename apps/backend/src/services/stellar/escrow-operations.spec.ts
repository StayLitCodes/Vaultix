import { EscrowOperationsService } from './escrow-operations';
import * as StellarSdk from '@stellar/stellar-sdk';

describe('EscrowOperationsService resolve_dispute ABI', () => {
  const CONTRACT_ID =
    'CBABDGJVNEYK5BBPONB72RURWSP4M4JPFAPZHV57ZRZAUTNGIAXZCTPD';
  const WINNER = 'GDUFSMLFHQGXE5DN2BYE5CH6D3GSASUM7O3N4GMKW6SFXUMUO5AMC77E';

  let service: EscrowOperationsService;
  let callArgs: StellarSdk.xdr.ScVal[];

  // ScVal.vec() is typed `T[] | null`; narrow it for assertions.
  const vecOf = (val: StellarSdk.xdr.ScVal): StellarSdk.xdr.ScVal[] =>
    val.vec() ?? [];

  beforeEach(() => {
    process.env.STELLAR_CONTRACT_ID = CONTRACT_ID;
    service = new EscrowOperationsService();
    jest.spyOn(StellarSdk.Contract.prototype, 'call').mockImplementation(((
      _name: string,
      ...args: StellarSdk.xdr.ScVal[]
    ) => {
      callArgs = args;
      return {} as StellarSdk.xdr.Operation;
    }) as never);
  });

  afterEach(() => {
    jest.restoreAllMocks();
    delete process.env.STELLAR_CONTRACT_ID;
  });

  it('encodes all four arguments with none/none defaults', () => {
    service.createResolveDisputeOps('42', WINNER);

    expect(callArgs).toHaveLength(4);
    // escrow_id: u64
    expect(callArgs[0].u64().toString()).toBe('42');
    // winner: Address
    expect(
      StellarSdk.Address.fromScAddress(callArgs[1].address()).toString(),
    ).toBe(WINNER);
    // split_winner_amount: Option::None
    expect(vecOf(callArgs[2])).toHaveLength(0);
    // resolution_evidence_hash: Option::None
    expect(vecOf(callArgs[3])).toHaveLength(0);
  });

  it('encodes Option::Some split amount as i128', () => {
    service.createResolveDisputeOps('42', WINNER, '1000');

    expect(callArgs).toHaveLength(4);
    const split = vecOf(callArgs[2]);
    expect(split).toHaveLength(1);
    const parts = split[0].i128();
    expect(BigInt(parts.lo().toString())).toBe(1000n);
    expect(BigInt(parts.hi().toString())).toBe(0n);
    expect(vecOf(callArgs[3])).toHaveLength(0);
  });

  it('encodes a high split amount across the i128 hi/lo words', () => {
    const amount = (1n << 70n) + 12345n;
    service.createResolveDisputeOps('42', WINNER, amount.toString());

    const parts = vecOf(callArgs[2])[0].i128();
    expect(BigInt(parts.lo().toString())).toBe(amount & ((1n << 64n) - 1n));
    expect(BigInt(parts.hi().toString())).toBe(amount >> 64n);
  });

  it('encodes Option::Some evidence hash as a 32-byte digest', () => {
    const hex = 'ab'.repeat(32);
    service.createResolveDisputeOps('42', WINNER, undefined, hex);

    expect(callArgs).toHaveLength(4);
    expect(vecOf(callArgs[2])).toHaveLength(0);
    const evidence = vecOf(callArgs[3]);
    expect(evidence).toHaveLength(1);
    expect(evidence[0].bytes().toString('hex')).toBe(hex);
  });

  it('encodes both optionals together (some/some)', () => {
    const hex = 'cd'.repeat(32);
    service.createResolveDisputeOps('42', WINNER, '2000', hex);

    expect(vecOf(callArgs[2])).toHaveLength(1);
    expect(vecOf(callArgs[3])[0].bytes().toString('hex')).toBe(hex);
  });

  it('normalizes an IPFS CID evidence reference to a raw digest', () => {
    // Qm... CIDv0 sha2-256 multihash
    const cid = 'QmbWqxBEKC3P8tqsKc98xmWNzrzDtRLMiMPL8wBuTGsMnR';
    service.createResolveDisputeOps('42', WINNER, undefined, cid);

    const evidence = vecOf(callArgs[3]);
    expect(evidence).toHaveLength(1);
    expect(evidence[0].bytes()).toHaveLength(32);
  });

  it('rejects a malformed split amount instead of dropping it', () => {
    expect(() => service.createResolveDisputeOps('42', WINNER, 'abc')).toThrow(
      /non-negative integer/i,
    );
    expect(() => service.createResolveDisputeOps('42', WINNER, '-1')).toThrow(
      /non-negative integer/i,
    );
  });

  it('rejects an out-of-range split amount', () => {
    const tooBig = ((1n << 127n) + 1n).toString();
    expect(() => service.createResolveDisputeOps('42', WINNER, tooBig)).toThrow(
      /i128/i,
    );
  });

  it('rejects a malformed evidence hash instead of dropping it', () => {
    // 'zz' is neither a 32-byte hex digest nor a parseable CID.
    expect(() =>
      service.createResolveDisputeOps('42', WINNER, undefined, 'zz'),
    ).toThrow();
    // 16-byte hex is rejected as not being a full sha2-256 digest.
    expect(() =>
      service.createResolveDisputeOps('42', WINNER, undefined, 'ab'.repeat(16)),
    ).toThrow(/64 hex characters|32 bytes/i);
  });

  it('produces an operation whose XDR round-trips to the four args', () => {
    // Use the real Contract.call to obtain the operation, then decode its args.
    jest.restoreAllMocks();
    const realService = new EscrowOperationsService();
    const [op] = realService.createResolveDisputeOps(
      '7',
      WINNER,
      '500',
      'ef'.repeat(32),
    );

    const decoded = StellarSdk.xdr.Operation.fromXDR(op.toXDR());
    const invoke = decoded
      .body()
      .invokeHostFunctionOp()
      .hostFunction()
      .invokeContract();
    expect(invoke.functionName().toString()).toBe('resolve_dispute');
    expect(invoke.args()).toHaveLength(4);
    expect(invoke.args()[2].vec()).toHaveLength(1);
    expect(invoke.args()[3].vec()?.[0].bytes()).toHaveLength(32);
  });
});
