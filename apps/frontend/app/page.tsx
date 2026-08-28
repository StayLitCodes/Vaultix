import Link from "next/link";
import { ShieldCheck, Zap, Globe, Lock, ArrowRight, CheckCircle2 } from "lucide-react";

export default function Home() {
  return (
    <div className="min-h-screen bg-background text-foreground overflow-x-hidden flex flex-col">
      
      {/* 1. HERO SECTION */}
      <section className="min-h-[85vh] flex flex-col items-center justify-center px-4 sm:px-6 py-20 text-center relative">
        <div className="absolute inset-0 bg-gradient-to-b from-purple-500/5 via-transparent to-transparent pointer-events-none" />
        
        {/* Logo Branding Element */}
        <div className="flex items-center gap-3 mb-8 relative z-10">
          <div className="h-14 w-14 sm:h-16 sm:w-16 relative flex-shrink-0">
            <div className="absolute inset-0 bg-gradient-to-r from-purple-600 to-blue-500 rounded-xl transform rotate-45 shadow-lg shadow-purple-500/20" />
            <div className="absolute inset-1.5 bg-background rounded-lg flex items-center justify-center">
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-blue-400 font-bold text-xl sm:text-2xl">V</span>
            </div>
          </div>
          <h1 className="text-3xl sm:text-4xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-purple-600 via-blue-500 to-teal-400">
            Vaultix
          </h1>
        </div>

        <div className="max-w-3xl mx-auto relative z-10 space-y-6">
          <h2 className="text-3xl sm:text-5xl md:text-6xl font-extrabold text-foreground tracking-tight leading-tight">
            Secure Decentralized <br className="hidden sm:inline" />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-purple-600 to-blue-500">Escrow Platform</span>
          </h2>
          <p className="text-base sm:text-xl text-muted-foreground max-w-2xl mx-auto leading-relaxed">
            Protect your transactions with smart escrow agreements powered by Stellar blockchain technology and Soroban smart contracts.
          </p>

          {/* CTA Buttons Container */}
          <div className="flex flex-col sm:flex-row gap-3.5 justify-center pt-2">
            <Link
              href="/dashboard"
              className="min-h-[52px] flex items-center justify-center gap-2 rounded-full bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white font-semibold text-base px-8 transition-all shadow-lg shadow-purple-500/25"
            >
              Access Dashboard <ArrowRight size={18} />
            </Link>
            <Link
              href="/escrow/create"
              className="min-h-[52px] flex items-center justify-center rounded-full border-2 border-border hover:border-muted text-muted-foreground hover:text-foreground font-semibold text-base px-8 transition-all bg-card/50 backdrop-blur-sm"
            >
              Create Escrow
            </Link>
          </div>
        </div>
      </section>

      {/* 2. KEY FEATURES SECTION */}
      <section className="px-4 sm:px-6 py-20 border-t border-border bg-muted/20">
        <div className="max-w-5xl mx-auto space-y-12">
          <div className="text-center space-y-3">
            <span className="text-xs font-black tracking-widest uppercase text-purple-600 dark:text-purple-400 bg-purple-100 dark:bg-purple-950/60 px-3 py-1 rounded-full border border-purple-200 dark:border-purple-800">
              Platform Benefits
            </span>
            <h2 className="text-2xl sm:text-3xl font-bold tracking-tight">Engineered for Trust & Speed</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[
              { 
                icon: ShieldCheck, 
                title: "Secure Transactions", 
                desc: "Smart contracts ensure funds are safely locked and only released when verified conditions are met." 
              },
              { 
                icon: Zap, 
                title: "Fast Settlement", 
                desc: "Stellar-powered transactions deliver lightning-fast finality in seconds with minimal network fees." 
              },
              { 
                icon: Globe, 
                title: "Global Access", 
                desc: "Manage and monitor your decentralized escrow agreements securely from anywhere in the world." 
              },
            ].map(({ icon: Icon, title, desc }) => (
              <div key={title} className="bg-card border border-border p-6 rounded-2xl shadow-sm hover:border-purple-500/40 transition-all space-y-4">
                <div className="w-12 h-12 rounded-xl bg-purple-50 dark:bg-purple-950/50 border border-purple-200 dark:border-purple-900/50 text-purple-600 dark:text-purple-400 flex items-center justify-center">
                  <Icon size={24} />
                </div>
                <h3 className="text-lg font-bold text-foreground">{title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 3. HOW IT WORKS SECTION */}
      <section className="px-4 sm:px-6 py-24 border-t border-border">
        <div className="max-w-5xl mx-auto space-y-12">
          <div className="text-center space-y-3">
            <span className="text-xs font-black tracking-widest uppercase text-blue-600 dark:text-blue-400 bg-blue-100 dark:bg-blue-950/60 px-3 py-1 rounded-full border border-blue-200 dark:border-blue-800">
              Workflow Guide
            </span>
            <h2 className="text-2xl sm:text-3xl font-bold tracking-tight">How Vaultix Works</h2>
            <p className="text-muted-foreground">Three straightforward steps to execute trustless trades.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 relative">
            {[
              { step: "01", title: "Initialize Agreement", desc: "Deposit funds into the Soroban smart contract with agreed terms and milestone conditions." },
              { step: "02", title: "Fulfill Conditions", desc: "The counterparty delivers the service, digital asset, or cross-chain deliverable securely." },
              { step: "03", title: "Release Funds", desc: "Funds are automatically disbursed to the recipient upon mutual approval or verification." },
            ].map((s, idx) => (
              <div key={idx} className="bg-card border border-border p-6 rounded-2xl shadow-sm space-y-3 relative overflow-hidden">
                <span className="text-5xl font-black text-muted/30 absolute top-3 right-4 font-mono">{s.step}</span>
                <div className="pt-4">
                  <div className="flex items-center gap-2 text-purple-600 dark:text-purple-400 font-bold text-xs uppercase tracking-wider mb-1">
                    <CheckCircle2 size={14} /> Step {s.step}
                  </div>
                  <h3 className="font-bold text-lg text-foreground mb-2">{s.title}</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">{s.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="border-t border-border py-8 px-4 mt-auto bg-card/40">
        <div className="max-w-5xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-muted-foreground">
          <div className="flex items-center gap-2 font-bold text-foreground">
            <Lock size={16} className="text-purple-600 dark:text-purple-500" /> Vaultix Protocol
          </div>
          <div className="flex flex-wrap items-center justify-center gap-6">
            <Link href="/dashboard" className="hover:text-foreground transition-colors">Dashboard</Link>
            <Link href="/escrow/create" className="hover:text-foreground transition-colors">Create Escrow</Link>
            <Link href="https://github.com/Vaultix" target="_blank" className="hover:text-foreground transition-colors">GitHub Repository</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}