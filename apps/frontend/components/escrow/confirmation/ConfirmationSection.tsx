"use client";

import React, { useState} from "react";
import {
  CheckCircle2,
  FileSignature,
} from "lucide-react";
import ConfirmDialog from "./ConfirmDialog";
import PartyConfirmationList from "./PartyConfirmationList";
import ConfirmationProgress from "./ConfirmationProgress";

// ==========================================
// TYPES & MOCK DATA (Move to types/escrow.ts)
// ==========================================

export type Role = "Buyer" | "Seller" | "Arbiter";

export interface EscrowParty {
  id: string;
  address: string;
  role: Role;
  hasConfirmed: boolean;
  confirmationDate?: string;
  message?: string;
}

// Mock Current User
const CURRENT_USER_ADDRESS = "0x0523...8a9c"; // Simulating a connected wallet

// Mock Initial Data
const INITIAL_PARTIES: EscrowParty[] = [
  {
    id: "1",
    address: "0x0523...8a9c", // Current user
    role: "Buyer",
    hasConfirmed: false,
  },
  {
    id: "2",
    address: "0x0789...1b2d",
    role: "Seller",
    hasConfirmed: true,
    confirmationDate: "2023-10-27T10:00:00Z",
    message: "Milestone 1 completed and deployed.",
  },
  {
    id: "3",
    address: "0x0999...4f5e",
    role: "Arbiter",
    hasConfirmed: false,
  },
];

// Utility to truncate wallet addresses
export const truncateAddress = (address: string) => {
  if (address.length < 10) return address;
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
};



// ==========================================
//  ConfirmationSection.tsx (Main Wrapper)
// ==========================================

export default function ConfirmationSection() {
  const [parties, setParties] = useState<EscrowParty[]>(INITIAL_PARTIES);
  const [isModalOpen, setIsModalOpen] = useState(false);
  
  // Derived state
  const confirmedCount = parties.filter((p) => p.hasConfirmed).length;
  const totalCount = parties.length;
  const isFullyConfirmed = confirmedCount === totalCount;
  
  const currentUser = parties.find((p) => p.address === CURRENT_USER_ADDRESS);
  const canConfirm = currentUser && !currentUser.hasConfirmed;

  // Mock service call to simulate wallet signing and backend update
  const handleConfirmMilestone = async (message: string) => {
    return new Promise<void>((resolve, reject) => {
      // Simulating network delay for transaction signing
      setTimeout(() => {
        // Randomly simulate a failure 10% of the time for testing error states
        if (Math.random() < 0.1) {
          reject(new Error("User rejected transaction"));
          return;
        }

        // Update state on success
        setParties((prev) =>
          prev.map((party) =>
            party.address === CURRENT_USER_ADDRESS
              ? {
                  ...party,
                  hasConfirmed: true,
                  message: message || "Confirmed.",
                  confirmationDate: new Date().toISOString(),
                }
              : party
          )
        );
        setIsModalOpen(false);
        resolve();
      }, 2000);
    });
  };

  return (
    <div className="py-20">
      <div className="max-w-3xl mx-auto p-6 bg-gray-900 rounded-2xl border border-gray-800 shadow-xl">
      <div className="mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-white mb-1">Milestone Confirmation</h2>
          <p className="text-gray-400 text-sm">
            All assigned parties must sign to release funds to the seller.
          </p>
        </div>

        {/* Action Button */}
        {currentUser && (
          <button
            onClick={() => setIsModalOpen(true)}
            disabled={!canConfirm}
            className={`shrink-0 px-6 py-2.5 rounded-lg font-medium text-sm transition-all flex items-center gap-2 shadow-lg ${
              !canConfirm
                ? "bg-gray-800 text-gray-500 cursor-not-allowed border border-gray-700"
                : "bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-500 hover:to-blue-500 text-white hover:scale-105 active:scale-95"
            }`}
          >
            {!canConfirm ? (
              <>
                <CheckCircle2 className="w-4 h-4" />
                Already Confirmed
              </>
            ) : (
              <>
                <FileSignature className="w-4 h-4" />
                Confirm Milestone
              </>
            )}
          </button>
        )}
      </div>

      <ConfirmationProgress total={totalCount} confirmed={confirmedCount} />
      
      <PartyConfirmationList parties={parties} currentUserAddress={CURRENT_USER_ADDRESS} />

      {/* Success State Overlay when 100% complete */}
      {isFullyConfirmed && (
        <div className="mt-6 p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-xl flex items-start gap-3 animate-in fade-in slide-in-from-bottom-4 duration-500">
          <div className="bg-emerald-500/20 p-2 rounded-full mt-0.5 shrink-0">
            <CheckCircle2 className="w-5 h-5 text-emerald-400" />
          </div>
          <div>
            <h4 className="text-emerald-400 font-semibold mb-1">Escrow Fully Confirmed!</h4>
            <p className="text-emerald-400/80 text-sm">
              All parties have securely signed the agreement. The StarkNet smart contract is now processing the release of funds.
            </p>
          </div>
        </div>
      )}

      {/* Confirmation Modal */}
      {currentUser && (
        <ConfirmDialog
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          onConfirm={handleConfirmMilestone}
          role={currentUser.role}
        />
      )}
    </div>
    </div>
    
  );
}