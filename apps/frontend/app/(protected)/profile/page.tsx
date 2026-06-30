'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { 
  User, Wallet, Calendar, ShieldCheck, Award, 
  FileText, CheckCircle2, AlertTriangle, TrendingUp, 
  DollarSign, Edit3, Check, X, Copy, ExternalLink 
} from 'lucide-react';

interface EscrowRecord {
  id: string;
  title: string;
  status: 'PENDING' | 'ACTIVE' | 'COMPLETED' | 'DISPUTED' | 'REFUNDED';
  amount: number;
  createdAt: string;
}

interface ProfileData {
  walletAddress: string;
  displayName: string;
  createdAt: string;
  role: 'USER' | 'ADMIN' | 'VERIFIER';
  stats: {
    totalCreated: number;
    totalParticipated: number;
    completedCount: number;
    disputeCount: number;
    totalVolume: number;
  };
  recentHistory: EscrowRecord[];
}

export default function ProfilePage() {
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isEditingName, setIsEditingName] = useState(false);
  const [nameInput, setNameInput] = useState('');
  const [copied, setCopied] = useState(false);
  const [isSavingName, setIsSavingName] = useState(false);

  // 1. Data Hydration Ingestion Matrix
  const fetchProfile = useCallback(async () => {
    try {
      const response = await fetch('/api/user/profile');
      if (response.ok) {
        const data = await response.json();
        setProfile(data);
        setNameInput(data.displayName || '');
      }
    } catch (err) {
      console.error('Failed to resolve profile dataset registries:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchProfile();
  }, [fetchProfile]);

  // 2. Inline Interactive Name Upstream Dispatches
  const handleSaveName = async () => {
    if (!nameInput.trim() || isSavingName) return;
    setIsSavingName(true);
    try {
      const response = await fetch('/api/user/profile/update', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ displayName: nameInput.trim() }),
      });
      if (response.ok) {
        setProfile(prev => prev ? { ...prev, displayName: nameInput.trim() } : null);
        setIsEditingName(false);
      }
    } catch (err) {
      console.error('Failed to commit profile display name mutations:', err);
    } finally {
      setIsSavingName(false);
    }
  };

  const handleCopyWallet = () => {
    if (!profile?.walletAddress) return;
    navigator.clipboard.writeText(profile.walletAddress);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // 3. Mathematical Algorithmic Reputation Computations
  const computedMetrics = useMemo(() => {
    if (!profile) return null;

    const { totalCreated, totalParticipated, completedCount, disputeCount, totalVolume } = profile.stats;
    const totalParticipation = totalCreated + totalParticipated;

    // Averages and Success Baselines
    const successRate = totalParticipation > 0 ? (completedCount / totalParticipation) * 100 : 100;
    const avgAmount = completedCount > 0 ? totalVolume / completedCount : 0;
    
    // Account Age Scoring Framework (Max 100 base bounds mapped across 1 year milestone rules)
    const accountAgeDays = Math.floor((Date.now() - new Date(profile.createdAt).getTime()) / (1000 * 60 * 60 * 24));
    const ageScore = Math.min((accountAgeDays / 365) * 100, 100);

    // Inverse Dispute Burden
    const disputeRate = totalParticipation > 0 ? (disputeCount / totalParticipation) : 0;
    const inverseDisputeScore = Math.max((1 - disputeRate) * 100, 0);

    // Volume Multiplier Bracket Scoring (ceiling cap normalized at $50k)
    const volumeScore = Math.min((totalVolume / 50000) * 100, 100);

    // Weighted Formula Combination Checklist: Success (40%) + Inverse Dispute (30%) + Age (15%) + Volume (15%)
    const trustScore = Math.round(
      (successRate * 0.40) + 
      (inverseDisputeScore * 0.30) + 
      (ageScore * 0.15) + 
      (volumeScore * 0.15)
    );

    // Tier Classification Engine Selection Boundaries
    let tier: 'Bronze' | 'Silver' | 'Gold' | 'Platinum' = 'Bronze';
    let tierColor = 'bg-amber-900/30 border-amber-800 text-amber-500';
    if (trustScore >= 90) {
      tier = 'Platinum';
      tierColor = 'bg-cyan-950/40 border-cyan-800 text-cyan-400';
    } else if (trustScore >= 75) {
      tier = 'Gold';
      tierColor = 'bg-yellow-950/40 border-yellow-800 text-yellow-400';
    } else if (trustScore >= 50) {
      tier = 'Silver';
      tierColor = 'bg-slate-800/80 border-slate-700 text-slate-300';
    }

    return {
      successRate: Math.round(successRate),
      avgAmount: Math.round(avgAmount),
      trustScore,
      tier,
      tierColor
    };
  }, [profile]);

  // LOADING SKELETON PLACEHOLDERS FLUID TRANSITIONS
  if (isLoading) {
    return (
      <div className="w-full min-h-screen bg-slate-950 p-6 md:p-8 space-y-6 max-w-6xl mx-auto animate-pulse">
        <div className="h-32 bg-slate-900 border border-slate-800 rounded-2xl w-full" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="h-64 bg-slate-900 border border-slate-800 rounded-2xl md:col-span-1" />
          <div className="h-64 bg-slate-900 border border-slate-800 rounded-2xl md:col-span-2" />
        </div>
      </div>
    );
  }

  if (!profile || !computedMetrics) return null;

  return (
    <div className="w-full min-h-screen bg-slate-950 text-slate-100 p-6 md:p-8 space-y-6 max-w-6xl mx-auto">
      
      {/* HEADER META CARD: MULTI-DEVICE RESPONSIVE WRAPPER */}
      <div className="bg-gradient-to-br from-slate-900 to-slate-950 border border-slate-800 p-6 rounded-2xl flex flex-col sm:flex-row items-center justify-between gap-6">
        <div className="flex flex-col sm:flex-row items-center gap-4 text-center sm:text-left w-full">
          <div className="w-16 h-16 rounded-2xl bg-blue-600/10 border border-blue-500/30 flex items-center justify-center shrink-0">
            <User className="text-blue-500 w-8 h-8" />
          </div>
          
          <div className="space-y-1.5 w-full max-w-md">
            <div className="flex items-center justify-center sm:justify-start gap-2">
              {isEditingName ? (
                <div className="flex items-center gap-1.5 w-full">
                  <input
                    type="text"
                    value={nameInput}
                    onChange={(e) => setNameInput(e.target.value)}
                    className="bg-slate-950 border border-slate-700 rounded px-2 py-0.5 text-sm text-white focus:outline-none focus:border-blue-500"
                    maxLength={25}
                    disabled={isSavingName}
                  />
                  <button onClick={handleSaveName} className="p-1 text-emerald-400 hover:text-white"><Check size={14} /></button>
                  <button onClick={() => { setIsEditingName(false); setNameInput(profile.displayName); }} className="p-1 text-rose-400 hover:text-white"><X size={14} /></button>
                </div>
              ) : (
                <>
                  <h1 className="text-xl font-extrabold text-white truncate">{profile.displayName || 'Anonymous User'}</h1>
                  <button onClick={() => setIsEditingName(true)} className="p-1 text-slate-500 hover:text-slate-300 transition-colors">
                    <Edit3 size={14} />
                  </button>
                </>
              )}
            </div>

            {/* Wallet Quick Copy Sub-row */}
            <div className="flex items-center justify-center sm:justify-start gap-1.5 text-xs text-slate-400">
              <Wallet size={13} className="text-slate-500" />
              <span className="font-mono">{profile.walletAddress.slice(0, 6)}...{profile.walletAddress.slice(-6)}</span>
              <button onClick={handleCopyWallet} className="p-1 hover:text-white text-slate-500 transition-colors">
                {copied ? <span className="text-[10px] font-bold text-emerald-400">Copied!</span> : <Copy size={12} />}
              </button>
            </div>
          </div>
        </div>

        {/* System Authorized Role Badge Block */}
        <div className="shrink-0 flex sm:flex-col items-center sm:items-end gap-2 text-right">
          <span className="px-2.5 py-0.5 bg-blue-950/50 border border-blue-900/60 text-blue-400 font-bold text-[10px] tracking-wider rounded-full uppercase">
            {profile.role} Badge
          </span>
          <div className="flex items-center gap-1 text-[11px] text-slate-500">
            <Calendar size={12} />
            <span>Joined {new Date(profile.createdAt).toLocaleDateString(undefined, { month: 'short', year: 'numeric' })}</span>
          </div>
        </div>
      </div>

      {/* CORE TWO-COLUMN MAIN WORKSPACE */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        
        {/* LEFT COLUMN: TRUST AND REPUTATION METRICS (1-span) */}
        <div className="space-y-6 lg:col-span-1">
          
          {/* Trust Score Radial Dial Summary Module */}
          <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl text-center space-y-4">
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider text-left">Escrow Reputation Bracket</h3>
            
            <div className="relative w-32 h-32 mx-auto flex items-center justify-center">
              {/* Outer visual feedback ring */}
              <div className="absolute inset-0 rounded-full border-4 border-slate-800" />
              <div className="flex flex-col items-center">
                <span className="text-3xl font-black text-white font-mono">{computedMetrics.trustScore}</span>
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mt-0.5">Trust Index</span>
              </div>
            </div>

            <div className={`mx-auto w-fit px-4 py-1 border text-xs font-black rounded-lg uppercase tracking-widest flex items-center gap-1.5 ${computedMetrics.tierColor}`}>
              <Award size={14} /> {computedMetrics.tier} Tier
            </div>
          </div>

          {/* System Isolated Dispute Logs (Visible only to context rules targets) */}
          <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl space-y-3">
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
              <ShieldCheck size={14} className="text-slate-500" /> Administrative Auditing
            </h3>
            <div className="p-3 bg-slate-950 rounded-xl border border-slate-800/60 flex items-center justify-between text-xs font-medium">
              <span className="text-slate-400">Lifetime Disputes Handled</span>
              <span className={`font-mono font-bold ${profile.stats.disputeCount > 0 ? 'text-rose-400' : 'text-slate-300'}`}>
                {profile.stats.disputeCount} incidents
              </span>
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN: PORTFOLIO AGGREGATES AND LIVE ESCROW HISTORY (2-spans) */}
        <div className="space-y-6 lg:col-span-2">
          
          {/* Numerical Aggregate Statistics Dashboard Row */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
            <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wide flex items-center gap-1">
                <FileText size={12} className="text-blue-500" /> Total Escrows
              </span>
              <span className="text-xl font-extrabold text-white mt-1.5 block font-mono">{profile.stats.totalCreated + profile.stats.totalParticipated}</span>
            </div>
            <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wide flex items-center gap-1">
                <CheckCircle2 size={12} className="text-emerald-500" /> Completed
              </span>
              <span className="text-xl font-extrabold text-white mt-1.5 block font-mono">{profile.stats.completedCount}</span>
            </div>
            <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl col-span-2 sm:col-span-1">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wide flex items-center gap-1">
                <TrendingUp size={12} className="text-cyan-500" /> Success Bound
              </span>
              <span className="text-xl font-extrabold text-emerald-400 mt-1.5 block font-mono">{computedMetrics.successRate}%</span>
            </div>
            <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl col-span-1">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wide flex items-center gap-1">
                <DollarSign size={12} className="text-slate-500" /> Gross Volume
              </span>
              <span className="text-xl font-extrabold text-white mt-1.5 block font-mono">${profile.stats.totalVolume.toLocaleString()}</span>
            </div>
            <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl col-span-1 sm:col-span-2">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wide flex items-center gap-1">
                <DollarSign size={12} className="text-slate-500" /> Median Ticket Size
              </span>
              <span className="text-xl font-extrabold text-white mt-1.5 block font-mono">${computedMetrics.avgAmount.toLocaleString()}</span>
            </div>
          </div>

          {/* RECENT HISTORICAL ACTIVITY LOG TABLE PREVIEW */}
          <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl">
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4">Recent Portfolio Activity</h3>
            
            {profile.recentHistory.length === 0 ? (
              <p className="text-xs text-slate-500 text-center italic py-6">Zero historical transaction entries reported.</p>
            ) : (
              <div className="space-y-2">
                {profile.recentHistory.map((escrow) => (
                  <div key={escrow.id} className="p-3 bg-slate-950 border border-slate-850 rounded-xl flex items-center justify-between text-xs font-medium hover:border-slate-700 transition-colors">
                    <div className="min-w-0 pr-2">
                      <span className="text-slate-200 font-bold block truncate">{escrow.title}</span>
                      <span className="text-[10px] text-slate-500 block font-mono mt-0.5">
                        {new Date(escrow.createdAt).toLocaleDateString(undefined, { dateStyle: 'medium' })}
                      </span>
                    </div>
                    
                    <div className="flex items-center gap-4 shrink-0 text-right">
                      <div>
                        <span className="text-white block font-mono font-bold">${escrow.amount.toLocaleString()}</span>
                        <span className={`text-[9px] font-black tracking-wide border px-1.5 py-0.5 rounded uppercase mt-1 inline-block ${
                          escrow.status === 'COMPLETED' ? 'bg-emerald-950/40 border-emerald-900 text-emerald-400' :
                          escrow.status === 'DISPUTED' ? 'bg-rose-950/40 border-rose-900 text-rose-400' :
                          'bg-amber-950/40 border-amber-900 text-amber-400'
                        }`}>
                          {escrow.status}
                        </span>
                      </div>
                      <button title="Inspect Escrow Log" className="p-1.5 rounded-lg bg-slate-900 border border-slate-800 text-slate-400 hover:text-white transition-colors">
                        <ExternalLink size={13} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}