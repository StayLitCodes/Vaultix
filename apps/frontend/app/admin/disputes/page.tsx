'use client';

import React, { useState, useEffect, useRef } from 'react';
import {
  AlertTriangle,
  Clock,
  Coins,
  MessageSquare,
  History,
  User,
  CheckCircle2,
  XCircle,
  ArrowLeft,
  Check,
  Loader2,
  Scale,
  FileText,
  ChevronRight,
  Shield,
  FileCode,
} from 'lucide-react';
import { AdminService } from '@/services/admin';
import { IAdminDispute } from '@/types/admin';
import { toast } from 'sonner';

export default function AdminDisputesPage() {
  const [disputes, setDisputes] = useState<IAdminDispute[]>([]);
  const [selectedDispute, setSelectedDispute] = useState<IAdminDispute | null>(null);
  const [loading, setLoading] = useState(true);
  const [sortBy, setSortBy] = useState<'oldest' | 'newest' | 'most_evidence' | 'highest_amount'>('oldest');
  
  // Resolution form states
  const [outcome, setOutcome] = useState<'released_to_seller' | 'refunded_to_buyer' | 'split'>('released_to_seller');
  const [resolutionNotes, setResolutionNotes] = useState('');
  const [sellerPercent, setSellerPercent] = useState<number>(50);
  const [buyerPercent, setBuyerPercent] = useState<number>(50);
  
  // Confirmation dialog state
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const notesInputRef = useRef<HTMLTextAreaElement>(null);

  // Fetch disputes
  useEffect(() => {
    loadDisputes();
  }, [sortBy]);

  const loadDisputes = async () => {
    try {
      setLoading(true);
      const res = await AdminService.getDisputes({ status: 'open', sortBy });
      setDisputes(res.disputes);
      
      // Auto-select first dispute if none selected and on desktop
      if (res.disputes.length > 0 && !selectedDispute) {
        setSelectedDispute(res.disputes[0]);
      } else if (selectedDispute) {
        // Refresh selected dispute details
        const updatedSelected = res.disputes.find(d => d.id === selectedDispute.id);
        setSelectedDispute(updatedSelected || res.disputes[0] || null);
      }
    } catch (error) {
      console.error('Error fetching disputes:', error);
      toast.error('Failed to load disputes');
    } finally {
      setLoading(false);
    }
  };

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger shortcuts when user is typing
      if (
        document.activeElement?.tagName === 'INPUT' ||
        document.activeElement?.tagName === 'TEXTAREA' ||
        document.activeElement?.getAttribute('contenteditable') === 'true'
      ) {
        return;
      }

      if (e.key === 'r' || e.key === 'R') {
        e.preventDefault();
        notesInputRef.current?.focus();
        toast.info('Form focused (Shortcut R)');
      } else if (e.key === 'b' || e.key === 'B') {
        e.preventDefault();
        setOutcome('refunded_to_buyer');
        toast.info('Outcome set to Refund Buyer (Shortcut B)');
      } else if (e.key === 's' || e.key === 'S') {
        e.preventDefault();
        setOutcome('released_to_seller');
        toast.info('Outcome set to Pay Seller (Shortcut S)');
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedDispute]);

  const getPriority = (amountStr: string, createdAt: string) => {
    const amount = parseFloat(amountStr);
    const ageDays = (Date.now() - new Date(createdAt).getTime()) / (24 * 60 * 60 * 1000);
    if (amount >= 10000 || ageDays >= 7) {
      return { label: 'High', color: 'text-red-400 bg-red-500/10 border-red-500/20' };
    }
    if (amount >= 1000 || ageDays >= 3) {
      return { label: 'Medium', color: 'text-amber-400 bg-amber-500/10 border-amber-500/20' };
    }
    return { label: 'Low', color: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20' };
  };

  const handleOpenConfirm = (e: React.FormEvent) => {
    e.preventDefault();
    if (!resolutionNotes.trim()) {
      toast.error('Resolution notes are required');
      return;
    }
    if (outcome === 'split' && sellerPercent + buyerPercent !== 100) {
      toast.error('Split percentages must sum to 100%');
      return;
    }
    setShowConfirmModal(true);
  };

  const handleSubmitResolution = async () => {
    if (!selectedDispute) return;
    setSubmitting(true);
    try {
      await AdminService.resolveDispute(selectedDispute.id, {
        outcome,
        resolutionNotes,
        sellerPercent: outcome === 'split' ? sellerPercent : undefined,
        buyerPercent: outcome === 'split' ? buyerPercent : undefined,
      });

      toast.success('Dispute resolved successfully');
      setResolutionNotes('');
      setShowConfirmModal(false);
      
      // Reload
      const res = await AdminService.getDisputes({ status: 'open', sortBy });
      setDisputes(res.disputes);
      if (res.disputes.length > 0) {
        setSelectedDispute(res.disputes[0]);
      } else {
        setSelectedDispute(null);
      }
    } catch (error) {
      console.error('Error resolving dispute:', error);
      toast.error('Failed to resolve dispute');
    } finally {
      setSubmitting(false);
    }
  };

  const handleSplitChange = (val: number, isSeller: boolean) => {
    if (isSeller) {
      setSellerPercent(val);
      setBuyerPercent(100 - val);
    } else {
      setBuyerPercent(val);
      setSellerPercent(100 - val);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <Scale className="text-purple-400 w-7 h-7" />
            Dispute Resolution
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Review evidence, communicate log, and resolve conflicts between parties.
          </p>
        </div>

        {/* Sort Controls */}
        <div className="flex items-center gap-3">
          <span className="text-xs text-gray-500 font-medium">Sort By:</span>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as any)}
            className="bg-[#12121a] border border-white/5 text-gray-300 text-xs rounded-lg px-3 py-2 focus:outline-none focus:border-purple-500/50"
          >
            <option value="oldest">Oldest First</option>
            <option value="newest">Newest First</option>
            <option value="most_evidence">Most Evidence</option>
            <option value="highest_amount">Highest Amount</option>
          </select>
        </div>
      </div>

      {loading && disputes.length === 0 ? (
        <div className="flex items-center justify-center min-h-[50vh]">
          <div className="flex flex-col items-center gap-3">
            <Loader2 className="w-8 h-8 text-purple-500 animate-spin" />
            <p className="text-sm text-gray-500">Loading open disputes...</p>
          </div>
        </div>
      ) : disputes.length === 0 ? (
        <div className="bg-[#12121a] border border-white/5 rounded-xl p-12 text-center">
          <Scale className="w-16 h-16 text-gray-700 mx-auto mb-4" />
          <h2 className="text-lg font-semibold text-white">No Open Disputes</h2>
          <p className="text-sm text-gray-500 mt-1 max-w-md mx-auto">
            All disputes have been successfully resolved. Great job!
          </p>
        </div>
      ) : (
        /* Split view grid */
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          
          {/* LEFT LIST: visible or hidden on mobile depending on selected state */}
          <div className={`lg:col-span-4 space-y-4 ${selectedDispute ? 'hidden lg:block' : 'block'}`}>
            <h2 className="text-sm font-semibold text-gray-400 px-1">
              Open Cases ({disputes.length})
            </h2>
            <div className="space-y-3 overflow-y-auto max-h-[75vh] pr-1">
              {disputes.map((dispute) => {
                const priority = getPriority(dispute.escrow.amount, dispute.createdAt);
                const isSelected = selectedDispute?.id === dispute.id;
                return (
                  <button
                    key={dispute.id}
                    onClick={() => setSelectedDispute(dispute)}
                    className={`w-full text-left rounded-xl p-4 border transition-all duration-200 block ${
                      isSelected
                        ? 'bg-purple-950/20 border-purple-500/50 shadow-lg shadow-purple-500/5'
                        : 'bg-[#12121a] border-white/5 hover:border-white/10'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3 mb-2">
                      <h3 className="font-semibold text-sm text-white truncate flex-1">
                        {dispute.escrow.title}
                      </h3>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${priority.color}`}>
                        {priority.label}
                      </span>
                    </div>

                    <div className="flex justify-between items-center text-xs mt-3">
                      <span className="text-purple-400 font-bold">
                        {dispute.escrow.amount} {dispute.escrow.asset}
                      </span>
                      <span className="text-gray-500 flex items-center gap-1">
                        <Clock className="w-3.5 h-3.5" />
                        {new Date(dispute.createdAt).toLocaleDateString()}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* RIGHT DETAIL SPLIT: visible on desktop, mobile list-to-detail toggle */}
          {selectedDispute && (
            <div className={`lg:col-span-8 grid grid-cols-1 md:grid-cols-12 gap-6 ${selectedDispute ? 'block' : 'hidden lg:block'}`}>
              
              {/* Back button for mobile detail view */}
              <div className="col-span-12 lg:hidden">
                <button
                  onClick={() => setSelectedDispute(null)}
                  className="flex items-center gap-2 text-xs text-gray-400 hover:text-white"
                >
                  <ArrowLeft className="w-4 h-4" />
                  Back to Open Disputes
                </button>
              </div>

              {/* Detail view left (Escrow Info + Evidence + Timeline + Chat) */}
              <div className="col-span-12 md:col-span-7 space-y-6">
                
                {/* Real-time Escrow details card */}
                <div className="bg-[#12121a] border border-white/5 rounded-xl p-5 space-y-4">
                  <div className="flex items-center justify-between border-b border-white/5 pb-3">
                    <span className="text-xs text-gray-500">Escrow Contract Details</span>
                    <span className="text-xs text-purple-400 font-medium">DISPUTED</span>
                  </div>

                  <div>
                    <h3 className="text-lg font-semibold text-white">{selectedDispute.escrow.title}</h3>
                    <p className="text-xs text-gray-400 mt-1 leading-relaxed">
                      {selectedDispute.escrow.description}
                    </p>
                  </div>

                  <div className="grid grid-cols-2 gap-4 bg-white/[0.02] rounded-lg p-3 text-xs">
                    <div>
                      <p className="text-gray-500">Amount</p>
                      <p className="text-base font-bold text-white mt-0.5">
                        {selectedDispute.escrow.amount} {selectedDispute.escrow.asset}
                      </p>
                    </div>
                    <div>
                      <p className="text-gray-500">Dispute Raised By</p>
                      <p className="text-sm font-medium text-gray-300 mt-0.5 truncate">
                        {selectedDispute.filedBy.walletAddress}
                      </p>
                    </div>
                  </div>

                  {/* Reason & Evidence */}
                  <div className="space-y-2">
                    <span className="text-xs text-gray-500 font-medium block">Reason for Dispute</span>
                    <p className="text-xs text-gray-300 bg-red-500/5 border border-red-500/10 rounded-lg p-3 leading-relaxed">
                      {selectedDispute.reason}
                    </p>
                  </div>

                  {selectedDispute.evidence && selectedDispute.evidence.length > 0 && (
                    <div className="space-y-2">
                      <span className="text-xs text-gray-500 font-medium block">Evidence Documents</span>
                      <div className="space-y-1.5">
                        {selectedDispute.evidence.map((ev, idx) => (
                          <div
                            key={idx}
                            className="flex items-center justify-between bg-white/[0.02] border border-white/5 rounded-lg p-2.5 text-xs text-gray-300 hover:bg-white/[0.04] transition-colors"
                          >
                            <span className="truncate flex items-center gap-2">
                              <FileText className="w-4 h-4 text-purple-400 flex-shrink-0" />
                              {ev}
                            </span>
                            <button
                              onClick={() => toast.info(`Viewing evidence: ${ev}`)}
                              className="text-purple-400 hover:text-purple-300 font-medium text-[11px]"
                            >
                              View
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* Communication Log */}
                <div className="bg-[#12121a] border border-white/5 rounded-xl p-5 space-y-4">
                  <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                    <MessageSquare className="w-4 h-4 text-purple-400" />
                    Communication Log
                  </h3>
                  
                  {selectedDispute.communicationLog && selectedDispute.communicationLog.length > 0 ? (
                    <div className="space-y-3 max-h-56 overflow-y-auto pr-1">
                      {selectedDispute.communicationLog.map((chat) => (
                        <div key={chat.id} className="bg-white/[0.01] border border-white/5 rounded-lg p-3 space-y-1">
                          <div className="flex justify-between items-center text-[10px]">
                            <span className="font-semibold text-purple-300">{chat.sender}</span>
                            <span className="text-gray-500">
                              {new Date(chat.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </span>
                          </div>
                          <p className="text-xs text-gray-300 leading-relaxed">{chat.message}</p>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-gray-500 text-center py-4">No communication logs recorded.</p>
                  )}
                </div>

                {/* Resolution history for re-opened disputes */}
                {selectedDispute.resolutionHistory && selectedDispute.resolutionHistory.length > 0 && (
                  <div className="bg-[#12121a] border border-white/5 rounded-xl p-5 space-y-4">
                    <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                      <History className="w-4 h-4 text-purple-400" />
                      Resolution History (Re-opened Case)
                    </h3>
                    <div className="space-y-3">
                      {selectedDispute.resolutionHistory.map((hist, idx) => (
                        <div key={idx} className="border-l-2 border-purple-500/50 pl-3 py-1 space-y-1">
                          <div className="flex justify-between items-center text-xs">
                            <span className="font-semibold text-gray-300 capitalize">
                              Outcome: {hist.outcome.replace(/_/g, ' ')}
                            </span>
                            <span className="text-[10px] text-gray-500">
                              {new Date(hist.resolvedAt).toLocaleDateString()}
                            </span>
                          </div>
                          <p className="text-xs text-gray-400 leading-relaxed">
                            {hist.notes}
                          </p>
                          <p className="text-[10px] text-purple-400/80">
                            Arbitrator: {hist.resolvedBy}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Timeline */}
                <div className="bg-[#12121a] border border-white/5 rounded-xl p-5 space-y-4">
                  <h3 className="text-sm font-semibold text-white">Dispute Timeline</h3>
                  <div className="space-y-4">
                    {selectedDispute.timeline?.map((item) => (
                      <div key={item.id} className="flex gap-3 text-xs">
                        <div className="flex flex-col items-center">
                          <div className="w-2.5 h-2.5 rounded-full bg-purple-500 mt-1" />
                          <div className="w-0.5 flex-1 bg-white/5 min-h-[20px]" />
                        </div>
                        <div className="flex-1 pb-2">
                          <div className="flex items-center justify-between">
                            <span className="font-semibold text-gray-300">{item.title}</span>
                            <span className="text-[10px] text-gray-500">
                              {new Date(item.timestamp).toLocaleDateString()}
                            </span>
                          </div>
                          <p className="text-gray-500 mt-0.5">{item.description}</p>
                          <span className="text-[10px] text-purple-400/70 mt-1 block">Actor: {item.actor}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

              </div>

              {/* Detail view right (Resolution form) */}
              <div className="col-span-12 md:col-span-5">
                <div className="bg-[#12121a] border border-white/5 rounded-xl p-5 space-y-5 sticky top-24">
                  <div>
                    <h3 className="text-sm font-semibold text-white">Arbitration Resolution</h3>
                    <p className="text-[10px] text-gray-500 mt-0.5">
                      Keyboard shortcuts: <kbd className="bg-white/5 px-1 rounded text-[9px]">R</kbd>=Focus notes, <kbd className="bg-white/5 px-1 rounded text-[9px]">B</kbd>=Buyer wins, <kbd className="bg-white/5 px-1 rounded text-[9px]">S</kbd>=Seller wins
                    </p>
                  </div>

                  <form onSubmit={handleOpenConfirm} className="space-y-4">
                    {/* Outcome Type */}
                    <div className="space-y-2">
                      <label className="text-xs text-gray-400 font-medium">Outcome</label>
                      <div className="grid grid-cols-1 gap-2">
                        <button
                          type="button"
                          onClick={() => setOutcome('released_to_seller')}
                          className={`flex items-center justify-between p-3 rounded-lg border text-xs text-left transition-colors ${
                            outcome === 'released_to_seller'
                              ? 'bg-purple-950/20 border-purple-500 text-white'
                              : 'bg-white/[0.02] border-white/5 text-gray-400 hover:border-white/10'
                          }`}
                        >
                          <span>Pay Seller (100%)</span>
                          {outcome === 'released_to_seller' && <Check className="w-4 h-4 text-purple-400" />}
                        </button>
                        <button
                          type="button"
                          onClick={() => setOutcome('refunded_to_buyer')}
                          className={`flex items-center justify-between p-3 rounded-lg border text-xs text-left transition-colors ${
                            outcome === 'refunded_to_buyer'
                              ? 'bg-purple-950/20 border-purple-500 text-white'
                              : 'bg-white/[0.02] border-white/5 text-gray-400 hover:border-white/10'
                          }`}
                        >
                          <span>Refund Buyer (100%)</span>
                          {outcome === 'refunded_to_buyer' && <Check className="w-4 h-4 text-purple-400" />}
                        </button>
                        <button
                          type="button"
                          onClick={() => setOutcome('split')}
                          className={`flex items-center justify-between p-3 rounded-lg border text-xs text-left transition-colors ${
                            outcome === 'split'
                              ? 'bg-purple-950/20 border-purple-500 text-white'
                              : 'bg-white/[0.02] border-white/5 text-gray-400 hover:border-white/10'
                          }`}
                        >
                          <span>Custom Split (%)</span>
                          {outcome === 'split' && <Check className="w-4 h-4 text-purple-400" />}
                        </button>
                      </div>
                    </div>

                    {/* Custom Split Sliders */}
                    {outcome === 'split' && (
                      <div className="space-y-3 bg-white/[0.02] border border-white/5 rounded-lg p-3 text-xs">
                        <div className="space-y-1.5">
                          <div className="flex justify-between">
                            <span className="text-gray-400">Buyer Receives</span>
                            <span className="text-white font-bold">{buyerPercent}%</span>
                          </div>
                          <input
                            type="range"
                            min="0"
                            max="100"
                            value={buyerPercent}
                            onChange={(e) => handleSplitChange(Number(e.target.value), false)}
                            className="w-full h-1 bg-white/10 rounded-lg appearance-none cursor-pointer accent-purple-500"
                          />
                        </div>

                        <div className="space-y-1.5">
                          <div className="flex justify-between">
                            <span className="text-gray-400">Seller Receives</span>
                            <span className="text-white font-bold">{sellerPercent}%</span>
                          </div>
                          <input
                            type="range"
                            min="0"
                            max="100"
                            value={sellerPercent}
                            onChange={(e) => handleSplitChange(Number(e.target.value), true)}
                            className="w-full h-1 bg-white/10 rounded-lg appearance-none cursor-pointer accent-purple-500"
                          />
                        </div>
                      </div>
                    )}

                    {/* Notes */}
                    <div className="space-y-2">
                      <label className="text-xs text-gray-400 font-medium">Resolution Notes</label>
                      <textarea
                        ref={notesInputRef}
                        value={resolutionNotes}
                        onChange={(e) => setResolutionNotes(e.target.value)}
                        placeholder="Write detail explanation of resolution..."
                        rows={5}
                        className="w-full bg-white/[0.02] border border-white/5 rounded-lg p-3 text-xs text-white placeholder-gray-600 focus:outline-none focus:border-purple-500/50"
                      />
                    </div>

                    {/* Submit Button */}
                    <button
                      type="submit"
                      className="w-full bg-gradient-to-r from-purple-600 to-blue-500 hover:from-purple-500 hover:to-blue-400 text-white font-semibold text-xs py-3 rounded-lg shadow-lg hover:shadow-purple-500/10 transition-all cursor-pointer"
                    >
                      Submit Resolution
                    </button>
                  </form>
                </div>
              </div>

            </div>
          )}

        </div>
      )}

      {/* Confirmation Dialog Modal */}
      {showConfirmModal && selectedDispute && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => setShowConfirmModal(false)}
          />
          <div className="relative bg-[#12121a] border border-white/10 rounded-xl p-6 max-w-md w-full shadow-2xl space-y-4">
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <AlertTriangle className="text-amber-500 w-5 h-5" />
              Confirm Arbitration Ruling
            </h3>
            
            <p className="text-xs text-gray-400 leading-relaxed">
              Are you sure you want to finalize this resolution? This action will transfer on-chain funds accordingly and close the dispute. It cannot be undone.
            </p>

            <div className="bg-white/[0.02] rounded-lg p-3 text-xs space-y-2 text-gray-300">
              <div className="flex justify-between">
                <span>Dispute:</span>
                <span className="font-semibold text-white">{selectedDispute.escrow.title}</span>
              </div>
              <div className="flex justify-between">
                <span>Outcome:</span>
                <span className="font-semibold text-purple-400 capitalize">
                  {outcome === 'split' ? `Custom Split (B:${buyerPercent}% / S:${sellerPercent}%)` : outcome.replace(/_/g, ' ')}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-3 justify-end pt-2 text-xs">
              <button
                type="button"
                onClick={() => setShowConfirmModal(false)}
                className="px-4 py-2 border border-white/5 text-gray-400 hover:text-white rounded-lg transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSubmitResolution}
                disabled={submitting}
                className="px-4 py-2 bg-gradient-to-r from-purple-600 to-blue-500 text-white rounded-lg font-semibold hover:opacity-90 disabled:opacity-50 transition-opacity cursor-pointer flex items-center gap-2"
              >
                {submitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                Confirm Resolution
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
