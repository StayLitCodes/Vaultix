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
    Object.defineProperty(window.navigator, 'userAgent', {
      writable: true,
      value: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/126.0.0.0 Safari/537.36',
    });
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

  it('shows mobile-first guidance and recovery actions on wallet connection errors', async () => {
    mockConnect.mockRejectedValueOnce(new Error('Albedo connection was rejected'));
    (useWallet as jest.Mock).mockReturnValue({
      connect: mockConnect,
      getAvailableWallets: mockGetAvailableWallets,
      isConnecting: false,
      error: 'Albedo connection was rejected',
    });

    Object.defineProperty(window.navigator, 'userAgent', {
      writable: true,
      value: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15',
    });

    render(<ConnectWalletModal isOpen={true} onClose={mockOnClose} />);

    await waitFor(() => {
      expect(screen.getByText('Mobile-first recommended wallet')).toBeInTheDocument();
    });

    const albedoButton = screen.getByText('Albedo').closest('button');
    expect(albedoButton).toBeInTheDocument();

    fireEvent.click(albedoButton!);

    await waitFor(() => {
      expect(mockConnect).toHaveBeenCalledWith('albedo');
      expect(screen.getByText('Retry connection')).toBeInTheDocument();
      expect(screen.getByText('Switch wallet')).toBeInTheDocument();
    });
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
