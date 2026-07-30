import { EscrowInvite, CreateInviteResponse } from '../types/invite';

const API_BASE_URL = process.env.REACT_APP_API_URL || '/api';

export const inviteService = {
  /**
   * Generates a shareable invite token and link for a given escrow ID.
   */
  async generateInviteLink(escrowId: string): Promise<CreateInviteResponse> {
    const res = await fetch(`${API_BASE_URL}/escrows/${escrowId}/invites`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    });
    if (!res.ok) throw new Error('Failed to generate invite link');
    return res.json();
  },

  /**
   * Fetches invite details using the unique token from the URL route.
   */
  async getInviteByToken(token: string): Promise<EscrowInvite> {
    const res = await fetch(`${API_BASE_URL}/escrows/invites/${token}`);
    if (!res.ok) throw new Error('Invite not found or expired');
    return res.json();
  },

  /**
   * Accepts an escrow invitation.
   */
  async acceptInvite(token: string): Promise<{ success: boolean; escrowId: string }> {
    const res = await fetch(`${API_BASE_URL}/escrows/invites/${token}/accept`, {
      method: 'POST',
    });
    if (!res.ok) throw new Error('Failed to accept invitation');
    return res.json();
  },

  /**
   * Rejects an escrow invitation.
   */
  async rejectInvite(token: string): Promise<{ success: boolean }> {
    const res = await fetch(`${API_BASE_URL}/escrows/invites/${token}/reject`, {
      method: 'POST',
    });
    if (!res.ok) throw new Error('Failed to reject invitation');
    return res.json();
  },

  /**
   * Sends an email invite (triggers backend mailer service).
   */
  async sendEmailInvite(escrowId: string, email: string, inviteLink: string): Promise<void> {
    const res = await fetch(`${API_BASE_URL}/escrows/${escrowId}/invites/email`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, inviteLink }),
    });
    if (!res.ok) throw new Error('Failed to send email invite');
  },

  /**
   * Fetches pending invitations for the current logged-in user.
   */
  async getPendingInvitations(): Promise<EscrowInvite[]> {
    const res = await fetch(`${API_BASE_URL}/user/invitations/pending`);
    if (!res.ok) throw new Error('Failed to fetch pending invitations');
    return res.json();
  },
};
