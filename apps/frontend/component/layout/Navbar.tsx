"use client";

import { useState, useEffect, JSX } from "react";
import Link from "next/link";
import { Menu, X } from "lucide-react";
import NotificationBell from "@/components/common/NotificationBell";

const NAV_LINKS = [
  { href: "/", label: "Home" },
  { href: "/dashboard", label: "Dashboard" },
  { href: "/escrow/create", label: "Create Escrow" },
  { href: "https://github.com/Vaultix", label: "GitHub", external: true },
];

export default function Navbar(): JSX.Element {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 10);
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  // Close menu on resize to desktop
  useEffect(() => {
    const handleResize = () => { if (window.innerWidth >= 768) setIsMenuOpen(false); };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  return (
    <>
      <nav
        className={`fixed w-full z-50 transition-all duration-300 ${
          scrolled || isMenuOpen ? "bg-black/90 backdrop-blur-md py-2" : "bg-transparent py-4"
        }`}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center">
            {/* Logo */}
            <Link href="/" className="flex items-center gap-2 min-h-[44px]">
              <div className="h-9 w-9 relative flex-shrink-0">
                <div className="absolute inset-0 bg-gradient-to-r from-purple-600 to-blue-500 rounded-lg transform rotate-45" />
                <div className="absolute inset-1 bg-black rounded-lg flex items-center justify-center">
                  <span className="text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-blue-400 font-bold text-sm">V</span>
                </div>
              </div>
              <span className="text-xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-purple-400 via-blue-400 to-teal-400">
                Vaultix
              </span>
            </Link>

            {/* Desktop nav */}
            <div className="hidden md:flex items-center gap-6">
              {NAV_LINKS.map(({ href, label, external }) => (
                <Link
                  key={href}
                  href={href}
                  target={external ? "_blank" : undefined}
                  className="min-h-[44px] flex items-center text-gray-300 hover:text-white transition-colors text-sm font-medium"
                >
                  {label}
                </Link>
              ))}
              <NotificationBell />
            </div>

            {/* Mobile controls */}
            <div className="md:hidden flex items-center gap-2">
              <NotificationBell />
              <button
                onClick={() => setIsMenuOpen((v) => !v)}
                className="min-w-[44px] min-h-[44px] flex items-center justify-center text-gray-300 hover:text-white focus:outline-none rounded-lg"
                aria-label={isMenuOpen ? "Close menu" : "Open menu"}
                aria-expanded={isMenuOpen}
              >
                {isMenuOpen ? <X size={22} /> : <Menu size={22} />}
              </button>
            </div>
          </div>
        </div>
      </nav>

      {/* Mobile drawer — rendered outside nav to avoid overflow clipping */}
      {isMenuOpen && (
        <div className="fixed inset-0 z-40 md:hidden">
          <div className="absolute inset-0 bg-black/50" onClick={() => setIsMenuOpen(false)} />
          <div className="absolute top-0 right-0 h-full w-72 bg-black/95 backdrop-blur-xl flex flex-col pt-20 pb-8 px-6 shadow-2xl">
            <nav className="flex flex-col gap-1">
              {NAV_LINKS.map(({ href, label, external }) => (
                <Link
                  key={href}
                  href={href}
                  target={external ? "_blank" : undefined}
                  onClick={() => setIsMenuOpen(false)}
                  className="min-h-[48px] flex items-center text-gray-300 hover:text-white hover:bg-white/5 rounded-lg px-3 transition-colors text-base font-medium"
                >
                  {label}
                </Link>
              ))}
            </nav>
          </div>
        </div>
      )}
    </>
  );
}
