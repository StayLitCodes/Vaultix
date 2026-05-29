"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useRouter, usePathname, useSearchParams } from "next/navigation";
import { useEscrow } from "@/hooks/useEscrow";
import { useWalletConnection } from "@/app/hooks/useWallet";
import { acceptPartyInvitation, rejectPartyInvitation } from "@/lib/escrow-api";

export default function InvitePage() {
  const params = useParams();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const escrowId = params?.escrowId as string | undefined;
  const partyId = params?.partyId as string | undefined;
  const { escrow, error, loading, refetch } = useEscrow(escrowId || "");
  const { isConnected } = useWalletConnection();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const redirectPath = useMemo(() => {
    const query = searchParams.toString();
    return `${pathname}${query ? `?${query}` : ""}`;
  }, [pathname, searchParams]);

  useEffect(() => {
    if (!isConnected && escrowId && partyId) {
      router.replace(`/login?redirect=${encodeURIComponent(redirectPath)}`);
    }
  }, [isConnected, escrowId, partyId, redirectPath, router]);

  const invitation = escrow?.parties?.find((party) => party.id === partyId);
  const isPending = invitation?.status?.toUpperCase() === "PENDING";

  const handleAction = async (type: "accept" | "reject") => {
    if (!escrowId || !partyId) return;

    setIsSubmitting(true);
    setActionError(null);
    setMessage(null);

    try {
      if (type === "accept") {
        await acceptPartyInvitation(escrowId, partyId);
        setMessage("Invitation accepted successfully.");
      } else {
        await rejectPartyInvitation(escrowId, partyId);
        setMessage("Invitation rejected successfully.");
      }

      await refetch();
    } catch (err) {
      setActionError(
        err instanceof Error
          ? err.message
          : "Unable to complete the invitation action. Please try again.",
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!escrowId || !partyId) {
    return (
      <div className="min-h-screen bg-background text-foreground flex items-center justify-center p-4">
        <div className="bg-card text-card-foreground p-6 sm:p-8 rounded-xl shadow-sm border border-border max-w-md w-full text-center">
          <h2 className="text-xl font-bold text-foreground mb-3">Invalid Invitation Link</h2>
          <p className="text-muted-foreground text-sm mb-4">
            This invitation link is missing required information.
          </p>
          <Link
            href="/"
            className="inline-flex items-center px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium transition-colors"
          >
            Back to Home
          </Link>
        </div>
      </div>
    );
  }

  if (!isConnected) {
    return (
      <div className="min-h-screen bg-background text-foreground flex items-center justify-center p-4">
        <div className="bg-card text-card-foreground p-6 rounded-xl shadow-sm border border-border max-w-md w-full text-center">
          <h2 className="text-xl font-bold text-foreground mb-3">Secure Invitation</h2>
          <p className="text-muted-foreground text-sm mb-4">
            Redirecting to connect your wallet before loading the invitation.
          </p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-background text-foreground flex items-center justify-center p-4">
        <div className="bg-card text-card-foreground p-6 rounded-xl shadow-sm border border-border max-w-md w-full text-center">
          <h2 className="text-xl font-bold text-foreground mb-3">Loading Invitation</h2>
          <p className="text-muted-foreground text-sm">Please wait while we verify the escrow invitation.</p>
        </div>
      </div>
    );
  }

  if (error || !escrow) {
    return (
      <div className="min-h-screen bg-background text-foreground flex items-center justify-center p-4">
        <div className="bg-card text-card-foreground p-6 sm:p-8 rounded-xl shadow-sm border border-border max-w-md w-full text-center">
          <h2 className="text-xl font-bold text-destructive mb-3">Invitation Not Available</h2>
          <p className="text-muted-foreground text-sm mb-4">
            {error ?? "The invitation could not be found or the escrow does not exist."}
          </p>
          <Link
            href="/"
            className="inline-flex items-center px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium transition-colors"
          >
            Back to Home
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground py-8 px-4 sm:px-6">
      <div className="max-w-4xl mx-auto">
        <div className="bg-card text-card-foreground rounded-3xl border border-border shadow-xl p-8">
          <div className="mb-8">
            <p className="text-sm uppercase tracking-[0.3em] text-cyan-400 mb-2">Escrow Invitation</p>
            <h1 className="text-3xl sm:text-4xl font-bold text-foreground">
              Review your invitation
            </h1>
            <p className="mt-3 text-sm sm:text-base text-muted-foreground">
              You have been invited to join an escrow agreement. Accept or reject the invitation below to continue.
            </p>
          </div>

          <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
            <div className="space-y-4">
              <div className="rounded-3xl border border-border bg-background/80 p-6">
                <h2 className="text-lg font-semibold text-foreground mb-3">Escrow details</h2>
                <dl className="space-y-2 text-sm text-muted-foreground">
                  <div>
                    <dt className="font-medium text-foreground">Title</dt>
                    <dd>{escrow.title || escrow.id}</dd>
                  </div>
                  <div>
                    <dt className="font-medium text-foreground">Status</dt>
                    <dd>{escrow.status}</dd>
                  </div>
                  <div>
                    <dt className="font-medium text-foreground">Role</dt>
                    <dd>{invitation?.role?.toLowerCase() ?? "Unknown"}</dd>
                  </div>
                </dl>
              </div>

              {actionError && (
                <div className="rounded-3xl border border-red-500/20 bg-red-500/10 p-4 text-sm text-red-300">
                  {actionError}
                </div>
              )}

              {message && (
                <div className="rounded-3xl border border-green-500/20 bg-green-500/10 p-4 text-sm text-green-200">
                  {message}
                </div>
              )}

              <div className="rounded-3xl border border-border bg-background/80 p-6 space-y-4">
                {isPending ? (
                  <>
                    <p className="text-sm text-muted-foreground">
                      Accepting this invitation will register your participation for the escrow and allow you to proceed with the transaction.
                    </p>
                    <div className="flex flex-col gap-3 sm:flex-row">
                      <button
                        type="button"
                        onClick={() => handleAction("accept")}
                        disabled={isSubmitting}
                        className="inline-flex items-center justify-center rounded-full bg-emerald-500 px-5 py-3 text-sm font-semibold text-white hover:bg-emerald-400 transition-colors disabled:opacity-60"
                      >
                        Accept Invitation
                      </button>
                      <button
                        type="button"
                        onClick={() => handleAction("reject")}
                        disabled={isSubmitting}
                        className="inline-flex items-center justify-center rounded-full border border-border bg-transparent px-5 py-3 text-sm font-semibold text-foreground hover:bg-white/5 transition-colors disabled:opacity-60"
                      >
                        Reject Invitation
                      </button>
                    </div>
                  </>
                ) : (
                  <div className="space-y-3">
                    <p className="text-sm text-muted-foreground">
                      This invitation is no longer pending. You can still view the escrow details from the button below.
                    </p>
                    <Link
                      href={`/escrow/${escrow.id}`}
                      className="inline-flex items-center justify-center rounded-full bg-blue-600 px-5 py-3 text-sm font-semibold text-white hover:bg-blue-700 transition-colors"
                    >
                      View Escrow Details
                    </Link>
                  </div>
                )}
              </div>
            </div>

            <div className="rounded-3xl border border-border bg-background/80 p-6 space-y-5">
              <div>
                <p className="text-sm uppercase tracking-[0.2em] text-muted-foreground mb-2">Invitation summary</p>
                <div className="rounded-2xl bg-slate-950/80 p-4">
                  <p className="text-sm text-white">Escrow ID: <span className="font-medium text-foreground">{escrow.id}</span></p>
                  <p className="text-sm text-white mt-2">Party ID: <span className="font-medium text-foreground">{partyId}</span></p>
                  <p className="text-sm text-white mt-2">Expected role: <span className="font-medium text-foreground">{invitation?.role?.toLowerCase() ?? "unknown"}</span></p>
                </div>
              </div>
              <Link
                href="/"
                className="inline-flex items-center justify-center rounded-full border border-border px-4 py-3 text-sm font-semibold text-muted-foreground hover:bg-white/5 transition-colors"
              >
                Back to Home
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
