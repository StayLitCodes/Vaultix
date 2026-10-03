import React, { memo } from "react";
import Link from "next/link";
import { useCurrency } from "@/context/CurrencyContext";
import { useFiatPrice } from "@/hooks/useFiatPrice";
import { CanonicalEscrowStatus, escrowStatusLabel } from "@/utils/escrowStatus";

interface IEscrow {
  id: string;
  title: string;
  amount: string;
  asset: string;
  status: CanonicalEscrowStatus;
  deadline: string;
}

const STATUS_COLORS: Record<CanonicalEscrowStatus, string> = {
  [CanonicalEscrowStatus.CREATED]: "bg-blue-100 text-blue-800",
  [CanonicalEscrowStatus.FUNDED]: "bg-indigo-100 text-indigo-800",
  [CanonicalEscrowStatus.ACTIVE]: "bg-indigo-100 text-indigo-800",
  [CanonicalEscrowStatus.COMPLETED]: "bg-green-100 text-green-800",
  [CanonicalEscrowStatus.RESOLVED]: "bg-green-100 text-green-800",
  [CanonicalEscrowStatus.CANCELLED]: "bg-gray-100 text-gray-800",
  [CanonicalEscrowStatus.REFUNDED]: "bg-gray-100 text-gray-800",
  [CanonicalEscrowStatus.DISPUTED]: "bg-red-100 text-red-800",
  [CanonicalEscrowStatus.EXPIRED]: "bg-orange-100 text-orange-800",
  [CanonicalEscrowStatus.UNKNOWN]: "bg-gray-100 text-gray-800",
};

const formatFiat = (amount: number, currency: string) => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency.toUpperCase(),
  }).format(amount);
};

const EscrowListItem = memo(function EscrowListItem({
  escrow,
}: {
  escrow: IEscrow;
}) {
  const { showFiat, currency } = useCurrency();
  const { prices } = useFiatPrice();

  const colorClass = STATUS_COLORS[escrow.status];

  let fiatDisplay = null;
  if (showFiat && escrow.asset === 'XLM' && prices[currency]) {
    const fiatAmount = parseFloat(escrow.amount) * prices[currency];
    fiatDisplay = (
      <span className="text-gray-400 ml-1">
        (~{formatFiat(fiatAmount, currency)})
      </span>
    );
  }

  return (
    <Link
      href={`/escrow/${escrow.id}`}
      className="block rounded-lg border p-4 transition-shadow hover:shadow-md"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate font-semibold text-gray-900">{escrow.title}</p>
          <p className="mt-0.5 text-sm text-gray-500">
            {escrow.amount} {escrow.asset} {fiatDisplay}
          </p>
        </div>
        <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${colorClass}`}>
          {escrowStatusLabel(escrow.status)}
        </span>
      </div>
      <p className="mt-2 text-xs text-gray-400">
        Due: {new Date(escrow.deadline).toLocaleDateString()}
      </p>
    </Link>
  );
});

export default EscrowListItem;
