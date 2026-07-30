import React, { useState, useEffect } from 'react';
import { inviteService } from '../../services/inviteService';

interface ShareEscrowModalProps {
  isOpen: boolean;
  onClose: () => void;
  escrowId: string;
  escrowTitle: string;
}

export const ShareEscrowModal: React.FC<ShareEscrowModalProps> = ({
  isOpen,
  onClose,
  escrowId,
  escrowTitle,
}) => {
  const [inviteLink, setInviteLink] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const [copied, setCopied] = useState<boolean>(false);
  const [email, setEmail] = useState<string>('');
  const [emailSent, setEmailSent] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen && !inviteLink) {
      handleGenerateLink();
    }
  }, [isOpen]);

  const handleGenerateLink = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await inviteService.generateInviteLink(escrowId);
      setInviteLink(data.inviteLink);
    } catch (err: any) {
      setError(err.message || 'Failed to generate link');
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(inviteLink);
      setCopied(true);
      setTimeout(() => setCopied(false), 3000);
    } catch {
      setError('Failed to copy link to clipboard');
    }
  };

  const handleWebShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: `Escrow Invite: ${escrowTitle}`,
          text: `You have been invited to an escrow deal: ${escrowTitle}`,
          url: inviteLink,
        });
      } catch (err) {
        // User cancelled share
      }
    } else {
      handleCopy();
    }
  };

  const handleSendEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !inviteLink) return;
    try {
      setLoading(true);
      await inviteService.sendEmailInvite(escrowId, email, inviteLink);
      setEmailSent(true);
      setEmail('');
      setTimeout(() => setEmailSent(false), 4000);
    } catch (err: any) {
      setError(err.message || 'Failed to send email invite');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  const encodedUrl = encodeURIComponent(inviteLink);
  const encodedText = encodeURIComponent(`Join my escrow deal: ${escrowTitle}`);

  return (
    <div className="modal-overlay" role="dialog" aria-labelledby="share-modal-title">
      <div className="modal-content">
        <header className="modal-header">
          <h2 id="share-modal-title">Share Escrow Invitation</h2>
          <button className="close-btn" onClick={onClose} aria-label="Close modal">&times;</button>
        </header>

        {error && <div className="error-banner">{error}</div>}

        {loading && !inviteLink ? (
          <div className="loading-spinner">Generating secure invite link...</div>
        ) : (
          <div className="modal-body">
            {/* Direct Link Section */}
            <div className="input-group">
              <label htmlFor="invite-link-input">Shareable Invite Link</label>
              <div className="copy-field">
                <input
                  id="invite-link-input"
                  type="text"
                  readOnly
                  value={inviteLink}
                  aria-label="Escrow invite link"
                />
                <button onClick={handleCopy} className="btn-primary">
                  {copied ? 'Copied!' : 'Copy'}
                </button>
              </div>
            </div>

            {/* Native / Social Share Options */}
            <div className="share-actions">
              {typeof navigator !== 'undefined' && 'share' in navigator && (
                <button onClick={handleWebShare} className="btn-secondary">
                  Share via App...
                </button>
              )}
              <a
                href={`https://wa.me/?text=${encodedText}%20${encodedUrl}`}
                target="_blank"
                rel="noopener noreferrer"
                className="social-btn whatsapp"
              >
                WhatsApp
              </a>
              <a
                href={`https://twitter.com/intent/tweet?text=${encodedText}&url=${encodedUrl}`}
                target="_blank"
                rel="noopener noreferrer"
                className="social-btn twitter"
              >
                X / Twitter
              </a>
            </div>

            <hr className="divider" />

            {/* Email Invite Option */}
            <form onSubmit={handleSendEmail} className="email-form">
              <label htmlFor="email-invite-input">Or Send via Email</label>
              <div className="email-input-group">
                <input
                  id="email-invite-input"
                  type="email"
                  placeholder="counterparty@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
                <button type="submit" className="btn-secondary" disabled={loading}>
                  {loading ? 'Sending...' : 'Send Invite'}
                </button>
              </div>
              {emailSent && <p className="success-msg">Invitation email queued successfully!</p>}
            </form>
          </div>
        )}
      </div>
    </div>
  );
};
