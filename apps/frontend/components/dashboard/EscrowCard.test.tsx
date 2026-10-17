import React from 'react';
import { render, screen } from '@testing-library/react';
import EscrowCard from './EscrowCard';
import { CanonicalEscrowStatus } from '@/utils/escrowStatus';

const mockEscrow: any = {
  id: '1',
  title: 'Test Escrow',
  description: 'Test Description',
  amount: '100',
  asset: 'XLM',
  creatorAddress: 'G...',
  counterpartyAddress: 'G1234567890abcdef',
  deadline: '2025-12-31T23:59:59Z',
  status: CanonicalEscrowStatus.FUNDED,
  createdAt: '2025-01-01T00:00:00Z',
  updatedAt: '2025-01-01T00:00:00Z',
};

describe('EscrowCard', () => {
  it('renders escrow details correctly', () => {
    render(<EscrowCard escrow={mockEscrow} />);
    
    expect(screen.getByText('Test Escrow')).toBeInTheDocument();
    expect(screen.getByText('Test Description')).toBeInTheDocument();
    expect(screen.getByText('100 XLM')).toBeInTheDocument();
    expect(screen.getByText('Funded')).toBeInTheDocument();
  });

  it('renders correct status colors for funded status', () => {
    const { container } = render(<EscrowCard escrow={mockEscrow} />);
    const badge = screen.getByText('Funded');
    expect(badge).toHaveClass('bg-blue-100');
    expect(badge).toHaveClass('text-blue-800');
  });

  it('renders correct status colors for disputed status', () => {
    const disputedEscrow = { ...mockEscrow, status: CanonicalEscrowStatus.DISPUTED };
    render(<EscrowCard escrow={disputedEscrow} />);
    const badge = screen.getByText('Disputed');
    expect(badge).toHaveClass('bg-red-100');
    expect(badge).toHaveClass('text-red-800');
  });

  it('shows View Details action for funded status', () => {
    render(<EscrowCard escrow={mockEscrow} />);
    const link = screen.getByText('View Details');
    expect(link).toHaveAttribute('href', '/escrow/1');
  });

  it('shows Confirm Delivery and Dispute actions for an active escrow', () => {
    const activeEscrow = { ...mockEscrow, status: CanonicalEscrowStatus.ACTIVE };
    render(<EscrowCard escrow={activeEscrow} />);

    const confirmLink = screen.getByText('Confirm Delivery');
    const disputeLink = screen.getByText('Dispute');

    expect(confirmLink).toHaveAttribute('href', '/escrow/1/confirm');
    expect(disputeLink).toHaveAttribute('href', '/escrow/1/dispute');
  });

  it('does not offer financial actions for terminal statuses', () => {
    for (const status of [
      CanonicalEscrowStatus.COMPLETED,
      CanonicalEscrowStatus.CANCELLED,
      CanonicalEscrowStatus.EXPIRED,
      CanonicalEscrowStatus.REFUNDED,
      CanonicalEscrowStatus.RESOLVED,
    ]) {
      const { unmount } = render(<EscrowCard escrow={{ ...mockEscrow, status }} />);
      expect(screen.queryByText('Confirm Delivery')).not.toBeInTheDocument();
      expect(screen.queryByText('Dispute')).not.toBeInTheDocument();
      unmount();
    }
  });

  it('does not offer financial actions for an unknown status', () => {
    const unknownEscrow = {
      ...mockEscrow,
      status: CanonicalEscrowStatus.UNKNOWN,
    };
    render(<EscrowCard escrow={unknownEscrow} />);

    expect(screen.getByText('Unknown')).toBeInTheDocument();
    expect(screen.queryByText('Confirm Delivery')).not.toBeInTheDocument();
    expect(screen.queryByText('Dispute')).not.toBeInTheDocument();
  });

  it('renders an explicit label for an expired escrow', () => {
    const expiredEscrow = {
      ...mockEscrow,
      status: CanonicalEscrowStatus.EXPIRED,
    };
    render(<EscrowCard escrow={expiredEscrow} />);

    const badge = screen.getByText('Expired');
    expect(badge).toHaveClass('bg-amber-100');
    expect(badge).toHaveClass('text-amber-800');
  });
});
