// Route Map: /escrow/invite/:token
import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { inviteService } from '../services/inviteService';
import { EscrowInvite } from '../types/invite';

export const InviteAcceptancePage: React.FC = () => {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();

  const [invite, setInvite] = useState<EscrowInvite | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (token) {
      loadInviteDetails(token);
    }
  }, [token]);

  const loadInviteDetails = async (inviteToken: string) => {
    try {
      setLoading(true);
      const data = await inviteService.getInviteByToken(inviteToken);
      setInvite(data);
    } catch (err: any) {
      setError(err.message || 'Invalid or expired invitation link.');
    } finally {
      setLoading(false);
    }
  };

  const handleAccept = async () => {
    if (!token) return;
    try {
      setSubmitting(true);
      const res = await inviteService.acceptInvite(token);
      navigate(`/escrow/${res.escrowId}?accepted=true`);
    } catch (err: any) {
      setError(err.message || 'Failed to accept invitation.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleReject = async () => {
    if (!token) return;
    try {
      setSubmitting(true);
      await inviteService.rejectInvite(token);
      navigate('/dashboard?rejected=true');
    } catch (err: any) {
      setError(err.message || 'Failed to reject invitation.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return <div className="loading-container">Loading invitation details...</div>;
  }

  if (error || !invite) {
    return (
      <div className="error-container">
        <h2>Invitation Invalid</h2>
        <p>{error || 'This invitation link could not be found or has expired.'}</p>
        <button onClick={() => navigate('/dashboard')} className="btn-primary">
          Return to Dashboard
        </button>
      </div>
    );
  }

  return (
    <div className="invite-acceptance-container">
      <div className="invite-card">
        <h1>You've Been Invited to an Escrow</h1>
        <p className="subtitle">Review the terms below to accept or reject this deal.</p>

        <div className="invite-details">
          <div className="detail-row">
            <span>Deal Name:</span>
            <strong>{invite.escrowTitle}</strong>
          </div>
          <div className="detail-row">
            <span>Escrow Amount:</span>
            <strong>{invite.amount} {invite.tokenSymbol}</strong>
          </div>
          <div className="detail-row">
            <span>Invited By:</span>
            <code>{invite.creatorAddress}</code>
          </div>
          <div className="detail-row">
            <span>Expires:</span>
            <span>{new Date(invite.expiresAt).toLocaleString()}</span>
          </div>
        </div>

        <div className="action-buttons">
          <button
            onClick={handleAccept}
            disabled={submitting}
            className="btn-accept"
            data-testid="accept-invite-btn"
          >
            {submitting ? 'Processing...' : 'Accept Escrow Invitation'}
          </button>
          <button
            onClick={handleReject}
            disabled={submitting}
            className="btn-reject"
            data-testid="reject-invite-btn"
          >
            Reject
          </button>
        </div>
      </div>
    </div>
  );
};
