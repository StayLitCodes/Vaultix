'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  Users, Search, ChevronLeft, ChevronRight,
  UserX, UserCheck, Loader2, Shield, X, AlertTriangle,
} from 'lucide-react';
import { AdminService } from '@/services/admin';
import { IAdminUser, IAdminUserResponse } from '@/types/admin';

function RoleBadge({ role }: { role: string }) {
  const config: Record<string, { color: string; bg: string }> = {
    SUPER_ADMIN: { color: 'text-cyan-400', bg: 'bg-cyan-500/10' },
    ADMIN: { color: 'text-blue-400', bg: 'bg-blue-500/10' },
    USER: { color: 'text-gray-400', bg: 'bg-gray-500/10' },
  };
  const c = config[role] || config.USER;
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium ${c.color} ${c.bg}`}>
      {role === 'SUPER_ADMIN' && <Shield className="w-3 h-3" />}
      {role.replace('_', ' ')}
    </span>
  );
}

function ConfirmDialog({ user, onConfirm, onCancel, loading }: {
  user: IAdminUser; onConfirm: () => void; onCancel: () => void; loading: boolean;
}) {
  const action = user.isActive ? 'Suspend' : 'Unsuspend';
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onCancel} />
      <div className="relative bg-[#12121a] border border-white/10 rounded-t-2xl sm:rounded-2xl w-full sm:max-w-md p-6">
        <button onClick={onCancel} className="absolute top-4 right-4 min-w-[44px] min-h-[44px] flex items-center justify-center text-gray-400 hover:text-white">
          <X className="w-5 h-5" />
        </button>
        <div className="flex items-center gap-3 mb-4">
          <div className={`w-10 h-10 rounded-full flex items-center justify-center ${user.isActive ? 'bg-red-500/10' : 'bg-emerald-500/10'}`}>
            <AlertTriangle className={`w-5 h-5 ${user.isActive ? 'text-red-400' : 'text-emerald-400'}`} />
          </div>
          <div>
            <h3 className="text-white font-semibold">{action} User</h3>
            <p className="text-xs text-gray-500">This action can be reversed.</p>
          </div>
        </div>
        <div className="bg-white/[0.02] rounded-lg p-3 mb-5">
          <p className="text-xs text-gray-400">Wallet Address</p>
          <p className="text-sm text-white font-mono truncate">{user.walletAddress}</p>
          <p className="text-xs text-gray-400 mt-2">User ID</p>
          <p className="text-sm text-white font-mono">{user.id}</p>
        </div>
        <div className="flex gap-3">
          <button onClick={onCancel} className="flex-1 min-h-[44px] px-4 py-2.5 bg-white/5 text-gray-300 rounded-lg text-sm font-medium hover:bg-white/10 transition-colors">
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={loading}
            className={`flex-1 min-h-[44px] px-4 py-2.5 rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-2 ${
              user.isActive
                ? 'bg-red-600/20 text-red-300 hover:bg-red-600/30 border border-red-500/20'
                : 'bg-emerald-600/20 text-emerald-300 hover:bg-emerald-600/30 border border-emerald-500/20'
            } disabled:opacity-50`}
          >
            {loading && <Loader2 className="w-4 h-4 animate-spin" />}
            {action}
          </button>
        </div>
      </div>
    </div>
  );
}

// Mobile card view for a user row
function UserCard({ user, onAction }: { user: IAdminUser; onAction: (u: IAdminUser) => void }) {
  return (
    <div className="bg-white/[0.02] border border-white/5 rounded-xl p-4 space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-xs text-gray-500 mb-0.5">Wallet Address</p>
          <p className="text-sm text-white font-mono truncate">{user.walletAddress}</p>
          <p className="text-[10px] text-gray-600 mt-0.5">{user.id}</p>
        </div>
        <RoleBadge role={user.role} />
      </div>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className={`inline-flex items-center gap-1.5 text-xs font-medium ${user.isActive ? 'text-emerald-400' : 'text-red-400'}`}>
            <div className={`w-1.5 h-1.5 rounded-full ${user.isActive ? 'bg-emerald-400' : 'bg-red-400'}`} />
            {user.isActive ? 'Active' : 'Suspended'}
          </span>
          <span className="text-xs text-gray-500">{new Date(user.createdAt).toLocaleDateString()}</span>
        </div>
        {user.role !== 'SUPER_ADMIN' && (
          <button
            onClick={() => onAction(user)}
            className={`min-h-[44px] inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              user.isActive
                ? 'bg-red-500/10 text-red-400 hover:bg-red-500/20'
                : 'bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20'
            }`}
          >
            {user.isActive ? <><UserX className="w-3.5 h-3.5" />Suspend</> : <><UserCheck className="w-3.5 h-3.5" />Unsuspend</>}
          </button>
        )}
      </div>
    </div>
  );
}

export default function AdminUsersPage() {
  const [data, setData] = useState<IAdminUserResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [confirmUser, setConfirmUser] = useState<IAdminUser | null>(null);
  const [suspending, setSuspending] = useState(false);

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    try {
      const result = await AdminService.getUsers(page, 15, search || undefined);
      setData(result);
    } finally {
      setLoading(false);
    }
  }, [page, search]);

  useEffect(() => {
    const timer = setTimeout(fetchUsers, 300);
    return () => clearTimeout(timer);
  }, [fetchUsers]);

  const handleSuspend = async () => {
    if (!confirmUser) return;
    setSuspending(true);
    try {
      await AdminService.suspendUser(confirmUser.id);
      setConfirmUser(null);
      fetchUsers();
    } finally {
      setSuspending(false);
    }
  };

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl sm:text-2xl font-bold text-white">User Management</h1>
        <p className="text-sm text-gray-500 mt-1">View and manage platform users</p>
      </div>

      {/* Search */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
        <input
          type="text"
          placeholder="Search by wallet address…"
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          className="w-full min-h-[44px] pl-10 pr-4 py-2.5 bg-[#12121a] border border-white/10 rounded-lg text-sm text-white placeholder:text-gray-600 focus:outline-none focus:border-purple-500/50 transition-colors"
        />
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-6 h-6 text-purple-500 animate-spin" />
        </div>
      ) : (
        <>
          {/* Mobile card list */}
          <div className="sm:hidden space-y-3">
            {data?.users.map((user) => (
              <UserCard key={user.id} user={user} onAction={setConfirmUser} />
            ))}
          </div>

          {/* Desktop table */}
          <div className="hidden sm:block bg-[#12121a] border border-white/5 rounded-xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-white/5">
                    <th className="text-left text-[11px] text-gray-500 uppercase tracking-wider font-medium px-5 py-3">Wallet Address</th>
                    <th className="text-left text-[11px] text-gray-500 uppercase tracking-wider font-medium px-5 py-3">Role</th>
                    <th className="text-left text-[11px] text-gray-500 uppercase tracking-wider font-medium px-5 py-3">Status</th>
                    <th className="text-left text-[11px] text-gray-500 uppercase tracking-wider font-medium px-5 py-3">Joined</th>
                    <th className="text-right text-[11px] text-gray-500 uppercase tracking-wider font-medium px-5 py-3">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {data?.users.map((user) => (
                    <tr key={user.id} className="border-b border-white/[0.03] hover:bg-white/[0.02] transition-colors">
                      <td className="px-5 py-3.5">
                        <p className="text-sm text-white font-mono truncate max-w-[200px]">{user.walletAddress}</p>
                        <p className="text-[10px] text-gray-600 mt-0.5">{user.id}</p>
                      </td>
                      <td className="px-5 py-3.5"><RoleBadge role={user.role} /></td>
                      <td className="px-5 py-3.5">
                        <span className={`inline-flex items-center gap-1.5 text-xs font-medium ${user.isActive ? 'text-emerald-400' : 'text-red-400'}`}>
                          <div className={`w-1.5 h-1.5 rounded-full ${user.isActive ? 'bg-emerald-400' : 'bg-red-400'}`} />
                          {user.isActive ? 'Active' : 'Suspended'}
                        </span>
                      </td>
                      <td className="px-5 py-3.5">
                        <span className="text-xs text-gray-400">{new Date(user.createdAt).toLocaleDateString()}</span>
                      </td>
                      <td className="px-5 py-3.5 text-right">
                        {user.role !== 'SUPER_ADMIN' && (
                          <button
                            onClick={() => setConfirmUser(user)}
                            className={`min-h-[44px] inline-flex items-center gap-1.5 text-xs font-medium transition-colors px-2 ${
                              user.isActive ? 'text-red-400 hover:text-red-300' : 'text-emerald-400 hover:text-emerald-300'
                            }`}
                          >
                            {user.isActive ? <><UserX className="w-3.5 h-3.5" />Suspend</> : <><UserCheck className="w-3.5 h-3.5" />Unsuspend</>}
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {data && data.pagination.pages > 1 && (
              <div className="flex items-center justify-between px-5 py-3 border-t border-white/5">
                <p className="text-xs text-gray-500">
                  Page {data.pagination.page} of {data.pagination.pages} ({data.pagination.total} users)
                </p>
                <div className="flex items-center gap-2">
                  <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
                    className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-lg bg-white/5 text-gray-400 hover:text-white disabled:opacity-30 transition-colors">
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <button onClick={() => setPage(p => Math.min(data.pagination.pages, p + 1))} disabled={page === data.pagination.pages}
                    className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-lg bg-white/5 text-gray-400 hover:text-white disabled:opacity-30 transition-colors">
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

      {confirmUser && (
        <ConfirmDialog user={confirmUser} onConfirm={handleSuspend} onCancel={() => setConfirmUser(null)} loading={suspending} />
      )}
    </div>
  );
}
