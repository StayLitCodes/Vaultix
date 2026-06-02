'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  FileText,
  Filter,
  ChevronLeft,
  ChevronRight,
  Search,
  Loader2,
  Calendar,
  User,
  Activity,
  Database,
} from 'lucide-react';
import { AdminService } from '@/services/admin';
import { IAuditLogResponse, IAuditLogFilters } from '@/types/admin';

const ACTION_COLORS: Record<string, string> = {
  SUSPEND_USER: 'text-red-400 bg-red-500/10',
  CREATE_ESCROW: 'text-emerald-400 bg-emerald-500/10',
  UPDATE_ESCROW: 'text-blue-400 bg-blue-500/10',
  CONSISTENCY_CHECK: 'text-purple-400 bg-purple-500/10',
  LOGIN: 'text-cyan-400 bg-cyan-500/10',
  ROLE_CHANGE: 'text-yellow-400 bg-yellow-500/10',
};

const RESOURCE_ICONS: Record<string, React.ElementType> = {
  USER: User,
  ESCROW: Database,
  SYSTEM: Activity,
};

export default function AdminAuditLogsPage() {
  const [data, setData] = useState<IAuditLogResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [filters, setFilters] = useState<IAuditLogFilters>({});
  const [showFilters, setShowFilters] = useState(false);

  const actionTypes = ['SUSPEND_USER', 'CREATE_ESCROW', 'UPDATE_ESCROW', 'CONSISTENCY_CHECK', 'LOGIN', 'ROLE_CHANGE'];
  const resourceTypes = ['USER', 'ESCROW', 'SYSTEM'];
  const pageSize = 15;

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    try {
      const result = await AdminService.getAuditLogs({
        ...filters,
        page,
        pageSize,
      });
      setData(result);
    } finally {
      setLoading(false);
    }
  }, [page, filters]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  const totalPages = data ? Math.ceil(data.total / pageSize) : 1;

  const updateFilter = (key: keyof IAuditLogFilters, value: string) => {
    setFilters(prev => ({
      ...prev,
      [key]: value || undefined,
    }));
    setPage(1);
  };

  const clearFilters = () => {
    setFilters({});
    setPage(1);
  };

  const activeFilterCount = Object.values(filters).filter(Boolean).length;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Audit Logs</h1>
        <p className="text-sm text-gray-500 mt-1">
          Track all administrative actions on the platform
        </p>
      </div>

      {/* Filter toggle */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => setShowFilters(!showFilters)}
          className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
            showFilters || activeFilterCount > 0
              ? 'bg-purple-600/20 text-purple-300 border border-purple-500/30'
              : 'bg-white/[0.03] text-gray-400 border border-white/5 hover:border-white/10'
          }`}
        >
          <Filter className="w-4 h-4" />
          Filters
          {activeFilterCount > 0 && (
            <span className="w-5 h-5 rounded-full bg-purple-500 text-white text-[10px] flex items-center justify-center">
              {activeFilterCount}
            </span>
          )}
        </button>
        {activeFilterCount > 0 && (
          <button
            onClick={clearFilters}
            className="text-xs text-gray-500 hover:text-white transition-colors"
          >
            Clear all
          </button>
        )}
      </div>

      {/* Filter panel */}
      {showFilters && (
        <div className="bg-[#12121a] border border-white/5 rounded-xl p-5 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Actor ID */}
          <div>
            <label className="text-[11px] text-gray-500 uppercase tracking-wider mb-1.5 block">Actor ID</label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-600" />
              <input
                type="text"
                placeholder="e.g. user-1"
                value={filters.actorId || ''}
                onChange={(e) => updateFilter('actorId', e.target.value)}
                className="w-full pl-9 pr-3 py-2 bg-white/[0.03] border border-white/5 rounded-lg text-sm text-white placeholder:text-gray-600 focus:outline-none focus:border-purple-500/50 transition-colors"
              />
            </div>
          </div>

          {/* Action Type */}
          <div>
            <label className="text-[11px] text-gray-500 uppercase tracking-wider mb-1.5 block">Action Type</label>
            <select
              value={filters.actionType || ''}
              onChange={(e) => updateFilter('actionType', e.target.value)}
              className="w-full px-3 py-2 bg-white/[0.03] border border-white/5 rounded-lg text-sm text-white focus:outline-none focus:border-purple-500/50 transition-colors appearance-none"
            >
              <option value="">All Actions</option>
              {actionTypes.map((a) => (
                <option key={a} value={a}>{a.replace(/_/g, ' ')}</option>
              ))}
            </select>
          </div>

          {/* Resource Type */}
          <div>
            <label className="text-[11px] text-gray-500 uppercase tracking-wider mb-1.5 block">Resource Type</label>
            <select
              value={filters.resourceType || ''}
              onChange={(e) => updateFilter('resourceType', e.target.value)}
              className="w-full px-3 py-2 bg-white/[0.03] border border-white/5 rounded-lg text-sm text-white focus:outline-none focus:border-purple-500/50 transition-colors appearance-none"
            >
              <option value="">All Resources</option>
              {resourceTypes.map((r) => (
                <option key={r} value={r}>{r}</option>
              ))}
            </select>
          </div>

          {/* Date range */}
          <div>
            <label className="text-[11px] text-gray-500 uppercase tracking-wider mb-1.5 block">Date Range</label>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Calendar className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-600" />
                <input
                  type="date"
                  value={filters.from || ''}
                  onChange={(e) => updateFilter('from', e.target.value)}
                  className="w-full pl-8 pr-2 py-2 bg-white/[0.03] border border-white/5 rounded-lg text-xs text-white focus:outline-none focus:border-purple-500/50 transition-colors"
                />
              </div>
              <div className="relative flex-1">
                <Calendar className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-600" />
                <input
                  type="date"
                  value={filters.to || ''}
                  onChange={(e) => updateFilter('to', e.target.value)}
                  className="w-full pl-8 pr-2 py-2 bg-white/[0.03] border border-white/5 rounded-lg text-xs text-white focus:outline-none focus:border-purple-500/50 transition-colors"
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Log table */}
      <div className="bg-[#12121a] border border-white/5 rounded-xl overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-6 h-6 text-purple-500 animate-spin" />
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-white/5">
                    <th className="text-left text-[11px] text-gray-500 uppercase tracking-wider font-medium px-5 py-3">Timestamp</th>
                    <th className="text-left text-[11px] text-gray-500 uppercase tracking-wider font-medium px-5 py-3">Actor</th>
                    <th className="text-left text-[11px] text-gray-500 uppercase tracking-wider font-medium px-5 py-3">Action</th>
                    <th className="text-left text-[11px] text-gray-500 uppercase tracking-wider font-medium px-5 py-3">Resource</th>
                    <th className="text-left text-[11px] text-gray-500 uppercase tracking-wider font-medium px-5 py-3">Resource ID</th>
                  </tr>
                </thead>
                <tbody>
                  {data?.data.map((log) => {
                    const ResourceIcon = RESOURCE_ICONS[log.resourceType] || Activity;
                    const actionColor = ACTION_COLORS[log.actionType] || 'text-gray-400 bg-gray-500/10';
                    return (
                      <tr
                        key={log.id}
                        className="border-b border-white/[0.03] hover:bg-white/[0.02] transition-colors"
                      >
                        <td className="px-5 py-3.5">
                          <p className="text-xs text-gray-300">
                            {new Date(log.createdAt).toLocaleDateString()}
                          </p>
                          <p className="text-[10px] text-gray-600">
                            {new Date(log.createdAt).toLocaleTimeString()}
                          </p>
                        </td>
                        <td className="px-5 py-3.5">
                          <span className="text-xs text-white font-mono">{log.actorId}</span>
                        </td>
                        <td className="px-5 py-3.5">
                          <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-medium ${actionColor}`}>
                            {log.actionType.replace(/_/g, ' ')}
                          </span>
                        </td>
                        <td className="px-5 py-3.5">
                          <span className="inline-flex items-center gap-1.5 text-xs text-gray-400">
                            <ResourceIcon className="w-3.5 h-3.5" />
                            {log.resourceType}
                          </span>
                        </td>
                        <td className="px-5 py-3.5">
                          <span className="text-xs text-gray-500 font-mono">
                            {log.resourceId || '—'}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                  {data?.data.length === 0 && (
                    <tr>
                      <td colSpan={5} className="px-5 py-16 text-center">
                        <FileText className="w-8 h-8 text-gray-700 mx-auto mb-3" />
                        <p className="text-sm text-gray-500">No audit logs found</p>
                        <p className="text-xs text-gray-600 mt-1">Try adjusting your filters</p>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between px-5 py-3 border-t border-white/5">
                <p className="text-xs text-gray-500">
                  Page {page} of {totalPages} ({data?.total} logs)
                </p>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setPage(p => Math.max(1, p - 1))}
                    disabled={page === 1}
                    className="p-1.5 rounded-lg bg-white/5 text-gray-400 hover:text-white disabled:opacity-30 transition-colors"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                    disabled={page === totalPages}
                    className="p-1.5 rounded-lg bg-white/5 text-gray-400 hover:text-white disabled:opacity-30 transition-colors"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
