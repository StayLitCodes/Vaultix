import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ConnectWalletModal } from './ConnectWalletModal';
import { useWallet } from '@/app/contexts/WalletContext';

// Mock useWallet hook
jest.mock('@/app/contexts/WalletContext', () => ({
  useWallet: jest.fn(),
}));

describe('ConnectWalletModal', () => {
  const mockOnClose = jest.fn();
  const mockConnect = jest.fn();
  const mockGetAvailableWallets = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    (useWallet as jest.Mock).mockReturnValue({
      connect: mockConnect,
      getAvailableWallets: mockGetAvailableWallets,
      isConnecting: false,
      error: null,
    });
    mockGetAvailableWallets.mockResolvedValue(['freighter']);
  });

  it('does not render when isOpen is false', () => {
    render(<ConnectWalletModal isOpen={false} onClose={mockOnClose} />);
    expect(screen.queryByText('Connect Wallet')).not.toBeInTheDocument();
  });

  it('renders correctly when open', async () => {
    render(<ConnectWalletModal isOpen={true} onClose={mockOnClose} />);
    expect(screen.getByText('Connect Wallet')).toBeInTheDocument();
    
    await waitFor(() => {
      expect(screen.getByText('Freighter')).toBeInTheDocument();
    });
  });

  it('calls connect when a wallet is clicked', async () => {
    render(<ConnectWalletModal isOpen={true} onClose={mockOnClose} />);
    
    await waitFor(() => screen.getByText('Freighter'));
    
    fireEvent.click(screen.getByText('Freighter'));
    
    expect(mockConnect).toHaveBeenCalledWith('freighter');
  });

  it('shows error message if there is an error', () => {
    (useWallet as jest.Mock).mockReturnValue({
      connect: mockConnect,
      getAvailableWallets: mockGetAvailableWallets,
      isConnecting: false,
      error: 'Failed to connect',
    });
    
    render(<ConnectWalletModal isOpen={true} onClose={mockOnClose} />);
    expect(screen.getByText('Failed to connect')).toBeInTheDocument();
  });

  it('calls onClose when close button is clicked', () => {
    render(<ConnectWalletModal isOpen={true} onClose={mockOnClose} />);
    const closeButton = screen.getByRole('button', { name: '' }); // The X icon button
    // Alternatively, find by the SVG class or similar if name is empty
    // Let's use the first button which is the close button in our case
    const buttons = screen.getAllByRole('button');
    fireEvent.click(buttons[0]);
    expect(mockOnClose).toHaveBeenCalled();
  });
});
