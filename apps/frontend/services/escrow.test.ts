import { EscrowService } from './escrow';
import { EscrowService as ApiEscrowService } from './escrow-api';

jest.mock('./escrow-api', () => ({
  EscrowService: {
    getEscrows: jest.fn(),
    getEscrowById: jest.fn(),
    createEscrow: jest.fn(),
    fundEscrow: jest.fn(),
    releaseFunds: jest.fn(),
    cancelEscrow: jest.fn(),
    fileDispute: jest.fn(),
    updateEscrowStatus: jest.fn(),
  },
}));

const api = ApiEscrowService as jest.Mocked<typeof ApiEscrowService>;

describe('services/escrow typed action dispatch', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('releaseEscrow calls the implemented releaseFunds directly', async () => {
    const escrow = { id: 'e1' } as never;
    api.releaseFunds.mockResolvedValue(escrow);

    const result = await EscrowService.releaseEscrow('e1');

    expect(api.releaseFunds).toHaveBeenCalledWith('e1');
    expect(result).toBe(escrow);
    // No status-mutation fallback involved.
    expect(api.updateEscrowStatus).not.toHaveBeenCalled();
  });

  it('disputeEscrow calls the implemented fileDispute with the payload', async () => {
    const escrow = { id: 'e1' } as never;
    api.fileDispute.mockResolvedValue(escrow);
    const payload = {
      reason: 'Work not delivered',
      description: 'Missing final deliverable',
      evidence: ['ipfs://abc'],
    };

    const result = await EscrowService.disputeEscrow('e1', payload);

    expect(api.fileDispute).toHaveBeenCalledWith('e1', payload);
    expect(result).toBe(escrow);
    expect(api.updateEscrowStatus).not.toHaveBeenCalled();
  });

  it('preserves evidence-only dispute payloads', async () => {
    const escrow = { id: 'e1' } as never;
    api.fileDispute.mockResolvedValue(escrow);

    await EscrowService.disputeEscrow('e1', {
      reason: 'r',
      evidence: ['a', 'b'],
    });

    expect(api.fileDispute).toHaveBeenCalledWith('e1', {
      reason: 'r',
      evidence: ['a', 'b'],
    });
  });

  it('fundEscrow forwards the real amount and asset', async () => {
    const escrow = { id: 'e1' } as never;
    api.fundEscrow.mockResolvedValue(escrow);

    await EscrowService.fundEscrow('e1', { amount: '100', asset: 'XLM' });

    expect(api.fundEscrow).toHaveBeenCalledWith('e1', {
      amount: '100',
      asset: 'XLM',
    });
    expect(api.updateEscrowStatus).not.toHaveBeenCalled();
  });

  it('cancelEscrow calls the implemented cancelEscrow directly', async () => {
    const escrow = { id: 'e1' } as never;
    api.cancelEscrow.mockResolvedValue(escrow);

    await EscrowService.cancelEscrow('e1', 'changed my mind');

    expect(api.cancelEscrow).toHaveBeenCalledWith('e1', 'changed my mind');
  });

  it('propagates a failed release without an optimistic success', async () => {
    api.releaseFunds.mockRejectedValue(new Error('release failed'));

    await expect(EscrowService.releaseEscrow('e1')).rejects.toThrow(
      'release failed',
    );
  });

  it('propagates a failed dispute without an optimistic success', async () => {
    api.fileDispute.mockRejectedValue(new Error('dispute rejected'));

    await expect(
      EscrowService.disputeEscrow('e1', { reason: 'r' }),
    ).rejects.toThrow('dispute rejected');
  });

  it('no longer probes for a non-existent releaseEscrow/disputeEscrow on the API', async () => {
    // The API class exposes releaseFunds/fileDispute; the wrapper must not
    // rely on runtime feature-detection of names that do not exist.
    expect((ApiEscrowService as unknown as Record<string, unknown>).releaseEscrow).toBeUndefined();
    expect((ApiEscrowService as unknown as Record<string, unknown>).disputeEscrow).toBeUndefined();
  });
});
