import React from 'react';
import { CheckCircle2, Clock3 } from 'lucide-react';
import { ICondition, IParty } from '@/types/escrow';
import ConditionItem from './ConditionItem';

interface Props {
  escrowId: string;
  escrowStatus: string;
  conditions: ICondition[];
  currentParty: IParty | null;
  onConditionsUpdated: () => Promise<void>;
}

const ConditionsList: React.FC<Props> = ({
  escrowId,
  escrowStatus,
  conditions,
  currentParty,
  onConditionsUpdated,
}) => {
  const totalConditions = conditions.length;
  const fulfilledConditions = conditions.filter((condition) => condition.isFulfilled).length;
  const confirmedConditions = conditions.filter((condition) => condition.isMet).length;
  const remainingConfirmations = conditions.filter(
    (condition) => condition.isFulfilled && !condition.isMet,
  ).length;
  const allConditionsMet = totalConditions > 0 && confirmedConditions === totalConditions;

  if (totalConditions === 0) {
    return null;
  }

  return (
    <section className="rounded-lg bg-white p-6 shadow">
      <div className="mb-5 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-xl font-semibold text-gray-900">Conditions</h2>
          <p className="mt-1 text-sm text-gray-500">
            {confirmedConditions} of {totalConditions} confirmed, {fulfilledConditions} fulfilled.
          </p>
        </div>
        <div className="inline-flex items-center gap-2 rounded-full bg-gray-100 px-3 py-1 text-sm font-medium text-gray-700">
          <Clock3 className="h-4 w-4" />
          {remainingConfirmations} awaiting buyer review
        </div>
      </div>

      {allConditionsMet && (
        <div className="mb-5 flex items-start gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-4">
          <CheckCircle2 className="mt-0.5 h-5 w-5 flex-shrink-0 text-emerald-600" />
          <div>
            <p className="font-medium text-emerald-900">All conditions have been confirmed</p>
            <p className="mt-1 text-sm text-emerald-800">
              The escrow is now eligible for automatic fund release. Watch the escrow status and
              activity feed for the release event.
            </p>
          </div>
        </div>
      )}

      <div className="space-y-4">
        {conditions.map((condition) => (
          <ConditionItem
            key={condition.id}
            escrowId={escrowId}
            escrowStatus={escrowStatus}
            condition={condition}
            currentParty={currentParty}
            onUpdated={onConditionsUpdated}
            isLastOutstandingCondition={
              Boolean(condition.isFulfilled) &&
              !Boolean(condition.isMet) &&
              remainingConfirmations === 1
            }
          />
        ))}
      </div>
    </section>
  );
};

export default ConditionsList;
