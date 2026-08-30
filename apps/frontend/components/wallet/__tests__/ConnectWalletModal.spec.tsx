import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import ConnectWalletModal from '../ConnectWalletModal';
import * as freighter from '@stellar/freighter-api';

// Mock the external global freighter module bindings
jest.mock('@stellar/freighter-api', () => ({
  isAvailable: jest.fn(),
  getPublicKey: jest.fn(),
}));

describe('ConnectWalletModal Handshake & Error Recovery Matrix', () => {
  const mockOnClose = jest.fn();
  const mockOnSuccess = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  // --- Core Lifecycle & Happy Path Tests ---
  it('does not render when isOpen is false', () => {
    render(
      <ConnectWalletModal isOpen={false} onClose={mockOnClose} onSuccess={mockOnSuccess} />
    );
    expect(screen.queryByText('Anchor Core Identity')).not.toBeInTheDocument();
  });

  it('renders correctly when open', () => {
    render(
      <ConnectWalletModal isOpen={true} onClose={mockOnClose} onSuccess={mockOnSuccess} />
    );
    expect(screen.getByText('Anchor Core Identity')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Connect Freighter Wallet/i })).toBeInTheDocument();
  });

  it('calls onSuccess and onClose when connection succeeds cleanly', async () => {
    (freighter.isAvailable as jest.Mock).mockResolvedValue(true);
    (freighter.getPublicKey as jest.Mock).mockResolvedValue('GB...VALID_STELLAR_ADDRESS');

    render(
      <ConnectWalletModal isOpen={true} onClose={mockOnClose} onSuccess={mockOnSuccess} />
    );

    fireEvent.click(screen.getByRole('button', { name: /Connect Freighter Wallet/i }));

    await waitFor(() => {
      expect(mockOnSuccess).toHaveBeenCalledWith('GB...VALID_STELLAR_ADDRESS');
      expect(mockOnClose).toHaveBeenCalled();
    });
  });

  // --- Feature-Critical Error Scenario Tests (#394) ---
  it('should render the download install link variant when freighter is not found', async () => {
    (freighter.isAvailable as jest.Mock).mockResolvedValue(false);

    render(
      <ConnectWalletModal isOpen={true} onClose={mockOnClose} onSuccess={mockOnSuccess} />
    );

    fireEvent.click(screen.getByRole('button', { name: /Connect Freighter Wallet/i }));

    await waitFor(() => {
      expect(screen.getByText(/Freighter wallet extension was not detected/i)).toBeInTheDocument();
      expect(screen.getByRole('link', { name: /Install Freighter Extension/i })).toBeInTheDocument();
    });
  });

  it('should catch user context rejection events and display action retry configurations', async () => {
    (freighter.isAvailable as jest.Mock).mockResolvedValue(true);
    (freighter.getPublicKey as jest.Mock).mockRejectedValue(new Error('User rejected the transaction connection'));

    render(
      <ConnectWalletModal isOpen={true} onClose={mockOnClose} onSuccess={mockOnSuccess} />
    );

    fireEvent.click(screen.getByRole('button', { name: /Connect Freighter Wallet/i }));

    await waitFor(() => {
      expect(screen.getByText(/Connection request was cancelled by the user/i)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Retry Connection Sequence/i })).toBeInTheDocument();
    });
  });

  it('should detect and throw accurate error UI wrappers when the extension public key is locked/empty', async () => {
    (freighter.isAvailable as jest.Mock).mockResolvedValue(true);
    (freighter.getPublicKey as jest.Mock).mockResolvedValue(''); // Empty token means wallet lock state

    render(
      <ConnectWalletModal isOpen={true} onClose={mockOnClose} onSuccess={mockOnSuccess} />
    );

    fireEvent.click(screen.getByRole('button', { name: /Connect Freighter Wallet/i }));

    await waitFor(() => {
      expect(screen.getByText(/Your Freighter wallet appears locked/i)).toBeInTheDocument();
    });
  });

  it('should transition into failure state when connection exceeds the 30s timeout line', async () => {
    (freighter.isAvailable as jest.Mock).mockResolvedValue(true);
    // Unresolving promise to simulate an ongoing handshake hang
    (freighter.getPublicKey as jest.Mock).mockReturnValue(new Promise(() => {}));

    render(
      <ConnectWalletModal isOpen={true} onClose={mockOnClose} onSuccess={mockOnSuccess} />
    );

    fireEvent.click(screen.getByRole('button', { name: /Connect Freighter Wallet/i }));
    
    // Fast forward mock timers past 30 seconds
    jest.advanceTimersByTime(31000);

    await waitFor(() => {
      expect(screen.getByText(/Connection request timed out after 30 seconds/i)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Retry Connection Sequence/i })).toBeInTheDocument();
    });
  });

  // --- Button Protection Locks & Modal Close ---
  it('should show spinner state and disable double clicks during active connection runs', async () => {
    (freighter.isAvailable as jest.Mock).mockResolvedValue(true);
    (freighter.getPublicKey as jest.Mock).mockReturnValue(new Promise(() => {})); // remains loading

    render(
      <ConnectWalletModal isOpen={true} onClose={mockOnClose} onSuccess={mockOnSuccess} />
    );

    const connectButton = screen.getByRole('button', { name: /Connect Freighter Wallet/i });
    fireEvent.click(connectButton);

    expect(screen.getByText(/Approving Handshake.../i)).toBeInTheDocument();
    expect(connectButton).toBeDisabled();
  });

  it('calls onClose when close navigation X button is clicked', () => {
    render(
      <ConnectWalletModal isOpen={true} onClose={mockOnClose} onSuccess={mockOnSuccess} />
    );
    
    const closeBtn = screen.getByRole('button', { name: /close modal/i });
    fireEvent.click(closeBtn);
    expect(mockOnClose).toHaveBeenCalled();
  });
});