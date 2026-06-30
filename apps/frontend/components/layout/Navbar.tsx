"use client";

import { useState, useEffect, JSX } from "react";
import Link from "next/link";
import { Menu, X, Sun, Moon, Monitor, ChevronDown } from "lucide-react";
import NotificationBell from "@/components/common/NotificationBell";
import { useTheme } from "@/components/ThemeProvider";

const NAV_LINKS = [
  { href: "/", label: "Home" },
  { href: "/dashboard", label: "Dashboard" },
  { href: "/transactions", label: "Transactions" },
  { href: "/escrow/create", label: "Create Escrow" },
  { href: "https://github.com/Vaultix", label: "GitHub", external: true },
];

export default function Navbar(): JSX.Element {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isThemeMenuOpen, setIsThemeMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const { theme, setTheme, resolvedTheme } = useTheme();

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 10);
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  // Close menu on resize to desktop
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth >= 768) setIsMenuOpen(false);
    };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  // Close theme menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      if (!target.closest('[data-theme-menu]')) {
        setIsThemeMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <>
      <nav
        className={`fixed w-full z-50 transition-all duration-300 ${
          scrolled || isMenuOpen
            ? "bg-white/90 dark:bg-black/90 backdrop-blur-md py-2"
            : "bg-transparent py-4"
        }`}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center">
            {/* Logo */}
            <Link href="/" className="flex items-center gap-2 min-h-[44px]">
              <div className="h-9 w-9 relative flex-shrink-0">
                <div className="absolute inset-0 bg-gradient-to-r from-purple-600 to-blue-500 rounded-lg transform rotate-45" />
                <div className="absolute inset-1 bg-white dark:bg-black rounded-lg flex items-center justify-center">
                  <span className="text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-blue-400 font-bold text-sm">
                    V
                  </span>
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
                  className="min-h-[44px] flex items-center text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white transition-colors text-sm font-medium"
                >
                  {label}
                </Link>
              ))}
              <div data-theme-menu className="relative">
                <button
                  onClick={() => setIsThemeMenuOpen(!isThemeMenuOpen)}
                  className="p-2 text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white rounded-lg focus:outline-none transition-colors cursor-pointer flex items-center gap-2"
                  aria-label="Theme Menu"
                >
                  {resolvedTheme === "dark" ? <Sun size={20} /> : <Moon size={20} />}
                  <ChevronDown size={16} />
                </button>
                {isThemeMenuOpen && (
                  <div className="absolute right-0 top-full mt-2 w-48 bg-white dark:bg-gray-900 rounded-lg shadow-xl border border-gray-200 dark:border-gray-800 overflow-hidden">
                    <button
                      onClick={() => {
                        setTheme("light");
                        setIsThemeMenuOpen(false);
                      }}
                      className={`w-full px-4 py-3 text-left flex items-center gap-3 text-sm transition-colors ${theme === "light" ? "bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-white" : "text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800/50"}`}
                    >
                      <Sun size={18} />
                      <span>Light</span>
                    </button>
                    <button
                      onClick={() => {
                        setTheme("dark");
                        setIsThemeMenuOpen(false);
                      }}
                      className={`w-full px-4 py-3 text-left flex items-center gap-3 text-sm transition-colors ${theme === "dark" ? "bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-white" : "text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800/50"}`}
                    >
                      <Moon size={18} />
                      <span>Dark</span>
                    </button>
                    <button
                      onClick={() => {
                        setTheme("system");
                        setIsThemeMenuOpen(false);
                      }}
                      className={`w-full px-4 py-3 text-left flex items-center gap-3 text-sm transition-colors ${theme === "system" ? "bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-white" : "text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800/50"}`}
                    >
                      <Monitor size={18} />
                      <span>System</span>
                    </button>
                  </div>
                )}
              </div>
              <NotificationBell />
            </div>

            {/* Mobile controls */}
            <div className="md:hidden flex items-center gap-2">
              <div data-theme-menu className="relative">
                <button
                  onClick={() => setIsThemeMenuOpen(!isThemeMenuOpen)}
                  className="p-2 text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white rounded-lg focus:outline-none transition-colors cursor-pointer"
                  aria-label="Theme Menu"
                >
                  {resolvedTheme === "dark" ? <Sun size={20} /> : <Moon size={20} />}
                </button>
                {isThemeMenuOpen && (
                  <div className="absolute right-0 top-full mt-2 w-48 bg-white dark:bg-gray-900 rounded-lg shadow-xl border border-gray-200 dark:border-gray-800 overflow-hidden z-50">
                    <button
                      onClick={() => {
                        setTheme("light");
                        setIsThemeMenuOpen(false);
                      }}
                      className={`w-full px-4 py-3 text-left flex items-center gap-3 text-sm transition-colors ${theme === "light" ? "bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-white" : "text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800/50"}`}
                    >
                      <Sun size={18} />
                      <span>Light</span>
                    </button>
                    <button
                      onClick={() => {
                        setTheme("dark");
                        setIsThemeMenuOpen(false);
                      }}
                      className={`w-full px-4 py-3 text-left flex items-center gap-3 text-sm transition-colors ${theme === "dark" ? "bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-white" : "text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800/50"}`}
                    >
                      <Moon size={18} />
                      <span>Dark</span>
                    </button>
                    <button
                      onClick={() => {
                        setTheme("system");
                        setIsThemeMenuOpen(false);
                      }}
                      className={`w-full px-4 py-3 text-left flex items-center gap-3 text-sm transition-colors ${theme === "system" ? "bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-white" : "text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800/50"}`}
                    >
                      <Monitor size={18} />
                      <span>System</span>
                    </button>
                  </div>
                )}
              </div>
              <NotificationBell />
              <button
                onClick={() => setIsMenuOpen((v) => !v)}
                className="min-w-[44px] min-h-[44px] flex items-center justify-center text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white focus:outline-none rounded-lg"
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
          <div
            className="absolute inset-0 bg-black/50"
            onClick={() => setIsMenuOpen(false)}
          />
          <div className="absolute top-0 right-0 h-full w-72 bg-white dark:bg-gray-900 backdrop-blur-xl flex flex-col pt-20 pb-8 px-6 shadow-2xl">
            <nav className="flex flex-col gap-1">
              {NAV_LINKS.map(({ href, label, external }) => (
                <Link
                  key={href}
                  href={href}
                  target={external ? "_blank" : undefined}
                  onClick={() => setIsMenuOpen(false)}
                  className="min-h-[48px] flex items-center text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-800/50 rounded-lg px-3 transition-colors text-base font-medium"
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
