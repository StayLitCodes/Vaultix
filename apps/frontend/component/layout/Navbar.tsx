"use client";

import { useState, useEffect, JSX } from "react";
import Link from "next/link";
import { Menu, X } from "lucide-react";

export default function Navbar(): JSX.Element {
  const [isMenuOpen, setIsMenuOpen] = useState<boolean>(false);
  const [scrolled, setScrolled] = useState<boolean>(false);

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 10);
    };
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <nav
      className={`fixed w-full z-50 transition-all duration-300 ${
        scrolled ? "bg-black/80 backdrop-blur-md py-2" : "bg-transparent py-4"
      }`}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center">
          <div className="flex items-center">
            <Link href="/" className="flex items-center">
              <div className="h-10 w-10 relative">
                <div className="absolute inset-0 bg-gradient-to-r from-purple-600 to-blue-500 rounded-lg transform rotate-45"></div>
                <div className="absolute inset-1 bg-black rounded-lg transform flex items-center justify-center">
                  <span className="text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-blue-400 font-bold">
                    V
                  </span>
                </div>
              </div>
              <span className="ml-2 text-xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-purple-400 via-blue-400 to-teal-400">
                Vaultix
              </span>
            </Link>
          </div>

          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center space-x-8">
            <Link
              href="/"
              className="text-gray-300 hover:text-white transition-colors"
            >
              Home
            </Link>
            <Link
              href="/dashboard"
              className="text-gray-300 hover:text-white transition-colors"
            >
              Dashboard
            </Link>
            <Link
              href="/escrow/create"
              className="text-gray-300 hover:text-white transition-colors"
            >
              Create Escrow
            </Link>
            <Link
              href="https://github.com/Vaultix"
              target="_blank"
              className="text-gray-300 hover:text-white transition-colors"
            >
              GitHub
            </Link>
          </div>

          {/* Mobile Navigation Toggle */}
          <div className="md:hidden flex items-center">
            <button
              onClick={() => setIsMenuOpen(!isMenuOpen)}
              className="text-gray-300 hover:text-white focus:outline-none"
              aria-label="Toggle Menu"
            >
              {isMenuOpen ? <X size={24} /> : <Menu size={24} />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Navigation Menu */}
      {isMenuOpen && (
        <div className="md:hidden">
          <div className="bg-black/95 backdrop-blur-lg px-4 pt-2 pb-4 space-y-4 h-[100vh]">
            <Link
              href="/"
              onClick={() => setIsMenuOpen(false)}
              className="block text-gray-300 hover:text-white transition-colors"
            >
              Home
            </Link>
            <Link
              href="/dashboard"
              onClick={() => setIsMenuOpen(false)}
              className="block text-gray-300 hover:text-white transition-colors"
            >
              Dashboard
            </Link>
            <Link
              href="/escrow/create"
              onClick={() => setIsMenuOpen(false)}
              className="block text-gray-300 hover:text-white transition-colors"
            >
              Create Escrow
            </Link>
            <Link
              href="https://github.com/Vaultix"
              target="_blank"
              onClick={() => setIsMenuOpen(false)}
              className="block text-gray-300 hover:text-white transition-colors"
            >
              GitHub
            </Link>
          </div>
        </div>
      )}
    </nav>
  );
}