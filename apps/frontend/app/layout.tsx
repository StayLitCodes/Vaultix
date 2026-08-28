import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import Providers from "@/components/Providers";
import Navbar from "@/components/layout/Navbar";
import MobileNav from "@/components/layout/MobileNav";
import { headers } from "next/headers";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Vaultix - Secure Escrow Platform",
  description: "Decentralized escrow platform built on Stellar blockchain",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
};

export default async function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  // Check headers to conditionally handle mobile nav on landing or public routes
  const headersList = await headers();
  const pathname = headersList.get("x-invoke-path") || "";
  const isLandingPage = pathname === "/" || pathname === "/landing";

  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                try {
                  var theme = localStorage.getItem('vaultix-theme');
                  var systemDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
                  var finalTheme = 'light';
                  if (theme === 'dark') {
                    finalTheme = 'dark';
                  } else if (theme === 'light') {
                    finalTheme = 'light';
                  } else {
                    finalTheme = systemDark ? 'dark' : 'light';
                  }
                  if (finalTheme === 'dark') {
                    document.documentElement.classList.add('dark');
                  } else {
                    document.documentElement.classList.remove('dark');
                  }
                } catch (e) {}
              })()
            `,
          }}
        />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased overflow-x-hidden`}
      >
        <Providers>
          <Navbar />
          <main className={`pt-16 min-w-0 overflow-x-hidden ${!isLandingPage ? 'pb-20 md:pb-0' : ''}`}>
            {children}
          </main>
          {!isLandingPage && <MobileNav />}
        </Providers>
      </body>
    </html>
  );
}