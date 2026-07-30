import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { InviteAcceptancePage } from '../InviteAcceptancePage';
import { inviteService } from '../../services/inviteService';

jest.mock('../../services/inviteService');

const mockInvite = {
  id: 'inv-123',
  escrowId: 'esc-999',
  escrowTitle: 'Domain Purchase Deal',
  amount: '500',
  tokenSymbol: 'USDC',
  creatorAddress: '0x123...abc',
  inviteToken: 'test-token-xyz',
  inviteLink: 'http://localhost/escrow/invite/test-token-xyz',
  status: 'pending' as const,
  createdAt: new Date().toISOString(),
  expiresAt: new Date(Date.now() + 86400000).toISOString(),
};

describe('InviteAcceptancePage Integration', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders invite details cleanly when token is valid', async () => {
    (inviteService.getInviteByToken as jest.Mock).mockResolvedValue(mockInvite);

    render(
      <MemoryRouter initialEntries={['/escrow/invite/test-token-xyz']}>
        <Routes>
          <Route path="/escrow/invite/:token" element={<InviteAcceptancePage />} />
        </Routes>
      </MemoryRouter>
    );

    expect(screen.getByText(/Loading invitation details.../i)).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText('Domain Purchase Deal')).toBeInTheDocument();
      expect(screen.getByText('500 USDC')).toBeInTheDocument();
    });
  });

  it('triggers accept service call upon button click', async () => {
    (inviteService.getInviteByToken as jest.Mock).mockResolvedValue(mockInvite);
    (inviteService.acceptInvite as jest.Mock).mockResolvedValue({ success: true, escrowId: 'esc-999' });

    render(
      <MemoryRouter initialEntries={['/escrow/invite/test-token-xyz']}>
        <Routes>
          <Route path="/escrow/invite/:token" element={<InviteAcceptancePage />} />
        </Routes>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByTestId('accept-invite-btn')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTestId('accept-invite-btn'));

    await waitFor(() => {
      expect(inviteService.acceptInvite).toHaveBeenCalledWith('test-token-xyz');
    });
  });
});
