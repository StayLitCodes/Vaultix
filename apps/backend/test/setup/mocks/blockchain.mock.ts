export interface BlockchainMock {
  getBalance: (address: string) => Promise<number>;
  sendTransaction: (tx: Record<string, unknown>) => Promise<{ hash: string }>;
  getTransactionStatus: (hash: string) => Promise<'pending' | 'confirmed'>;
}

export const blockchainMock: BlockchainMock = {
  getBalance: (address: string): Promise<number> => {
    void address;
    return Promise.resolve(1000); // mock balance
  },

  sendTransaction: (tx: Record<string, unknown>): Promise<{ hash: string }> => {
    void tx;
    return Promise.resolve({ hash: 'mock-tx-hash' });
  },

  getTransactionStatus: (hash: string): Promise<'pending' | 'confirmed'> => {
    void hash;
    return Promise.resolve('confirmed');
  },
};
