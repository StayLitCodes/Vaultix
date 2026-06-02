'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  Filter, ChevronLeft, ChevronRight, Eye, RefreshCw, X,
  Loader2, AlertCircle, CheckCircle2, Clock, XCircle, AlertTriangle,
} from 'lucide-react';
import { AdminService } from '@/services/admin';
import { IAdminEscrow, IAdminEscrowResponse } from '@/types/admin';

const STATUS_CONFIG: Record<string, { color: string; bg: string; icon: React.ElementType }> = {
  ACTIVE: { color: 'text-emerald-400', bg: 'bg-emerald-500/10', icon: CheckCircle2 },
  COMPLETED: { color: 'text-blue-400', bg: 'bg-blue-500/10', icon: CheckCircle2 },
  PENDING: { color: 'text-yellow-400', bg: 'bg-yellow-500/10', icon: Clock },
  CANCELLED: { color: 'text-gray-400', bg: 'bg-gray-500/10', icon: XCircle },
  DISPUTED: { color: 'text-red-400', bg: 'bg-red-500/10', icon: AlertTriangle },
};

function StatusBadge({ status }: { status: string }) {
  const config = STATUS_CONFIG[status] || STATUS_CONFIG.PENDING;
  const Icon = config.icon;
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium ${config.color} ${config.bg}`}>
      <Icon className="w-3 h-3" />
      {status}
    </span>
  );
}

function EscrowDetailModal({ escrow, onClose, onConsistencyCheck }: {
  escrow: IAdminEscrow; onClose: () => void; onConsistencyCheck: (id: string) => void;
}) {
  const [checking, setChecking] = useState(false);
  const [result, setResult] = useState<{ status: string; issues: string[] } | null>(null);

  const handleCheck = async () => {
    setChecking(true);
    try {
      const res = await AdminService.runConsistencyCheck(escrow.id);
      setResult(res);
    } finally {
      setChecking(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-[#12121a] border border-white/10 rounded-t-2xl sm:rounded-2xl w-full sm:max-w-lg max-h-[90vh] sm:max-h-[85vh] overflow-y-auto">
        <div className="sticky top-0 bg-[#12121a] border-b border-white/5 px-5 py-4 flex items-center justify-between">
          <h3 className="text-base sm:text-lg font-semibold text-white">Escrow Details</h3>
          <button onClick={onClose} className="min-w-[44px] min-h-[44px] flex items-center justify-center text-gray-400 hover:text-white transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="p-5 space-y-4">
          <div>
            <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">Title</p>
            <p className="text-white font-medium">{escrow.title}</p>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><p className="text-xs text-gray-500 uppercase tracking-wider mb-1">Amount</p>
              <p className="text-white font-medium text-sm">{parseFloat(escrow.amount).toLocaleString()} {escrow.asset}</p></div>
            <div><p className="text-xs text-gray-500 uppercase tracking-wider mb-1">Status</p><StatusBadge status={escrow.status} /></div>
            <div><p className="text-xs text-gray-500 uppercase tracking-wider mb-1">Type</p><p className="text-white text-sm">{escrow.type}</p></div>
            <div><p className="text-xs text-gray-500 uppercase tracking-wider mb-1">Created</p>
              <p className="text-white text-sm">{new Date(escrow.createdAt).toLocaleDateString()}</p></div>
          </div>
          <div>
            <p className="text-xs text-gray-500 uppercase tracking-wider mb-2">Parties</p>
            <div className="space-y-2">
              {escrow.parties.map((party) => (
                <div key={party.id} className="flex items-center justify-between bg-white/[0.02] rounded-lg px-3 py-2.5">
                  <div>
                    <p className="text-xs text-gray-300">{party.role}</p>
                    <p className="text-[10px] text-gray-500 font-mono">{party.userId}</p>
                  </div>
                  <span className={`text-[10px] px-2 py-0.5 rounded-full ${party.status === 'ACCEPTED' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-yellow-500/10 text-yellow-400'}`}>
                    {party.status}
                  </span>
                </div>
              ))}
            </div>
          </div>
          <div className="border-t border-white/5 pt-4">
            <button
              onClick={handleCheck}
              disabled={checking}
              className="w-full min-h-[44px] flex items-center justify-center gap-2 px-4 py-2.5 bg-gradient-to-r from-purple-600/20 to-blue-500/20 border border-purple-500/20 text-purple-300 rounded-lg text-sm font-medium hover:from-purple-600/30 hover:to-blue-500/30 transition-all disabled:opacity-50"
            >
              {checking ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
              Run Consistency Check
            </button>
            {result && (
              <div className={`mt-3 p-3 rounded-lg text-xs ${result.issues.length === 0 ? 'bg-emerald-500/10 text-emerald-400' : 'bg-yellow-500/10 text-yellow-400'}`}>
                {result.issues.length === 0 ? (
                  <div className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4" />No issues found.</div>
                ) : (
                  <div>
                    <div className="flex items-center gap-2 mb-2"><AlertCircle className="w-4 h-4" />Issues detected:</div>
                    <ul className="list-disc list-inside space-y-1">{result.issues.map((issue, i) => <li key={i}>{issue}</li>)}</ul>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// Mobile card for an escrow row
function EscrowCard({ escrow, onView }: { escrow: IAdminEscrow; onView: () => void }) {
  return (
    <div className="bg-white/[0.02] border border-white/5 rounded-xl p-4 space-y-3">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <p className="text-sm text-white font-medium truncate">{escrow.title}</p>
          <p className="text-[10px] text-gray-500 font-mono mt-0.5">{escrow.id}</p>
        </div>
        <StatusBadge status={escrow.status} />
      </div>
      <div className="flex items-center justify-between">
        <div className="space-y-0.5">
          <p className="text-sm text-white">{parseFloat(escrow.amount).toLocaleString()} <span className="text-gray-400 text-xs">{escrow.asset}</span></p>
          <p className="text-xs text-gray-500">{escrow.type} · {new Date(escrow.createdAt).toLocaleDateString()}</p>
        </div>
        <button
          onClick={onView}
          className="min-h-[44px] min-w-[44px] inline-flex items-center justify-center gap-1.5 px-3 rounded-lg bg-purple-500/10 text-purple-400 hover:bg-purple-500/20 text-xs font-medium transition-colors"
        >
          <Eye className="w-3.5 h-3.5" />
          View
        </button>
      </div>
    </div>
  );
}

export default function AdminEscrowsPage() {
  const [data, setData] = useState<IAdminEscrowResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [selectedEscrow, setSelectedEscrow] = useState<IAdminEscrow | null>(null);

  const statuses = ['ALL', 'ACTIVE', 'COMPLETED', 'PENDING', 'CANCELLED', 'DISPUTED'];

  const fetchEscrows = useCallback(async () => {
    setLoading(true);
    try {
      const result = await AdminService.getEscrows({ status: statusFilter === 'ALL' ? undefined : statusFilter, page, limit: 10 });
      setData(result);
    } finally {
      setLoading(false);
    }
  }, [page, statusFilter]);

  useEffect(() => { fetchEscrows(); }, [fetchEscrows]);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl sm:text-2xl font-bold text-white">Escrow Management</h1>
        <p className="text-sm text-gray-500 mt-1">Monitor and manage all platform escrows</p>
      </div>

      {/* Filters — scrollable on mobile */}
      <div className="overflow-x-auto -mx-1 pb-1">
        <div className="flex items-center gap-2 px-1 min-w-max">
          <Filter className="w-4 h-4 text-gray-500 flex-shrink-0" />
          {statuses.map((s) => (
            <button
              key={s}
              onClick={() => { setStatusFilter(s); setPage(1); }}
              className={`min-h-[44px] px-3 py-1.5 rounded-lg text-xs font-medium transition-all whitespace-nowrap ${
                statusFilter === s
                  ? 'bg-purple-600/20 text-purple-300 border border-purple-500/30'
                  : 'bg-white/[0.03] text-gray-400 border border-white/5 hover:border-white/10'
              }`}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-6 h-6 text-purple-500 animate-spin" />
        </div>
      ) : (
        <>
          {/* Mobile card list */}
          <div className="sm:hidden space-y-3">
            {data?.escrows.map((escrow) => (
              <EscrowCard key={escrow.id} escrow={escrow} onView={() => setSelectedEscrow(escrow)} />
            ))}
          </div>

          {/* Desktop table */}
          <div className="hidden sm:block bg-[#12121a] border border-white/5 rounded-xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-white/5">
                    {['Title', 'Amount', 'Status', 'Type', 'Created', 'Actions'].map((h, i) => (
                      <th key={h} className={`text-[11px] text-gray-500 uppercase tracking-wider font-medium px-5 py-3 ${i === 5 ? 'text-right' : 'text-left'}`}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {data?.escrows.map((escrow) => (
                    <tr key={escrow.id} className="border-b border-white/[0.03] hover:bg-white/[0.02] transition-colors">
                      <td className="px-5 py-3.5">
                        <p className="text-sm text-white font-medium">{escrow.title}</p>
                        <p className="text-[10px] text-gray-600 font-mono mt-0.5">{escrow.id}</p>
                      </td>
                      <td className="px-5 py-3.5"><p className="text-sm text-white">{parseFloat(escrow.amount).toLocaleString()} {escrow.asset}</p></td>
                      <td className="px-5 py-3.5"><StatusBadge status={escrow.status} /></td>
                      <td className="px-5 py-3.5"><span className="text-xs text-gray-400">{escrow.type}</span></td>
                      <td className="px-5 py-3.5"><span className="text-xs text-gray-400">{new Date(escrow.createdAt).toLocaleDateString()}</span></td>
                      <td className="px-5 py-3.5 text-right">
                        <button onClick={() => setSelectedEscrow(escrow)}
                          className="min-h-[44px] inline-flex items-center gap-1.5 text-xs text-purple-400 hover:text-purple-300 transition-colors px-2">
                          <Eye className="w-3.5 h-3.5" />View
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {data && data.pagination.pages > 1 && (
              <div className="flex items-center justify-between px-5 py-3 border-t border-white/5">
                <p className="text-xs text-gray-500">Page {data.pagination.page} of {data.pagination.pages} ({data.pagination.total} escrows)</p>
                <div className="flex items-center gap-2">
                  <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
                    className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-lg bg-white/5 text-gray-400 hover:text-white disabled:opacity-30">
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <button onClick={() => setPage(p => Math.min(data.pagination.pages, p + 1))} disabled={page === data.pagination.pages}
                    className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-lg bg-white/5 text-gray-400 hover:text-white disabled:opacity-30">
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Mobile pagination */}
          {data && data.pagination.pages > 1 && (
            <div className="sm:hidden flex items-center justify-between">
              <p className="text-xs text-gray-500">Page {data.pagination.page} of {data.pagination.pages}</p>
              <div className="flex gap-2">
                <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
                  className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-lg bg-white/5 text-gray-400 hover:text-white disabled:opacity-30">
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <button onClick={() => setPage(p => Math.min(data.pagination.pages, p + 1))} disabled={page === data.pagination.pages}
                  className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-lg bg-white/5 text-gray-400 hover:text-white disabled:opacity-30">
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </>
      )}

      {selectedEscrow && (
        <EscrowDetailModal
          escrow={selectedEscrow}
          onClose={() => setSelectedEscrow(null)}
          onConsistencyCheck={(id) => console.log('consistency check', id)}
        />
      )}
    </div>
  );
}
