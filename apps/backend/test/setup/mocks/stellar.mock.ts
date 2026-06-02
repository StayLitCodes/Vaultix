export interface StellarMock {
  createEscrow: () => Promise<{ escrowId: string }>;
  releaseFunds: () => Promise<boolean>;
}

export const stellarMock: StellarMock = {
  createEscrow: (): Promise<{ escrowId: string }> => {
    return Promise.resolve({ escrowId: 'mock-escrow-id' });
  },

  releaseFunds: (): Promise<boolean> => {
    return Promise.resolve(true);
  },
};
