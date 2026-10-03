import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { ConnectWalletModal } from '../ConnectWalletModal';
import { useWallet } from '@/app/contexts/WalletContext';

jest.mock('@/app/contexts/WalletContext', () => ({ useWallet: jest.fn() }));

describe('ConnectWalletModal', () => {
  const onClose = jest.fn();
  const connect = jest.fn();
  const getAvailableWallets = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    connect.mockResolvedValue(undefined);
    getAvailableWallets.mockResolvedValue(['freighter']);
    (useWallet as jest.Mock).mockReturnValue({
      connect,
      getAvailableWallets,
      isConnecting: false,
      error: null,
    });
  });

  it('does not render while closed', () => {
    render(<ConnectWalletModal isOpen={false} onClose={onClose} />);
    expect(screen.queryByText('Connect Wallet')).not.toBeInTheDocument();
  });

  it('shows supported wallets when open', async () => {
    render(<ConnectWalletModal isOpen onClose={onClose} />);
    expect(screen.getByText('Connect Wallet')).toBeInTheDocument();
    await waitFor(() => expect(screen.getByText('Freighter')).toBeInTheDocument());
  });

  it('connects the selected wallet and closes on success', async () => {
    render(<ConnectWalletModal isOpen onClose={onClose} />);
    await waitFor(() => expect(screen.getByText('Freighter')).toBeInTheDocument());
    fireEvent.click(screen.getByText('Freighter'));
    await waitFor(() => expect(connect).toHaveBeenCalledWith('freighter'));
    expect(onClose).toHaveBeenCalled();
  });
});
