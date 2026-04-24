'use client';

import React from 'react';
import Link from 'next/link';
import { ITransaction } from '@/types/transaction';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ExternalLink, ArrowUpRight, ArrowDownLeft } from 'lucide-react';

interface TransactionTableProps {
  transactions: ITransaction[];
  isLoading: boolean;
}

export const TransactionTable: React.FC<TransactionTableProps> = ({ transactions, isLoading }) => {
  if (isLoading) {
    return (
      <div className="w-full space-y-4">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="h-16 w-full animate-pulse bg-slate-100 rounded-lg" />
        ))}
      </div>
    );
  }

  if (transactions.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <div className="bg-slate-50 p-6 rounded-full mb-4">
          <ArrowUpRight className="h-10 w-10 text-slate-400" />
        </div>
        <h3 className="text-xl font-semibold text-slate-900">No transactions found</h3>
        <p className="text-slate-500 max-w-sm mt-2">
          Your fund movements across all escrows will appear here once they occur.
        </p>
      </div>
    );
  }

  const getTypeBadge = (type: string) => {
    switch (type.toLowerCase()) {
      case 'funding':
        return <Badge variant="secondary" className="bg-blue-50 text-blue-700 border-blue-100">Funding</Badge>;
      case 'milestone_release':
        return <Badge variant="secondary" className="bg-green-50 text-green-700 border-green-100">Release</Badge>;
      case 'completion':
        return <Badge variant="secondary" className="bg-purple-50 text-purple-700 border-purple-100">Completion</Badge>;
      case 'refund':
        return <Badge variant="secondary" className="bg-orange-50 text-orange-700 border-orange-100">Refund</Badge>;
      case 'dispute_resolution':
        return <Badge variant="secondary" className="bg-red-50 text-red-700 border-red-100">Dispute Resolved</Badge>;
      default:
        return <Badge variant="outline">{type}</Badge>;
    }
  };

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left border-separate border-spacing-y-2">
        <thead>
          <tr className="text-slate-500 text-sm font-medium">
            <th className="px-4 py-2">Date</th>
            <th className="px-4 py-2">Type</th>
            <th className="px-4 py-2">Escrow</th>
            <th className="px-4 py-2 text-right">Amount</th>
            <th className="px-4 py-2">Counterparty</th>
            <th className="px-4 py-2 text-right">Actions</th>
          </tr>
        </thead>
        <tbody>
          {transactions.map((tx) => (
            <tr key={tx.id} className="bg-white border border-slate-200 rounded-lg hover:shadow-md transition-shadow">
              <td className="px-4 py-4 whitespace-nowrap text-sm text-slate-600">
                {new Date(tx.date).toLocaleDateString()}
                <span className="block text-xs text-slate-400">{new Date(tx.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
              </td>
              <td className="px-4 py-4 whitespace-nowrap">
                {getTypeBadge(tx.type)}
              </td>
              <td className="px-4 py-4 max-w-[200px]">
                {tx.escrowId ? (
                  <Link href={`/escrow/${tx.escrowId}`} className="text-sm font-medium text-blue-600 hover:underline truncate block">
                    {tx.escrowTitle || 'Untitled Escrow'}
                  </Link>
                ) : (
                  <span className="text-sm text-slate-400 italic">No Escrow</span>
                )}
              </td>
              <td className="px-4 py-4 text-right whitespace-nowrap">
                <span className={`text-sm font-bold ${tx.amount > 0 ? 'text-slate-900' : 'text-slate-900'}`}>
                  {tx.amount.toLocaleString()} {tx.asset}
                </span>
              </td>
              <td className="px-4 py-4 text-sm text-slate-600 font-mono max-w-[150px] truncate">
                {tx.counterpartyAddress}
              </td>
              <td className="px-4 py-4 text-right whitespace-nowrap">
                <div className="flex justify-end gap-2">
                  <Button variant="ghost" size="sm" asChild title="View on Explorer">
                    <a href={`https://stellar.expert/explorer/testnet/tx/${tx.txHash}`} target="_blank" rel="noopener noreferrer">
                      <ExternalLink className="h-4 w-4" />
                    </a>
                  </Button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};
