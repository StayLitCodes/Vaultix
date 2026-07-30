import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { inviteService } from '../../services/inviteService';
import { EscrowInvite } from '../../types/invite';

export const PendingInvitationsWidget: React.FC = () => {
  const [invitations, setInvitations] = useState<EscrowInvite[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    fetchPending();
  }, []);

  const fetchPending = async () => {
    try {
      const data = await inviteService.getPendingInvitations();
      setInvitations(data);
    } catch {
      // Handle gracefully on dashboard
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <div>Loading pending invites...</div>;
  if (invitations.length === 0) return null;

  return (
    <section className="pending-invites-widget" data-testid="pending-invites-widget">
      <h3>Pending Escrow Invitations ({invitations.length})</h3>
      <ul className="invite-list">
        {invitations.map((inv) => (
          <li key={inv.id} className="invite-item">
            <div className="invite-info">
              <strong>{inv.escrowTitle}</strong>
              <span>{inv.amount} {inv.tokenSymbol}</span>
            </div>
            <Link to={`/escrow/invite/${inv.inviteToken}`} className="btn-sm-primary">
              View & Respond
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
};
