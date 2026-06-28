"use client";
import React from "react";

interface SkipLinkProps {
  targetId?: string;
  label?: string;
}

export default function SkipLink({
  targetId = "main-content",
  label = "Skip to main content",
}: SkipLinkProps) {
  return (
    <a
      href={`#${targetId}`}
      className={[
        "sr-only",
        "focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50",
        "focus:rounded focus:border focus:border-blue-600 focus:bg-white",
        "focus:px-4 focus:py-2 focus:text-blue-700 focus:shadow-lg focus:outline-none",
      ].join(" ")}
      aria-label={label}
    >
      {label}
    </a>
  );
}
