"use client";
import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV_LINKS = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/escrow/create", label: "New Escrow" },
  { href: "/transactions", label: "History" },
  { href: "/settings", label: "Settings" },
];

export default function MobileNav() {
  const pathname = usePathname();
  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-50 border-t border-gray-200 bg-white sm:hidden"
      role="navigation"
      aria-label="Mobile navigation"
    >
      <ul className="flex">
        {NAV_LINKS.map(({ href, label }) => {
          const active = pathname?.startsWith(href) ?? false;
          return (
            <li key={href} className="flex-1">
              <Link
                href={href}
                className={`flex flex-col items-center py-3 text-xs font-medium transition-colors ${
                  active ? "text-blue-600" : "text-gray-500 hover:text-gray-700"
                }`}
                aria-current={active ? "page" : undefined}
              >
                {label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
