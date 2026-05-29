"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ConnectWalletModal } from "@/components/wallet/ConnectWalletModal";
import { useWalletConnection } from "@/app/hooks/useWallet";

export default function LoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectTo = searchParams.get("redirect") || "/dashboard";
  const { isConnected } = useWalletConnection();
  const [isModalOpen, setIsModalOpen] = useState(false);

  useEffect(() => {
    if (isConnected) {
      router.replace(redirectTo);
    }
  }, [isConnected, redirectTo, router]);

  useEffect(() => {
    setIsModalOpen(true);
  }, []);

  return (
    <div className="min-h-screen bg-background text-foreground flex items-center justify-center p-4">
      <div className="max-w-xl w-full bg-card text-card-foreground rounded-3xl border border-border shadow-2xl p-8">
        <div className="text-center">
          <p className="text-sm uppercase tracking-[0.3em] text-cyan-400 mb-4">Vaultix</p>
          <h1 className="text-3xl sm:text-4xl font-bold text-foreground mb-3">
            Connect your wallet
          </h1>
          <p className="text-sm sm:text-base text-muted-foreground">
            Sign in with your wallet to continue. After connecting, you will be redirected back to your original link.
          </p>
        </div>

        <div className="mt-8 flex flex-col items-center gap-4">
          <button
            type="button"
            onClick={() => setIsModalOpen(true)}
            className="inline-flex items-center justify-center rounded-full bg-blue-600 px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-blue-500/20 hover:bg-blue-700 transition-colors"
          >
            Connect Wallet
          </button>
          <p className="text-sm text-muted-foreground text-center">
            If you already have a wallet connected, you will be redirected automatically.
          </p>
          <Link
            href="/"
            className="text-sm font-medium text-blue-400 hover:text-blue-300"
          >
            Back to home
          </Link>
        </div>
      </div>

      <ConnectWalletModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} />
    </div>
  );
}
