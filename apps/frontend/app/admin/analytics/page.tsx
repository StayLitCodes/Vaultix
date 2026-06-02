'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { BarChart3, PieChart, TrendingUp, Users, Loader2, AlertCircle } from 'lucide-react';
import { AdminService, AdminApiError } from '@/services/admin';
import { AdminAnalyticsSkeleton } from '@/components/ui/AdminAnalyticsSkeleton';
import { useAdminAuth } from '@/hooks/useAdminAuth';
import { IPlatformStats, IVolumeAnalytics, IDisputeMetrics, ITopUsersResponse } from '@/types/admin';

// ── Date Range Selector ────────────────────────────────────────────────────

type Range = '7d' | '30d' | '90d';

const RANGES: { label: string; value: Range }[] = [
  { label: '7 days', value: '7d' },
  { label: '30 days', value: '30d' },
  { label: '90 days', value: '90d' },
];

// ── Escrow Volume Bar Chart (CSS-based) ────────────────────────────────────

function VolumeChart({ range, data, loading, error }: { range: Range; data: IVolumeAnalytics | null; loading: boolean; error: string | null }) {
  if (loading) {
    return (
      <div className="bg-[#12121a] border border-white/5 rounded-xl p-6">
        <h3 className="text-sm font-medium text-white mb-1 flex items-center gap-2">
          <BarChart3 className="w-4 h-4 text-blue-400" />
          Escrow Creation Volume
        </h3>
        <div className="flex items-center justify-center h-36">
          <Loader2 className="w-6 h-6 text-purple-400 animate-spin" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-[#12121a] border border-red-500/20 rounded-xl p-6">
        <h3 className="text-sm font-medium text-white mb-4 flex items-center gap-2">
          <BarChart3 className="w-4 h-4 text-red-400" />
          Escrow Creation Volume
        </h3>
        <div className="flex items-center gap-2 text-red-400 text-sm">
          <AlertCircle className="w-4 h-4" />
          {error}
        </div>
      </div>
    );
  }

  if (!data || !data.timeSeries || data.timeSeries.length === 0) {
    return (
      <div className="bg-[#12121a] border border-white/5 rounded-xl p-6">
        <h3 className="text-sm font-medium text-white mb-1 flex items-center gap-2">
          <BarChart3 className="w-4 h-4 text-blue-400" />
          Escrow Creation Volume
        </h3>
        <div className="flex items-center justify-center h-36 text-gray-500">
          No data available for this period
        </div>
      </div>
    );
  }

  const chartData = data.timeSeries;
  const max = Math.max(...chartData.map((d) => d.value));

  return (
    <div className="bg-[#12121a] border border-white/5 rounded-xl p-6">
      <h3 className="text-sm font-medium text-white mb-1 flex items-center gap-2">
        <BarChart3 className="w-4 h-4 text-blue-400" />
        Escrow Creation Volume
      </h3>
      <p className="text-xs text-gray-500 mb-6">Number of escrows created per period</p>
      <div className="flex items-end gap-2 h-36">
        {chartData.map((d, i) => {
          const pct = max > 0 ? (d.value / max) * 100 : 0;
          return (
            <div key={i} className="flex-1 flex flex-col items-center gap-1">
              <span className="text-[10px] text-gray-400">{d.value}</span>
              <div className="w-full rounded-t-md overflow-hidden" style={{ height: `${pct}%`, minHeight: 4 }}>
                <div
                  className="w-full h-full rounded-t-md"
                  style={{ background: `linear-gradient(to top, rgba(59,130,246,0.8), rgba(139,92,246,0.8))` }}
                />
              </div>
              <span className="text-[10px] text-gray-500">{d.label}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Status Distribution Donut (CSS conic-gradient) ─────────────────────────

const STATUS_COLORS: Record<string, string> = {
  Active: '#3b82f6',
  Completed: '#10b981',
  Disputed: '#f59e0b',
  Expired: '#ef4444',
};

function StatusDonut({ stats }: { stats: IPlatformStats }) {
  const total = stats.escrows.total || 1;
  const slices = [
    { label: 'Active',    value: stats.escrows.active,                               color: STATUS_COLORS.Active },
    { label: 'Completed', value: stats.escrows.completed,                             color: STATUS_COLORS.Completed },
    { label: 'Disputed',  value: Math.round(total * 0.03),                            color: STATUS_COLORS.Disputed },
    { label: 'Expired',   value: total - stats.escrows.active - stats.escrows.completed - Math.round(total * 0.03), color: STATUS_COLORS.Expired },
  ];

  let accumulated = 0;
  const gradient = slices
    .map((s) => {
      const pct = (s.value / total) * 100;
      const from = accumulated;
      accumulated += pct;
      return `${s.color} ${from.toFixed(1)}% ${accumulated.toFixed(1)}%`;
    })
    .join(', ');

  return (
    <div className="bg-[#12121a] border border-white/5 rounded-xl p-6">
      <h3 className="text-sm font-medium text-white mb-4 flex items-center gap-2">
        <PieChart className="w-4 h-4 text-purple-400" />
        Escrow Status Distribution
      </h3>
      <div className="flex items-center gap-6">
        <div
          className="w-28 h-28 rounded-full flex-shrink-0"
          style={{
            background: `conic-gradient(${gradient})`,
            mask: 'radial-gradient(circle at center, transparent 40%, black 41%)',
            WebkitMask: 'radial-gradient(circle at center, transparent 40%, black 41%)',
          }}
        />
        <ul className="space-y-2 text-xs">
          {slices.map((s) => (
            <li key={s.label} className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-sm flex-shrink-0" style={{ background: s.color }} />
              <span className="text-gray-400">{s.label}</span>
              <span className="text-white font-medium ml-auto pl-4">
                {((s.value / total) * 100).toFixed(1)}%
              </span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

// ── Top Users Table ────────────────────────────────────────────────────────

type SortKey = 'escrowCount' | 'totalVolume';

function TopUsersTable({ data, loading, error }: { data: ITopUsersResponse | null; loading: boolean; error: string | null }) {
  const [sort, setSort] = useState<SortKey>('totalVolume');

  if (loading) {
    return (
      <div className="bg-[#12121a] border border-white/5 rounded-xl p-6">
        <h3 className="text-sm font-medium text-white mb-4 flex items-center gap-2">
          <Users className="w-4 h-4 text-teal-400" />
          Top 10 Users by Volume
        </h3>
        <div className="flex items-center justify-center h-40">
          <Loader2 className="w-6 h-6 text-purple-400 animate-spin" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-[#12121a] border border-red-500/20 rounded-xl p-6">
        <h3 className="text-sm font-medium text-white mb-4 flex items-center gap-2">
          <Users className="w-4 h-4 text-red-400" />
          Top 10 Users by Volume
        </h3>
        <div className="flex items-center gap-2 text-red-400 text-sm">
          <AlertCircle className="w-4 h-4" />
          {error}
        </div>
      </div>
    );
  }

  if (!data || !data.users || data.users.length === 0) {
    return (
      <div className="bg-[#12121a] border border-white/5 rounded-xl p-6">
        <h3 className="text-sm font-medium text-white mb-4 flex items-center gap-2">
          <Users className="w-4 h-4 text-teal-400" />
          Top 10 Users by Volume
        </h3>
        <div className="flex items-center justify-center h-40 text-gray-500">
          No users data available
        </div>
      </div>
    );
  }

  const sorted = [...data.users].sort((a, b) =>
    sort === 'escrowCount' ? b.escrowCount - a.escrowCount : b.totalVolume - a.totalVolume,
  );

  const thClass = 'text-left text-xs text-gray-500 font-medium py-2 px-3 uppercase tracking-wider cursor-pointer hover:text-gray-300';

  return (
    <div className="bg-[#12121a] border border-white/5 rounded-xl p-6">
      <h3 className="text-sm font-medium text-white mb-4 flex items-center gap-2">
        <Users className="w-4 h-4 text-teal-400" />
        Top 10 Users by Volume
      </h3>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-white/5">
              <th className="text-left text-xs text-gray-500 font-medium py-2 px-3 uppercase">#</th>
              <th className="text-left text-xs text-gray-500 font-medium py-2 px-3 uppercase">Wallet</th>
              <th className={thClass} onClick={() => setSort('escrowCount')}>
                Escrows {sort === 'escrowCount' && '↓'}
              </th>
              <th className={thClass} onClick={() => setSort('totalVolume')}>
                Volume (XLM) {sort === 'totalVolume' && '↓'}
              </th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((u) => (
              <tr key={u.rank} className="border-b border-white/5 hover:bg-white/[0.02]">
                <td className="py-2 px-3 text-gray-500">{u.rank}</td>
                <td className="py-2 px-3 font-mono text-xs text-gray-300">
                  {u.walletAddress.slice(0, 8)}…{u.walletAddress.slice(-4)}
                </td>
                <td className="py-2 px-3 text-gray-200">{u.escrowCount}</td>
                <td className="py-2 px-3 text-gray-200">{u.totalVolume.toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── Dispute Metrics ────────────────────────────────────────────────────────

function DisputeMetrics({ data, loading, error }: { data: IDisputeMetrics | null; loading: boolean; error: string | null }) {
  if (loading) {
    return (
      <div className="bg-[#12121a] border border-white/5 rounded-xl p-6">
        <h3 className="text-sm font-medium text-white mb-4 flex items-center gap-2">
          <TrendingUp className="w-4 h-4 text-yellow-400" />
          Dispute Metrics
        </h3>
        <div className="flex items-center justify-center h-40">
          <Loader2 className="w-6 h-6 text-purple-400 animate-spin" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-[#12121a] border border-red-500/20 rounded-xl p-6">
        <h3 className="text-sm font-medium text-white mb-4 flex items-center gap-2">
          <TrendingUp className="w-4 h-4 text-red-400" />
          Dispute Metrics
        </h3>
        <div className="flex items-center gap-2 text-red-400 text-sm">
          <AlertCircle className="w-4 h-4" />
          {error}
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="bg-[#12121a] border border-white/5 rounded-xl p-6">
        <h3 className="text-sm font-medium text-white mb-4 flex items-center gap-2">
          <TrendingUp className="w-4 h-4 text-yellow-400" />
          Dispute Metrics
        </h3>
        <div className="flex items-center justify-center h-40 text-gray-500">
          No dispute data available
        </div>
      </div>
    );
  }

  return (
    <div className="bg-[#12121a] border border-white/5 rounded-xl p-6">
      <h3 className="text-sm font-medium text-white mb-4 flex items-center gap-2">
        <TrendingUp className="w-4 h-4 text-yellow-400" />
        Dispute Metrics
      </h3>
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-white/[0.02] rounded-lg p-4">
          <p className="text-2xl font-bold text-yellow-400">{(data.rate * 100).toFixed(1)}%</p>
          <p className="text-xs text-gray-500 mt-1">Dispute rate</p>
        </div>
        <div className="bg-white/[0.02] rounded-lg p-4">
          <p className="text-2xl font-bold text-white">{data.avgResolutionHours}h</p>
          <p className="text-xs text-gray-500 mt-1">Avg resolution time</p>
        </div>
        <div className="bg-white/[0.02] rounded-lg p-4">
          <p className="text-2xl font-bold text-green-400">{(data.releasedToSellerPct * 100).toFixed(0)}%</p>
          <p className="text-xs text-gray-500 mt-1">Released to seller</p>
        </div>
        <div className="bg-white/[0.02] rounded-lg p-4">
          <p className="text-2xl font-bold text-blue-400">{(data.refundedToBuyerPct * 100).toFixed(0)}%</p>
          <p className="text-xs text-gray-500 mt-1">Refunded to buyer</p>
        </div>
      </div>
    </div>
  );
}

// ── Page ───────────────────────────────────────────────────────────────────

export default function AdminAnalyticsPage() {
  const router = useRouter();
  const { isAdmin, isLoading: authLoading } = useAdminAuth();
  
  const [stats, setStats] = useState<IPlatformStats | null>(null);
  const [volumeData, setVolumeData] = useState<IVolumeAnalytics | null>(null);
  const [disputeMetrics, setDisputeMetrics] = useState<IDisputeMetrics | null>(null);
  const [topUsers, setTopUsers] = useState<ITopUsersResponse | null>(null);
  
  const [loading, setLoading] = useState(true);
  const [range, setRange] = useState<Range>('30d');
  
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Redirect non-admins to dashboard
  useEffect(() => {
    if (!authLoading && !isAdmin) {
      router.push('/dashboard');
    }
  }, [isAdmin, authLoading, router]);

  const fetchData = useCallback(async (period: Range) => {
    if (!isAdmin) return;
    
    setLoading(true);
    setErrors({});
    try {
      const [s, v, d, u] = await Promise.all([
        AdminService.getStats().catch((err) => {
          setErrors((prev) => ({ ...prev, stats: err instanceof AdminApiError ? err.message : 'Failed to load stats' }));
          return null;
        }),
        AdminService.getVolumeAnalytics(period).catch((err) => {
          setErrors((prev) => ({ ...prev, volume: err instanceof AdminApiError ? err.message : 'Failed to load volume data' }));
          return null;
        }),
        AdminService.getDisputeMetrics().catch((err) => {
          setErrors((prev) => ({ ...prev, disputes: err instanceof AdminApiError ? err.message : 'Failed to load dispute metrics' }));
          return null;
        }),
        AdminService.getTopUsers(10).catch((err) => {
          setErrors((prev) => ({ ...prev, users: err instanceof AdminApiError ? err.message : 'Failed to load top users' }));
          return null;
        }),
      ]);
      
      setStats(s);
      setVolumeData(v);
      setDisputeMetrics(d);
      setTopUsers(u);
    } catch (err) {
      console.error('Failed to fetch analytics data:', err);
    } finally {
      setLoading(false);
    }
  }, [isAdmin]);

  useEffect(() => {
    fetchData(range);
  }, [range, fetchData]);

  // Show loading while checking auth
  if (authLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-8 h-8 text-purple-500 animate-spin" />
      </div>
    );
  }

  // Redirect guard
  if (!isAdmin) {
    return null;
  }

  if (loading && !stats) {
    return <AdminAnalyticsSkeleton />;
  }

  return (
    <div className="space-y-6">
      {/* Header + Range Selector */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-white">Analytics</h1>
          <p className="text-sm text-gray-500 mt-1">Platform-wide metrics and trends</p>
        </div>
        <div className="flex gap-1 bg-white/5 rounded-lg p-1">
          {RANGES.map((r) => (
            <button
              key={r.value}
              onClick={() => setRange(r.value)}
              disabled={loading}
              className={`px-3 py-1 text-sm rounded-md transition-colors disabled:opacity-50 ${
                range === r.value
                  ? 'bg-white/10 text-white font-medium'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              {r.label}
            </button>
          ))}
        </div>
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <VolumeChart range={range} data={volumeData} loading={loading} error={errors.volume || null} />
        {stats && <StatusDonut stats={stats} />}
      </div>

      {/* Dispute metrics + Top users */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <DisputeMetrics data={disputeMetrics} loading={loading} error={errors.disputes || null} />
        <TopUsersTable data={topUsers} loading={loading} error={errors.users || null} />
      </div>
    </div>
  );
}
