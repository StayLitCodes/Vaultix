"use client";
import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from 'next-intl';

export default function MobileNav() {
  const pathname = usePathname();
  const t = useTranslations('mobileNavigation');
  const navLinks = [
    { href: "/dashboard", label: t('dashboard') },
    { href: "/escrow/create", label: t('createEscrow') },
    { href: "/transactions", label: t('history') },
    { href: "/settings", label: t('settings') },
  ];
  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-50 border-t border-gray-200 bg-white sm:hidden"
      role="navigation"
      aria-label={t('label')}
    >
      <ul className="flex">
        {navLinks.map(({ href, label }) => {
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
