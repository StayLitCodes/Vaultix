import { Suspense } from "react";
import { Metadata } from "next";
import EscrowDetailClient from "./EscrowDetailClient";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  return {
    title: `Escrow #${id} — Vaultix`,
    description: `View details and status for escrow #${id} on Vaultix. No sensitive amounts are shared in preview cards.`,
    alternates: {
      canonical: `/escrow/${id}`,
    },
    openGraph: {
      title: `Escrow #${id} — Vaultix`,
      description: `View details and status for escrow #${id} on Vaultix.`,
      images: ["/og-image.svg"],
    },
    twitter: {
      card: "summary_large_image",
      title: `Escrow #${id} — Vaultix`,
      description: `View details and status for escrow #${id} on Vaultix.`,
      images: ["/og-image.svg"],
      site: "@Vaultix",
      creator: "@Vaultix",
    },
    robots: {
      index: true,
      follow: true,
    },
  };
}

export default async function EscrowDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center bg-background text-foreground">Loading...</div>}>
      <EscrowDetailClient id={id} />
    </Suspense>
  );
}
