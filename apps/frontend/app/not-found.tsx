import Link from "next/link";

export default function NotFound() {
  return (
    <div className="min-h-screen bg-background text-foreground flex items-center justify-center p-4">
      <div className="bg-card text-card-foreground p-8 rounded-3xl shadow-2xl border border-border max-w-xl w-full text-center">
        <p className="text-sm uppercase tracking-[0.3em] text-cyan-400 mb-4">Page not found</p>
        <h1 className="text-3xl sm:text-4xl font-bold text-foreground mb-4">
          The link you followed is not valid.
        </h1>
        <p className="text-sm sm:text-base text-muted-foreground mb-8">
          If you clicked a deep link, the content may no longer exist. Please try again or return to the dashboard.
        </p>
        <div className="flex flex-col sm:flex-row justify-center gap-3">
          <Link
            href="/dashboard"
            className="inline-flex items-center justify-center rounded-full bg-blue-600 px-5 py-3 text-sm font-semibold text-white hover:bg-blue-700 transition-colors"
          >
            Go to Dashboard
          </Link>
          <Link
            href="/"
            className="inline-flex items-center justify-center rounded-full border border-border px-5 py-3 text-sm font-semibold text-foreground hover:bg-white/5 transition-colors"
          >
            Home
          </Link>
        </div>
      </div>
    </div>
  );
}
