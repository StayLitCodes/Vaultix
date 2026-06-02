import React from 'react';
import { AlertTriangle, Clock, CheckCircle, XCircle, ShareIcon } from 'lucide-react';
import { IEscrowExtended } from '@/types/escrow';

interface EscrowHeaderProps {
  escrow: IEscrowExtended;
  userRole: 'creator' | 'counterparty' | 'arbitrator' | null;
  connected: boolean;
  connect: () => void;
  publicKey: string | null;
  onFileDispute?: () => void;
}

const STATUS_STYLES: Record<string, string> = {
  pending: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-950 dark:text-yellow-300',
  active: 'bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300',
  completed: 'bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-300',
  cancelled: 'bg-gray-100 text-gray-800 dark:bg-zinc-800 dark:text-gray-300',
  disputed: 'bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300',
};

const STATUS_ICONS: Record<string, React.ReactNode> = {
  pending: <Clock className="h-3.5 w-3.5" />,
  active: <CheckCircle className="h-3.5 w-3.5" />,
  completed: <CheckCircle className="h-3.5 w-3.5" />,
  cancelled: <XCircle className="h-3.5 w-3.5" />,
  disputed: <AlertTriangle className="h-3.5 w-3.5" />,
};

const EscrowHeader: React.FC<EscrowHeaderProps> = ({ escrow, userRole, connected, connect, onFileDispute }) => {
  const statusKey = escrow.status.toLowerCase();
  const statusStyle = STATUS_STYLES[statusKey] || 'bg-gray-100 text-gray-800 dark:bg-zinc-850 dark:text-gray-300';
  const statusIcon = STATUS_ICONS[statusKey] || <Clock className="h-3.5 w-3.5" />;

  const handleCopyLink = () => {
    navigator.clipboard.writeText(window.location.href);
    alert('Link copied to clipboard!');
  };

  return (
    <div className="bg-card text-card-foreground rounded-xl shadow-sm border border-border p-4 sm:p-6">
      {/* Title row */}
      <div className="flex flex-wrap items-start gap-3 mb-3">
        <h1 className="text-xl sm:text-2xl font-bold text-foreground flex-1 min-w-0 leading-tight">
          {escrow.title}
        </h1>
        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium flex-shrink-0 ${statusStyle}`}>
          {statusIcon}
          <span className="capitalize">{escrow.status}</span>
        </span>
      </div>

      <p className="text-muted-foreground text-sm sm:text-base mb-4">{escrow.description}</p>

      {/* Metadata chips */}
      <div className="flex flex-wrap gap-2 mb-4">
        <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-muted rounded-md text-xs text-muted-foreground">
          <span className="font-medium">ID:</span>
          <span className="font-mono">{escrow.id.substring(0, 8)}…</span>
        </span>
        <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-muted rounded-md text-xs text-muted-foreground">
          <span className="font-medium">Amount:</span>
          <span>{Number(escrow.amount).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 7 })} {escrow.asset}</span>
        </span>
        <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-muted rounded-md text-xs text-muted-foreground">
          <span className="font-medium">Created:</span>
          <span>{new Date(escrow.createdAt).toLocaleDateString()}</span>
        </span>
      </div>

      {/* Action buttons — full-width on mobile */}
      <div className="flex flex-wrap gap-2">
        <button
          onClick={handleCopyLink}
          className="min-h-[44px] inline-flex items-center gap-2 px-4 py-2 border border-border rounded-lg text-sm font-medium text-foreground bg-card hover:bg-muted transition-colors cursor-pointer"
        >
          <ShareIcon className="h-4 w-4" />
          Share
        </button>

        {connected && userRole && ['creator', 'counterparty'].includes(userRole) && escrow.status === 'ACTIVE' && onFileDispute && (
          <button
            onClick={onFileDispute}
            className="min-h-[44px] inline-flex items-center gap-2 px-4 py-2 border border-destructive/30 text-sm font-medium rounded-lg text-destructive bg-destructive/10 hover:bg-destructive/20 transition-colors cursor-pointer"
          >
            <AlertTriangle className="h-4 w-4" />
            File Dispute
          </button>
        )}

        {!connected && (
          <button
            onClick={connect}
            className="min-h-[44px] inline-flex items-center gap-2 px-4 py-2 border border-transparent text-sm font-medium rounded-lg text-white bg-blue-600 hover:bg-blue-700 transition-colors cursor-pointer"
          >
            Connect Wallet
          </button>
        )}
      </div>
    </div>
  );
};

export default EscrowHeader;
