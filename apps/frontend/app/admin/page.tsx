'use client';

import React, { useState, useEffect } from 'react';
import {
  Users,
  Shield,
  TrendingUp,
  Activity,
  ArrowUpRight,
  ArrowDownRight,
  BarChart3,
  Wallet,
  UserPlus,
  CheckCircle2,
  Loader2,
} from 'lucide-react';
import { AdminService } from '@/services/admin';
import { IPlatformStats } from '@/types/admin';

function StatCard({
  title,
  value,
  change,
  changeLabel,
  icon: Icon,
  gradient,
}: {
  title: string;
  value: string | number;
  change?: number;
  changeLabel?: string;
  icon: React.ElementType;
  gradient: string;
}) {
  const isPositive = change && change > 0;
  return (
    <div className="relative group">
      <div className="absolute -inset-[1px] bg-gradient-to-r opacity-0 group-hover:opacity-100 rounded-xl transition-opacity duration-500 blur-sm"
        style={{ backgroundImage: gradient }}
      />
      <div className="relative bg-[#12121a] border border-white/5 rounded-xl p-5 hover:border-white/10 transition-all duration-300">
        <div className="flex items-start justify-between mb-4">
          <div
            className="w-10 h-10 rounded-lg flex items-center justify-center"
            style={{ background: gradient }}
          >
            <Icon className="w-5 h-5 text-white" />
          </div>
          {change !== undefined && (
            <div
              className={`flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-full ${
                isPositive
                  ? 'bg-emerald-500/10 text-emerald-400'
                  : 'bg-red-500/10 text-red-400'
              }`}
            >
              {isPositive ? (
                <ArrowUpRight className="w-3 h-3" />
              ) : (
                <ArrowDownRight className="w-3 h-3" />
              )}
              {Math.abs(change)}%
            </div>
          )}
        </div>
        <p className="text-2xl font-bold text-white mb-1">
          {typeof value === 'number' ? value.toLocaleString() : value}
        </p>
        <p className="text-xs text-gray-500">{title}</p>
        {changeLabel && (
          <p className="text-[10px] text-gray-600 mt-1">{changeLabel}</p>
        )}
      </div>
    </div>
  );
}

function RoleDistribution({ roles }: { roles: Record<string, number> }) {
  const total = Object.values(roles).reduce((a, b) => a + b, 0);
  const colors: Record<string, string> = {
    USER: '#8b5cf6',
    ADMIN: '#3b82f6',
    SUPER_ADMIN: '#06b6d4',
  };

  return (
    <div className="bg-[#12121a] border border-white/5 rounded-xl p-6">
      <h3 className="text-sm font-medium text-white mb-4 flex items-center gap-2">
        <Users className="w-4 h-4 text-purple-400" />
        Role Distribution
      </h3>
      <div className="space-y-3">
        {Object.entries(roles).map(([role, count]) => {
          const pct = total > 0 ? (count / total) * 100 : 0;
          return (
            <div key={role}>
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-xs text-gray-400 capitalize">
                  {role.replace('_', ' ').toLowerCase()}
                </span>
                <span className="text-xs text-gray-300 font-medium">
                  {count.toLocaleString()} ({pct.toFixed(1)}%)
                </span>
              </div>
              <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-1000 ease-out"
                  style={{
                    width: `${pct}%`,
                    backgroundColor: colors[role] || '#8b5cf6',
                  }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function EscrowVolumeChart() {
  // Simulated chart data
  const months = ['Oct', 'Nov', 'Dec', 'Jan', 'Feb', 'Mar'];
  const values = [320, 480, 560, 720, 610, 850];
  const max = Math.max(...values);

  return (
    <div className="bg-[#12121a] border border-white/5 rounded-xl p-6">
      <h3 className="text-sm font-medium text-white mb-1 flex items-center gap-2">
        <BarChart3 className="w-4 h-4 text-blue-400" />
        Escrow Volume (last 6 months)
      </h3>
      <p className="text-xs text-gray-500 mb-6">Monthly completed escrow count</p>
      <div className="flex items-end gap-2 h-40">
        {months.map((month, i) => {
          const height = (values[i] / max) * 100;
          return (
            <div key={month} className="flex-1 flex flex-col items-center gap-2">
              <span className="text-[10px] text-gray-500 font-medium">
                {values[i]}
              </span>
              <div className="w-full relative rounded-t-md overflow-hidden" style={{ height: `${height}%` }}>
                <div
                  className="absolute inset-0 rounded-t-md transition-all duration-700 ease-out"
                  style={{
                    background: `linear-gradient(to top, rgba(139, 92, 246, ${0.3 + i * 0.1}), rgba(59, 130, 246, ${0.5 + i * 0.08}))`,
                  }}
                />
              </div>
              <span className="text-[10px] text-gray-600">{month}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function RecentActivity() {
  const activities = [
    { type: 'escrow_created', desc: 'New escrow created: "Website Dev"', time: '5m ago', icon: Shield },
    { type: 'user_joined', desc: 'New user registered: GAX3...', time: '12m ago', icon: UserPlus },
    { type: 'escrow_completed', desc: 'Escrow completed: "API Integration"', time: '28m ago', icon: CheckCircle2 },
    { type: 'user_joined', desc: 'New user registered: GBK2...', time: '1h ago', icon: UserPlus },
    { type: 'escrow_created', desc: 'New escrow created: "DeFi Audit"', time: '2h ago', icon: Shield },
  ];

  return (
    <div className="bg-[#12121a] border border-white/5 rounded-xl p-6">
      <h3 className="text-sm font-medium text-white mb-4 flex items-center gap-2">
        <Activity className="w-4 h-4 text-emerald-400" />
        Recent Activity
      </h3>
      <div className="space-y-3">
        {activities.map((item, i) => {
          const Icon = item.icon;
          return (
            <div key={i} className="flex items-center gap-3 p-2 rounded-lg hover:bg-white/[0.02] transition-colors">
              <div className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center flex-shrink-0">
                <Icon className="w-4 h-4 text-purple-400" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs text-gray-300 truncate">{item.desc}</p>
                <p className="text-[10px] text-gray-600">{item.time}</p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function AdminOverviewPage() {
  const [stats, setStats] = useState<IPlatformStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    AdminService.getStats()
      .then(setStats)
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-8 h-8 text-purple-500 animate-spin" />
          <p className="text-sm text-gray-500">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  if (!stats) return null;

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div>
        <h1 className="text-2xl font-bold text-white">Platform Overview</h1>
        <p className="text-sm text-gray-500 mt-1">
          Real-time platform statistics and monitoring
        </p>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Total Users"
          value={stats.users.total}
          change={12}
          changeLabel={`${stats.users.newLast30Days} new in 30d`}
          icon={Users}
          gradient="linear-gradient(135deg, #8b5cf6, #6d28d9)"
        />
        <StatCard
          title="Active Escrows"
          value={stats.escrows.active}
          change={8}
          changeLabel={`${stats.escrows.newLast30Days} new in 30d`}
          icon={Shield}
          gradient="linear-gradient(135deg, #3b82f6, #1d4ed8)"
        />
        <StatCard
          title="Completed Escrows"
          value={stats.escrows.completed}
          change={15}
          changeLabel={`${stats.escrows.completedLast30Days} in 30d`}
          icon={CheckCircle2}
          gradient="linear-gradient(135deg, #10b981, #059669)"
        />
        <StatCard
          title="Total Volume"
          value={`${(stats.volume.totalCompleted / 1000000).toFixed(2)}M XLM`}
          change={23}
          icon={Wallet}
          gradient="linear-gradient(135deg, #f59e0b, #d97706)"
        />
      </div>

      {/* Charts & Details row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2">
          <EscrowVolumeChart />
        </div>
        <RoleDistribution roles={stats.roles} />
      </div>

      {/* Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <RecentActivity />
        <div className="bg-[#12121a] border border-white/5 rounded-xl p-6">
          <h3 className="text-sm font-medium text-white mb-4 flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-blue-400" />
            Quick Metrics
          </h3>
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-white/[0.02] rounded-lg p-4">
              <p className="text-2xl font-bold text-white">
                {stats.users.active.toLocaleString()}
              </p>
              <p className="text-xs text-gray-500 mt-1">Active Users</p>
            </div>
            <div className="bg-white/[0.02] rounded-lg p-4">
              <p className="text-2xl font-bold text-white">
                {stats.escrows.total.toLocaleString()}
              </p>
              <p className="text-xs text-gray-500 mt-1">Total Escrows</p>
            </div>
            <div className="bg-white/[0.02] rounded-lg p-4">
              <p className="text-2xl font-bold text-white">
                {(
                  (stats.escrows.completed / Math.max(stats.escrows.total, 1)) *
                  100
                ).toFixed(1)}
                %
              </p>
              <p className="text-xs text-gray-500 mt-1">Completion Rate</p>
            </div>
            <div className="bg-white/[0.02] rounded-lg p-4">
              <p className="text-2xl font-bold text-white">
                {Math.round(
                  stats.volume.totalCompleted /
                    Math.max(stats.escrows.completed, 1)
                ).toLocaleString()}
              </p>
              <p className="text-xs text-gray-500 mt-1">Avg Volume (XLM)</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
