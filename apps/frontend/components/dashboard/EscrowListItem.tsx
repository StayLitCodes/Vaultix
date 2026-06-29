import React, { memo } from "react";
import Link from "next/link";

interface IEscrow {
  id: string;
  title: string;
  amount: string;
  asset: string;
  status: string;
  deadline: string;
}

const STATUS_COLORS: Record<string, string> = {
  created: "bg-blue-100 text-blue-800",
  funded: "bg-indigo-100 text-indigo-800",
  confirmed: "bg-yellow-100 text-yellow-800",
  completed: "bg-green-100 text-green-800",
  cancelled: "bg-gray-100 text-gray-800",
  disputed: "bg-red-100 text-red-800",
  expired: "bg-orange-100 text-orange-800",
};

const EscrowListItem = memo(function EscrowListItem({
  escrow,
}: {
  escrow: IEscrow;
}) {
  const colorClass =
    STATUS_COLORS[escrow.status] ?? "bg-gray-100 text-gray-800";
  return (
    <Link
      href={`/escrow/${escrow.id}`}
      className="block rounded-lg border p-4 transition-shadow hover:shadow-md"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate font-semibold text-gray-900">{escrow.title}</p>
          <p className="mt-0.5 text-sm text-gray-500">
            {escrow.amount} {escrow.asset}
          </p>
        </div>
        <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${colorClass}`}>
          {escrow.status}
        </span>
      </div>
      <p className="mt-2 text-xs text-gray-400">
        Due: {new Date(escrow.deadline).toLocaleDateString()}
      </p>
    </Link>
  );
});

export default EscrowListItem;
