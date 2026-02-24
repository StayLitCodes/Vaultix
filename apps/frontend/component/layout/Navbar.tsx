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
                <div className="absolute inset-1 bg-black rounded-lg transform  flex items-center justify-center">
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
              href="#features"
              className="text-gray-300 hover:text-white transition-colors"
            >
              Features
            </Link>
            <Link
              href="#how-it-works"
              className="text-gray-300 hover:text-white transition-colors"
            >
              How It Works
            </Link>
            <Link
              href="#dao"
              className="text-gray-300 hover:text-white transition-colors"
            >
              DAO
            </Link>
            <Link
              href="#docs"
              className="text-gray-300 hover:text-white transition-colors"
            >
              Docs
            </Link>
            <Link
              href="/launch-app"
              className="bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white px-5 py-2 rounded-full font-medium transition-all duration-200 ease-in-out transform hover:scale-105"
            >
              Launch App
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
              href="#features"
              onClick={() => setIsMenuOpen(false)}
              className="block text-gray-300 hover:text-white transition-colors"
            >
              Features
            </Link>
            <Link
              href="#how-it-works"
              onClick={() => setIsMenuOpen(false)}
              className="block text-gray-300 hover:text-white transition-colors"
            >
              How It Works
            </Link>
            <Link
              href="#dao"
              onClick={() => setIsMenuOpen(false)}
              className="block text-gray-300 hover:text-white transition-colors"
            >
              DAO
            </Link>
            <Link
              href="#docs"
              onClick={() => setIsMenuOpen(false)}
              className="block text-gray-300 hover:text-white transition-colors"
            >
              Docs
            </Link>
            <Link
              href="/launch-app"
              onClick={() => setIsMenuOpen(false)}
              className="block w-full text-center bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white px-5 py-2 rounded-full font-medium"
            >
              Launch App
            </Link>
          </div>
        </div>
      )}
    </nav>
  );
}
