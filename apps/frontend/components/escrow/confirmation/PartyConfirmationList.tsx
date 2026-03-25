'use client'
import { Briefcase, CheckCircle2, Clock, Shield, User, Wallet } from "lucide-react";
import { EscrowParty, Role, truncateAddress } from "./ConfirmationSection";

interface PartyListProps {
  parties: EscrowParty[];
  currentUserAddress: string;
}

const PartyConfirmationList: React.FC<PartyListProps> = ({ parties, currentUserAddress }) => {
  const getRoleIcon = (role: Role) => {
    switch (role) {
      case "Buyer": return <Wallet className="w-4 h-4" />;
      case "Seller": return <Briefcase className="w-4 h-4" />;
      case "Arbiter": return <Shield className="w-4 h-4" />;
      default: return <User className="w-4 h-4" />;
    }
  };

  const getRoleColor = (role: Role) => {
    switch (role) {
      case "Buyer": return "bg-blue-500/10 text-blue-400 border-blue-500/20";
      case "Seller": return "bg-purple-500/10 text-purple-400 border-purple-500/20";
      case "Arbiter": return "bg-amber-500/10 text-amber-400 border-amber-500/20";
      default: return "bg-gray-500/10 text-gray-400 border-gray-500/20";
    }
  };

  return (
    <div className="space-y-3">
      <h3 className="text-lg font-semibold text-white mb-4">Required Signatures</h3>
      {parties.map((party) => {
        const isCurrentUser = party.address === currentUserAddress;

        return (
          <div
            key={party.id}
            className={`flex items-center justify-between p-4 rounded-xl border transition-colors ${
              party.hasConfirmed
                ? "bg-gray-800/50 border-gray-700/50"
                : "bg-gray-800 border-gray-700"
            } ${isCurrentUser ? "ring-1 ring-gray-600" : ""}`}
          >
            <div className="flex items-center gap-4">
              {/* Status Icon */}
              <div className="relative">
                {party.hasConfirmed ? (
                  <div className="w-10 h-10 rounded-full bg-emerald-500/10 flex items-center justify-center">
                    <CheckCircle2 className="w-6 h-6 text-emerald-500" />
                  </div>
                ) : (
                  <div className="w-10 h-10 rounded-full bg-gray-700 flex items-center justify-center">
                    <Clock className="w-5 h-5 text-gray-400" />
                  </div>
                )}
                {/* Ping animation if waiting on this specific user */}
                {!party.hasConfirmed && isCurrentUser && (
                  <span className="absolute top-0 right-0 flex h-3 w-3">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-purple-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-3 w-3 bg-purple-500"></span>
                  </span>
                )}
              </div>

              {/* User Info */}
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-mono text-gray-200 font-medium">
                    {isCurrentUser ? "You" : truncateAddress(party.address)}
                  </span>
                  <span
                    className={`text-xs px-2 py-0.5 rounded-md border flex items-center gap-1 ${getRoleColor(
                      party.role
                    )}`}
                  >
                    {getRoleIcon(party.role)}
                    {party.role}
                  </span>
                </div>
                
                {party.message ? (
                  <p className="text-sm text-gray-400 italic">
                    &quot;{party.message}&quot;
                  </p>
                ) : (
                  <p className="text-sm text-gray-500">
                    {party.hasConfirmed ? "Confirmed" : "Awaiting signature..."}
                  </p>
                )}
              </div>
            </div>

            {/* Timestamp */}
            {party.hasConfirmed && party.confirmationDate && (
              <div className="hidden sm:block text-xs text-gray-500 text-right">
                {new Date(party.confirmationDate).toLocaleDateString()}
                <br />
                {new Date(party.confirmationDate).toLocaleTimeString([], {
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};

export default PartyConfirmationList;