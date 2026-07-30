import React, { useState } from 'react';
import { ShareEscrowModal } from '../components/escrow/ShareEscrowModal';

interface EscrowDetailPageProps {
  escrowId: string;
  title: string;
  status: string;
}

export const EscrowDetailPage: React.FC<EscrowDetailPageProps> = ({
  escrowId,
  title,
  status,
}) => {
  const [isShareModalOpen, setIsShareModalOpen] = useState<boolean>(false);

  return (
    <div className="escrow-detail-container">
      <header className="page-header">
        <h1>{title}</h1>
        <div className="header-actions">
          {/* Share Escrow Trigger Button */}
          <button
            onClick={() => setIsShareModalOpen(true)}
            className="btn-share"
            data-testid="share-escrow-btn"
          >
            Share Escrow
          </button>
        </div>
      </header>

      <section className="escrow-status-summary">
        <p><strong>Status:</strong> {status}</p>
        <p><strong>Escrow ID:</strong> {escrowId}</p>
      </section>

      {/* Share Modal Dialog */}
      <ShareEscrowModal
        isOpen={isShareModalOpen}
        onClose={() => setIsShareModalOpen(false)}
        escrowId={escrowId}
        escrowTitle={title}
      />
    </div>
  );
};
