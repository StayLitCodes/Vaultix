'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  BarChart3,
  Users,
  Shield,
  FileText,
  ChevronLeft,
  ChevronRight,
  LayoutDashboard,
  LogOut,
  Menu,
  X,
} from 'lucide-react';

const ADMIN_WALLET_ADDRESSES = [
  'GADMIN', // Placeholder: in production, fetch from backend
];

const navItems = [
  { href: '/admin', label: 'Overview', icon: LayoutDashboard },
  { href: '/admin/analytics', label: 'Analytics', icon: BarChart3 },
  { href: '/admin/escrows', label: 'Escrows', icon: Shield },
  { href: '/admin/users', label: 'Users', icon: Users },
  { href: '/admin/audit-logs', label: 'Audit Logs', icon: FileText },
];

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [authorized, setAuthorized] = useState(true);

  useEffect(() => {
    // Client-side admin role check
    // In production, verify via API call or JWT token
    const savedWallet = window.localStorage.getItem('vaultix_wallet');
    if (savedWallet) {
      try {
        const parsed = JSON.parse(savedWallet);
        // Allow all connected wallets for demo — in production, check role from backend
        if (parsed.publicKey) {
          setAuthorized(true);
          return;
        }
      } catch {
        // ignore
      }
    }
    // For demo, always allow access
    setAuthorized(true);
  }, [router]);

  if (!authorized) {
    return (
      <div className="min-h-screen bg-[#0a0a0f] flex items-center justify-center">
        <div className="text-center">
          <Shield className="w-16 h-16 text-red-500 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-white mb-2">Access Denied</h1>
          <p className="text-gray-400 mb-6">
            You do not have admin privileges to access this page.
          </p>
          <Link
            href="/"
            className="inline-flex items-center px-6 py-3 bg-gradient-to-r from-purple-600 to-blue-500 text-white rounded-lg font-medium hover:shadow-lg hover:shadow-purple-500/25 transition-all"
          >
            Return Home
          </Link>
        </div>
      </div>
    );
  }

  const isActive = (href: string) => {
    if (href === '/admin') return pathname === '/admin';
    return pathname.startsWith(href);
  };

  return (
    <div className="min-h-screen bg-[#0a0a0f] flex">
      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          className="fixed inset-0 bg-black/60 z-40 lg:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed top-0 left-0 h-full bg-[#0d0d14] border-r border-white/5 z-50 transition-all duration-300 flex flex-col
          ${mobileOpen ? 'translate-x-0' : '-translate-x-full'} lg:translate-x-0
          ${collapsed ? 'w-[72px]' : 'w-[260px]'}
        `}
      >
        {/* Header */}
        <div className="h-16 flex items-center px-4 border-b border-white/5">
          {!collapsed && (
            <div className="flex items-center gap-3">
              <div className="h-8 w-8 relative flex-shrink-0">
                <div className="absolute inset-0 bg-gradient-to-r from-purple-600 to-blue-500 rounded-lg transform rotate-45" />
                <div className="absolute inset-[3px] bg-[#0d0d14] rounded-md flex items-center justify-center">
                  <span className="text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-blue-400 font-bold text-sm">
                    V
                  </span>
                </div>
              </div>
              <div>
                <h2 className="text-white font-semibold text-sm">Vaultix</h2>
                <p className="text-[10px] text-purple-400 font-medium tracking-wider uppercase">
                  Admin Panel
                </p>
              </div>
            </div>
          )}
          {collapsed && (
            <div className="h-8 w-8 relative mx-auto">
              <div className="absolute inset-0 bg-gradient-to-r from-purple-600 to-blue-500 rounded-lg transform rotate-45" />
              <div className="absolute inset-[3px] bg-[#0d0d14] rounded-md flex items-center justify-center">
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-blue-400 font-bold text-sm">
                  V
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Navigation */}
        <nav className="flex-1 py-4 px-2 space-y-1 overflow-y-auto">
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = isActive(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setMobileOpen(false)}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200 group relative
                  ${
                    active
                      ? 'bg-gradient-to-r from-purple-600/20 to-blue-500/10 text-white'
                      : 'text-gray-400 hover:text-white hover:bg-white/5'
                  }
                `}
              >
                {active && (
                  <div className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-6 bg-gradient-to-b from-purple-500 to-blue-500 rounded-r-full" />
                )}
                <Icon
                  className={`w-5 h-5 flex-shrink-0 ${
                    active ? 'text-purple-400' : 'group-hover:text-purple-300'
                  }`}
                />
                {!collapsed && (
                  <span className="text-sm font-medium">{item.label}</span>
                )}
              </Link>
            );
          })}
        </nav>

        {/* Collapse toggle */}
        <div className="p-3 border-t border-white/5 hidden lg:block">
          <button
            onClick={() => setCollapsed(!collapsed)}
            className="w-full flex items-center justify-center gap-2 px-3 py-2 text-gray-400 hover:text-white rounded-lg hover:bg-white/5 transition-colors"
          >
            {collapsed ? (
              <ChevronRight className="w-4 h-4" />
            ) : (
              <>
                <ChevronLeft className="w-4 h-4" />
                <span className="text-xs">Collapse</span>
              </>
            )}
          </button>
        </div>

        {/* Back to site */}
        <div className="p-3 border-t border-white/5">
          <Link
            href="/"
            className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-gray-400 hover:text-white hover:bg-white/5 transition-colors ${
              collapsed ? 'justify-center' : ''
            }`}
          >
            <LogOut className="w-5 h-5 flex-shrink-0" />
            {!collapsed && (
              <span className="text-sm font-medium">Back to Site</span>
            )}
          </Link>
        </div>
      </aside>

      {/* Main content */}
      <div
        className={`flex-1 transition-all duration-300 ${
          collapsed ? 'lg:ml-[72px]' : 'lg:ml-[260px]'
        }`}
      >
        {/* Mobile header */}
        <header className="lg:hidden sticky top-0 z-30 h-14 bg-[#0d0d14]/80 backdrop-blur-xl border-b border-white/5 flex items-center px-4">
          <button
            onClick={() => setMobileOpen(true)}
            className="text-gray-400 hover:text-white"
          >
            <Menu className="w-6 h-6" />
          </button>
          <span className="ml-3 text-sm font-medium text-white">
            Admin Dashboard
          </span>
        </header>

        {/* Page content */}
        <div className="p-4 md:p-6 lg:p-8">{children}</div>
      </div>
    </div>
  );
}
