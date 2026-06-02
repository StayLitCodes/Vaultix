import React from 'react';
import { render, screen } from '@testing-library/react';
import EscrowCard from './EscrowCard';

const mockEscrow: any = {
  id: '1',
  title: 'Test Escrow',
  description: 'Test Description',
  amount: '100',
  asset: 'XLM',
  creatorAddress: 'G...',
  counterpartyAddress: 'G1234567890abcdef',
  deadline: '2025-12-31T23:59:59Z',
  status: 'funded',
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
    const disputedEscrow = { ...mockEscrow, status: 'disputed' };
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

  it('shows Confirm Delivery and Dispute actions for confirmed status', () => {
    const confirmedEscrow = { ...mockEscrow, status: 'confirmed' };
    render(<EscrowCard escrow={confirmedEscrow} />);
    
    const confirmLink = screen.getByText('Confirm Delivery');
    const disputeLink = screen.getByText('Dispute');
    
    expect(confirmLink).toHaveAttribute('href', '/escrow/1/confirm');
    expect(disputeLink).toHaveAttribute('href', '/escrow/1/dispute');
  });
});
