import Link from "next/link";

export default function Home() {
  return (
    <div className="min-h-screen bg-black text-white overflow-x-hidden">
      {/* Hero section */}
      <section className="min-h-screen flex flex-col items-center justify-center px-4 sm:px-6 py-24 text-center">
        {/* Logo */}
        <div className="flex items-center gap-3 mb-8">
          <div className="h-14 w-14 sm:h-16 sm:w-16 relative flex-shrink-0">
            <div className="absolute inset-0 bg-gradient-to-r from-purple-600 to-blue-500 rounded-xl transform rotate-45" />
            <div className="absolute inset-1.5 bg-black rounded-lg flex items-center justify-center">
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-blue-400 font-bold text-xl sm:text-2xl">V</span>
            </div>
          </div>
          <h1 className="text-3xl sm:text-4xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-purple-600 via-blue-500 to-teal-400">
            Vaultix
          </h1>
        </div>

        <div className="max-w-2xl mx-auto">
          <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold text-white mb-4 leading-tight">
            Secure Decentralized<br className="sm:hidden" /> Escrow Platform
          </h2>
          <p className="text-base sm:text-lg text-gray-400 mb-8 leading-relaxed">
            Protect your transactions with smart escrow agreements powered by Stellar blockchain technology.
          </p>

          {/* CTA buttons — stacked on mobile, side by side on sm+ */}
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link
              href="/dashboard"
              className="min-h-[52px] flex items-center justify-center rounded-full bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white font-semibold text-base px-8 transition-all shadow-lg shadow-purple-500/25"
            >
              Access Dashboard
            </Link>
            <Link
              href="/escrow/create"
              className="min-h-[52px] flex items-center justify-center rounded-full border-2 border-gray-600 hover:border-gray-400 text-gray-300 hover:text-white font-semibold text-base px-8 transition-all"
            >
              Create Escrow
            </Link>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="px-4 sm:px-6 pb-24">
        <div className="max-w-4xl mx-auto grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-6">
          {[
            { emoji: "🔒", title: "Secure Transactions", desc: "Smart contracts ensure funds are only released when conditions are met" },
            { emoji: "⚡", title: "Fast Settlement", desc: "Blockchain-powered transactions settle in seconds, not days" },
            { emoji: "🌐", title: "Global Access", desc: "Access your escrow agreements from anywhere in the world" },
          ].map(({ emoji, title, desc }) => (
            <div key={title} className="bg-white/5 border border-white/10 p-5 sm:p-6 rounded-xl hover:bg-white/8 transition-colors">
              <div className="text-3xl mb-3">{emoji}</div>
              <h3 className="text-base sm:text-lg font-semibold text-white mb-2">{title}</h3>
              <p className="text-sm text-gray-400 leading-relaxed">{desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-white/5 py-6 px-4">
        <div className="max-w-4xl mx-auto flex flex-wrap items-center justify-center gap-4 sm:gap-6 text-sm text-gray-500">
          <Link href="/dashboard" className="min-h-[44px] flex items-center hover:text-gray-300 transition-colors">Dashboard</Link>
          <Link href="/escrow/create" className="min-h-[44px] flex items-center hover:text-gray-300 transition-colors">Create Escrow</Link>
          <Link href="https://github.com/Vaultix" target="_blank" className="min-h-[44px] flex items-center hover:text-gray-300 transition-colors">GitHub</Link>
        </div>
      </footer>
    </div>
  );
}
