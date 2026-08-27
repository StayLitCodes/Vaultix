import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { ConnectWalletModal } from '../ConnectWalletModal';
import { useWallet } from '@/app/contexts/WalletContext';

jest.mock('@/app/contexts/WalletContext', () => ({
  useWallet: jest.fn(),
}));

const mockUseWallet = useWallet as jest.Mock;

describe('ConnectWalletModal Handshake & Error Recovery Matrix', () => {
  const mockOnClose = jest.fn();
  const mockConnect = jest.fn();
  const mockGetAvailableWallets = jest.fn();

  const setWalletState = (overrides: Partial<ReturnType<typeof useWallet>> = {}) => {
    mockUseWallet.mockReturnValue({
      connect: mockConnect,
      getAvailableWallets: mockGetAvailableWallets,
      isConnecting: false,
      error: null,
      ...overrides,
    });
  };

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    mockGetAvailableWallets.mockResolvedValue(['albedo']);
    setWalletState();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  // --- Core Lifecycle & Happy Path Tests ---
  it('does not render when isOpen is false', () => {
    render(<ConnectWalletModal isOpen={false} onClose={mockOnClose} />);
    expect(screen.queryByText('Connect Wallet')).not.toBeInTheDocument();
  });

  it('renders correctly when open', async () => {
    render(<ConnectWalletModal isOpen={true} onClose={mockOnClose} />);
    expect(screen.getByText('Connect Wallet')).toBeInTheDocument();
    await waitFor(() => expect(mockGetAvailableWallets).toHaveBeenCalled());
    expect(screen.getByText('Freighter')).toBeInTheDocument();
    expect(screen.getByText('Albedo')).toBeInTheDocument();
    expect(screen.getByText('Lobstr')).toBeInTheDocument();
  });

  it('calls onClose when connection succeeds cleanly', async () => {
    mockConnect.mockResolvedValue(undefined);

    render(<ConnectWalletModal isOpen={true} onClose={mockOnClose} />);
    await waitFor(() => expect(mockGetAvailableWallets).toHaveBeenCalled());

    fireEvent.click(screen.getByText('Albedo'));

    await waitFor(() => {
      expect(mockConnect).toHaveBeenCalledWith('albedo');
      expect(mockOnClose).toHaveBeenCalled();
    });
  });

  // --- Feature-Critical Error Scenario Tests ---
  it('should render the install link for a wallet that is not detected', async () => {
    mockGetAvailableWallets.mockResolvedValue([]);

    render(<ConnectWalletModal isOpen={true} onClose={mockOnClose} />);
    await waitFor(() => expect(mockGetAvailableWallets).toHaveBeenCalled());

    expect(screen.getAllByText('Install').length).toBeGreaterThan(0);
  });

  it('should catch user rejection errors and display a retry action', async () => {
    mockConnect.mockRejectedValue(new Error('User rejected the request'));

    render(<ConnectWalletModal isOpen={true} onClose={mockOnClose} />);
    await waitFor(() => expect(mockGetAvailableWallets).toHaveBeenCalled());

    fireEvent.click(screen.getByText('Albedo'));

    await waitFor(() => {
      expect(screen.getByText(/Connection request was cancelled by the user/i)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Retry Handshake/i })).toBeInTheDocument();
    });
  });

  it('should show a locked-wallet message when the provider reports a locked error', async () => {
    mockConnect.mockRejectedValue(new Error('Wallet is locked'));

    render(<ConnectWalletModal isOpen={true} onClose={mockOnClose} />);
    await waitFor(() => expect(mockGetAvailableWallets).toHaveBeenCalled());

    fireEvent.click(screen.getByText('Albedo'));

    await waitFor(() => {
      expect(screen.getByText(/provider extension appears to be locked/i)).toBeInTheDocument();
    });
  });

  it('should transition into a timeout error after 30 seconds', async () => {
    mockConnect.mockReturnValue(new Promise(() => {}));
    setWalletState({ isConnecting: true });

    render(<ConnectWalletModal isOpen={true} onClose={mockOnClose} />);
    await waitFor(() => expect(mockGetAvailableWallets).toHaveBeenCalled());

    fireEvent.click(screen.getByText('Albedo'));

    jest.advanceTimersByTime(31000);

    await waitFor(() => {
      expect(screen.getByText(/Connection handshake timed out after 30 seconds/i)).toBeInTheDocument();
    });
  });

  // --- Button Protection Locks & Modal Close ---
  it('should show a spinner and disable other actions while connecting', async () => {
    mockConnect.mockReturnValue(new Promise(() => {}));
    setWalletState({ isConnecting: true });

    render(<ConnectWalletModal isOpen={true} onClose={mockOnClose} />);
    await waitFor(() => expect(mockGetAvailableWallets).toHaveBeenCalled());

    fireEvent.click(screen.getByText('Albedo'));

    expect(screen.getByText(/Linking.../i)).toBeInTheDocument();
    expect(screen.getByLabelText('Close Modal')).toBeDisabled();
  });

  it('calls onClose when the close button is clicked', async () => {
    render(<ConnectWalletModal isOpen={true} onClose={mockOnClose} />);
    await waitFor(() => expect(mockGetAvailableWallets).toHaveBeenCalled());

    fireEvent.click(screen.getByLabelText('Close Modal'));
    expect(mockOnClose).toHaveBeenCalled();
  });
});
