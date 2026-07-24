import { getTranslations } from '@/lib/i18n';
import Link from 'next/link';

export default async function Home({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const t = await getTranslations(locale);

  return (
    <div className="min-h-screen bg-background text-foreground overflow-x-hidden">
      <section className="min-h-screen flex flex-col items-center justify-center px-4 sm:px-6 py-24 text-center">
        <div className="flex items-center gap-3 mb-8">
          <div className="h-14 w-14 sm:h-16 sm:w-16 relative flex-shrink-0">
            <div className="absolute inset-0 bg-gradient-to-r from-purple-600 to-blue-500 rounded-xl transform rotate-45" />
            <div className="absolute inset-1.5 bg-background rounded-lg flex items-center justify-center">
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-blue-400 font-bold text-xl sm:text-2xl">V</span>
            </div>
          </div>
          <h1 className="text-3xl sm:text-4xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-purple-600 via-blue-500 to-teal-400">
            Vaultix
          </h1>
        </div>

        <div className="max-w-2xl mx-auto">
          <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold text-foreground mb-4 leading-tight">
            {t.home.title}
          </h2>
          <p className="text-base sm:text-lg text-muted-foreground mb-8 leading-relaxed">
            {t.home.description}
          </p>

          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link
              href={`/${locale}/dashboard`}
              className="min-h-[52px] flex items-center justify-center rounded-full bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white font-semibold text-base px-8 transition-all shadow-lg shadow-purple-500/25"
            >
              {t.home.dashboardCta}
            </Link>
            <Link
              href={`/${locale}/escrow/create`}
              className="min-h-[52px] flex items-center justify-center rounded-full border-2 border-border hover:border-muted text-muted-foreground hover:text-foreground font-semibold text-base px-8 transition-all"
            >
              {t.home.createEscrowCta}
            </Link>
          </div>
        </div>
      </section>

      <section className="px-4 sm:px-6 pb-24">
        <div className="max-w-4xl mx-auto grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-6">
          {[
            { key: 'secure', emoji: '🔒' },
            { key: 'fast', emoji: '⚡' },
            { key: 'global', emoji: '🌐' },
          ].map(({ key, emoji }) => (
            <div key={key} className="bg-muted border border-border p-5 sm:p-6 rounded-xl hover:bg-muted/80 transition-colors">
              <div className="text-3xl mb-3">{emoji}</div>
              <h3 className="text-base sm:text-lg font-semibold text-foreground mb-2">{t.home.features[key as keyof typeof t.home.features].title}</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">{t.home.features[key as keyof typeof t.home.features].description}</p>
            </div>
          ))}
        </div>
      </section>

      <footer className="border-t border-border py-6 px-4">
        <div className="max-w-4xl mx-auto flex flex-wrap items-center justify-center gap-4 sm:gap-6 text-sm text-muted-foreground">
          <Link href={`/${locale}/dashboard`} className="min-h-[44px] flex items-center hover:text-foreground transition-colors">{t.nav.dashboard}</Link>
          <Link href={`/${locale}/escrow/create`} className="min-h-[44px] flex items-center hover:text-foreground transition-colors">{t.nav.createEscrow}</Link>
          <Link href="https://github.com/Vaultix" target="_blank" className="min-h-[44px] flex items-center hover:text-foreground transition-colors">{t.nav.github}</Link>
        </div>
      </footer>
    </div>
  );
}
