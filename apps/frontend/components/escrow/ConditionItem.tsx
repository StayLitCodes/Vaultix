import React, { useMemo, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Clock3,
  FileText,
  Loader2,
  ShieldAlert,
} from 'lucide-react';
import { confirmCondition } from '@/lib/escrow-api';
import { ICondition, IParty } from '@/types/escrow';
import FulfillConditionModal from './FulfillConditionModal';
import { Button } from '@/components/ui/button';

interface Props {
  escrowId: string;
  condition: ICondition;
  currentParty: IParty | null;
  escrowStatus: string;
  onUpdated: () => Promise<void>;
  isLastOutstandingCondition: boolean;
}

const isLikelyUrl = (value?: string | null) =>
  Boolean(value && /^https?:\/\//i.test(value));

const formatDateTime = (value?: string | null) =>
  value
    ? new Date(value).toLocaleString(undefined, {
        dateStyle: 'medium',
        timeStyle: 'short',
      })
    : null;

const ConditionItem: React.FC<Props> = ({
  escrowId,
  condition,
  currentParty,
  escrowStatus,
  onUpdated,
  isLastOutstandingCondition,
}) => {
  const [showModal, setShowModal] = useState(false);
  const [isConfirming, setIsConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [infoMessage, setInfoMessage] = useState<string | null>(null);

  const partyRole = currentParty?.role?.toLowerCase();
  const partyStatus = currentParty?.status?.toLowerCase();
  const isEscrowActive = escrowStatus.toLowerCase() === 'active';
  const isFulfilled = Boolean(condition.isFulfilled);
  const isConfirmed = Boolean(condition.isMet);

  const canFulfill =
    partyRole === 'seller' && partyStatus === 'accepted' && !isFulfilled && isEscrowActive;
  const canConfirm =
    partyRole === 'buyer' && partyStatus === 'accepted' && isFulfilled && !isConfirmed && isEscrowActive;

  const statusConfig = useMemo(() => {
    if (isConfirmed) {
      return {
        label: 'Confirmed',
        className: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300',
        icon: <CheckCircle2 className="h-4 w-4" />,
      };
    }

    if (isFulfilled) {
      return {
        label: 'Awaiting buyer confirmation',
        className: 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300',
        icon: <Clock3 className="h-4 w-4" />,
      };
    }

    return {
      label: 'Pending fulfillment',
      className: 'bg-slate-100 text-slate-700 dark:bg-zinc-800 dark:text-zinc-300',
      icon: <Clock3 className="h-4 w-4" />,
    };
  }, [isConfirmed, isFulfilled]);

  const handleConfirm = async () => {
    setError(null);
    setInfoMessage(null);

    if (isLastOutstandingCondition) {
      const shouldContinue = window.confirm(
        'This is the last outstanding condition. Confirming it may trigger automatic fund release. Continue?',
      );

      if (!shouldContinue) {
        return;
      }
    }

    setIsConfirming(true);

    try {
      await confirmCondition(escrowId, condition.id);
      await onUpdated();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Failed to confirm this condition. Please try again.',
      );
    } finally {
      setIsConfirming(false);
    }
  };

  const handleReject = () => {
    setInfoMessage(
      'Rejecting a fulfillment is not yet supported by the backend API. Ask the seller for updated evidence or file a dispute if the condition is not met.',
    );
  };

  return (
    <div className="rounded-xl border border-border p-5 shadow-sm text-card-foreground bg-card">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-medium ${statusConfig.className}`}
            >
              {statusConfig.icon}
              {statusConfig.label}
            </span>
            {isLastOutstandingCondition && canConfirm && (
              <span className="inline-flex items-center gap-1 rounded-full bg-destructive/10 px-3 py-1 text-xs font-medium text-destructive">
                <AlertTriangle className="h-3.5 w-3.5" />
                Final confirmation triggers auto-release
              </span>
            )}
          </div>

          <div>
            <h3 className="text-base font-semibold text-foreground">{condition.description}</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Condition type: <span className="font-medium capitalize text-foreground">{condition.type}</span>
            </p>
          </div>

          {error && (
            <div className="flex items-start gap-3 rounded-lg border border-destructive/20 bg-destructive/10 p-3 text-sm text-destructive">
              <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0" />
              <p>{error}</p>
            </div>
          )}

          {infoMessage && (
            <div className="flex items-start gap-3 rounded-lg border border-blue-500/20 bg-blue-500/10 p-3 text-sm text-blue-400">
              <ShieldAlert className="mt-0.5 h-4 w-4 flex-shrink-0" />
              <p>{infoMessage}</p>
            </div>
          )}

          {(condition.fulfilledAt || condition.fulfillmentNotes || condition.fulfillmentEvidence) && (
            <div className="rounded-lg bg-muted p-4 text-sm text-muted-foreground">
              <p className="font-medium text-foreground">Fulfillment details</p>
              {condition.fulfilledAt && (
                <p className="mt-2">
                  Fulfilled on {formatDateTime(condition.fulfilledAt)}
                  {condition.fulfilledByUserId
                    ? ` by ${condition.fulfilledByUserId}`
                    : ''}
                </p>
              )}
              {condition.fulfillmentNotes && (
                <p className="mt-2 whitespace-pre-wrap">{condition.fulfillmentNotes}</p>
              )}
              {condition.fulfillmentEvidence && (
                <div className="mt-2 flex items-start gap-2">
                  <FileText className="mt-0.5 h-4 w-4 flex-shrink-0 text-muted-foreground" />
                  {isLikelyUrl(condition.fulfillmentEvidence) ? (
                    <a
                      href={condition.fulfillmentEvidence}
                      target="_blank"
                      rel="noreferrer"
                      className="break-all text-blue-600 dark:text-blue-400 underline"
                    >
                      {condition.fulfillmentEvidence}
                    </a>
                  ) : (
                    <p className="break-all">{condition.fulfillmentEvidence}</p>
                  )}
                </div>
              )}
            </div>
          )}

          {condition.metAt && (
            <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/10 p-4 text-sm text-emerald-500">
              Confirmed on {formatDateTime(condition.metAt)}
              {condition.metByUserId ? ` by ${condition.metByUserId}` : ''}.
            </div>
          )}
        </div>

        <div className="flex flex-col gap-2 lg:w-52">
          {canFulfill && (
            <Button type="button" className="cursor-pointer" onClick={() => setShowModal(true)}>
              Fulfill condition
            </Button>
          )}

          {canConfirm && (
            <>
              <Button type="button" className="cursor-pointer" onClick={handleConfirm} disabled={isConfirming}>
                {isConfirming ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Confirming
                  </>
                ) : (
                  'Confirm'
                )}
              </Button>
              <Button type="button" variant="outline" className="cursor-pointer" onClick={handleReject} disabled={isConfirming}>
                Reject
              </Button>
            </>
          )}

          {!isEscrowActive && (
            <p className="text-sm text-muted-foreground">
              Actions are disabled because this escrow is {escrowStatus.toLowerCase()}.
            </p>
          )}

          {partyStatus !== 'accepted' && currentParty && (
            <p className="text-sm text-muted-foreground">
              Accept your invitation before taking condition actions.
            </p>
          )}
        </div>
      </div>

      {showModal && (
        <FulfillConditionModal
          escrowId={escrowId}
          condition={condition}
          isOpen={showModal}
          onClose={() => setShowModal(false)}
          onSubmitted={onUpdated}
        />
      )}
    </div>
  );
};

export default ConditionItem;
