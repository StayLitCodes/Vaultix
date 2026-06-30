"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { useEscrow } from "@/hooks/useEscrow";
import { useWallet } from "@/hooks/useWallet";
import EscrowHeader from "@/components/escrow/detail/EscrowHeader";
import PartiesSection from "@/components/escrow/detail/PartiesSection";
import TermsSection from "@/components/escrow/detail/TermsSection";
import EscrowTimeline from "@/components/escrow/EscrowTimeline";
import ActivityFeed from "@/components/common/ActivityFeed";
import ConditionsList from "@/components/escrow/ConditionsList";
import { IParty } from "@/types/escrow";
import FileDisputeModal from "@/components/escrow/detail/file-dispute-modal";
import DisputeSection from "@/components/escrow/detail/DisputeSection";
import ArbitratorResolutionModal from "@/components/escrow/detail/ArbitratorResolutionModal";
import { EscrowDetailSkeleton } from "@/components/ui/EscrowDetailSkeleton";

const EscrowDetailPage = () => {
  const { id } = useParams();
  const { escrow, error, loading, refetch, isLive } = useEscrow(id as string);
  const { connected, publicKey, connect } = useWallet();
  
  const [userRole, setUserRole] = useState<"creator" | "counterparty" | "arbitrator" | null>(null);
  const [currentParty, setCurrentParty] = useState<IParty | null>(null);
  const [disputeOpen, setDisputeOpen] = useState(false);
  const [resolutionOpen, setResolutionOpen] = useState(false);
  const [dispute, setDispute] = useState<any>(null);

  useEffect(() => {
    if (escrow && publicKey) {
      if (escrow.creatorId === publicKey) {
        setUserRole("creator");
        setCurrentParty(null);
      } else if (escrow.parties?.some((p) => p.userId === publicKey)) {
        setUserRole("counterparty");
        setCurrentParty(
          escrow.parties.find((p) => p.userId === publicKey) ?? null,
        );
      } else {
        setUserRole(null);
        setCurrentParty(null);
      }
    } else {
      setUserRole(null);
      setCurrentParty(null);
    }
  }, [escrow, publicKey]);

  const fetchDisputeData = useCallback(async () => {
    if (escrow?.status !== "DISPUTED") {
      setDispute(null);
      return;
    }
    try {
      const response = await fetch(`/api/escrows/${escrow.id}/dispute`);
      if (response.ok) {
        const disputeData = await response.json();
        setDispute(disputeData);
      }
    } catch (error) {
      console.error("Error fetching dispute details:", error);
    }
  }, [escrow?.id, escrow?.status]);

  // Hook up dispute monitoring states
  useEffect(() => {
    void fetchDisputeData();
  }, [fetchDisputeData]);

  if (loading) return <EscrowDetailSkeleton />;

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background text-foreground p-4">
        <div className="bg-card text-card-foreground p-6 sm:p-8 rounded-xl shadow-sm border border-border max-w-md w-full text-center">
          <h2 className="text-xl font-bold text-destructive mb-3">Error Loading Escrow</h2>
          <p className="text-muted-foreground text-sm mb-4">{error}</p>
          <button
            onClick={() => window.location.reload()}
            className="min-h-11 px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium transition-colors cursor-pointer"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (!escrow) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background text-foreground p-4">
        <div className="bg-card text-card-foreground p-6 sm:p-8 rounded-xl shadow-sm border border-border max-w-md w-full text-center">
          <h2 className="text-xl font-bold text-foreground mb-3">Escrow Not Found</h2>
          <p className="text-muted-foreground text-sm mb-4">The requested escrow agreement could not be found.</p>
          <Link
            href="/escrow"
            className="min-h-11 inline-flex items-center px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium transition-colors cursor-pointer"
          >
            Back to Escrows
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground py-4 sm:py-8">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Visual Live Status Sync Badge Indicator */}
        <div className="flex justify-end mb-3">
          <div className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold border transition-all ${
            isLive 
              ? "bg-emerald-500/10 text-emerald-500 border-emerald-500/30" 
              : "bg-amber-500/10 text-amber-500 border-amber-500/30 animate-pulse"
          }`}>
            <span className={`h-2 w-2 rounded-full ${isLive ? "bg-emerald-500 animate-ping" : "bg-amber-500"}`} />
            {isLive ? "LIVE SYNC ACTIVE" : "DISCONNECTED — POLLING MODE"}
          </div>
        </div>

        <EscrowHeader
          escrow={escrow}
          userRole={userRole}
          connected={connected}
          connect={connect}
          publicKey={publicKey}
          onFileDispute={() => setDisputeOpen(true)}
        />

        <div className="lg:hidden mt-4">
          <TermsSection escrow={escrow} userRole={userRole} />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6 mt-4 sm:mt-8">
          <div className="lg:col-span-2 space-y-4 sm:space-y-6">
            {escrow.status === "DISPUTED" && (
              <DisputeSection
                escrowId={escrow.id}
                escrowStatus={escrow.status}
                userRole={userRole}
                publicKey={publicKey}
                dispute={dispute}
                onDisputeUpdate={() => {
                  refetch();
                  void fetchDisputeData();
                }}
                onResolveDispute={() => setResolutionOpen(true)}
              />
            )}
            <PartiesSection
              escrow={escrow}
              currentParty={currentParty}
              onEscrowUpdated={refetch}
              userRole={userRole}
            />
            <ConditionsList
              escrowId={escrow.id}
              escrowStatus={escrow.status}
              conditions={escrow.conditions}
              currentParty={currentParty}
              onConditionsUpdated={refetch}
            />
            <EscrowTimeline
              escrowId={escrow.id}
              escrowStatus={escrow.status}
              hasConditions={(escrow.conditions?.length ?? 0) > 0}
              initialEvents={escrow.events}
            />
            <ActivityFeed escrowId={id as string} />
          </div>

          <div className="hidden lg:block lg:col-span-1">
            <TermsSection escrow={escrow} userRole={userRole} />
          </div>
        </div>
      </div>

      <FileDisputeModal
        open={disputeOpen}
        onClose={() => setDisputeOpen(false)}
        escrowId={escrow.id}
        userRole={userRole}
        escrowStatus={escrow.status}
        onDisputeUpdate={() => {
          refetch();
          void fetchDisputeData();
        }}
      />
      <ArbitratorResolutionModal
        open={resolutionOpen}
        onClose={() => setResolutionOpen(false)}
        dispute={dispute}
        escrowAmount={escrow.amount}
        escrowAsset={escrow.asset}
        onResolutionComplete={() => {
          refetch();
          setResolutionOpen(false);
        }}
      />
    </div>
  );
};

export default EscrowDetailPage;