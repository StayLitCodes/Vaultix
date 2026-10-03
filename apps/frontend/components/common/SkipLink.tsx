"use client"; // Next.js directive: this component runs on the client
import React from "react";

/**
 * Props for SkipLink.
 */
interface SkipLinkProps {
  /** The id of the element to jump to (should match an element like <main id="main-content">) */
  targetId?: string;
  /** Text shown (and announced by screen readers) for the link */
  label?: string;
}

/**
 * SkipLink
 * An accessibility helper that lets keyboard and screen-reader users bypass
 * repeated navigation and jump straight to the main content.
 *
 * It is visually hidden until it receives keyboard focus (usually the first
 * Tab press on the page), at which point it appears in the top-left corner.
 *
 * Usage: render it as the first focusable element on the page and make sure
 * the target element exists, e.g. <main id="main-content">...</main>
 */
export default function SkipLink({
  targetId = "main-content",
  label = "Skip to main content",
}: SkipLinkProps) {
  return (
    <a
      // In-page anchor link that jumps to the element with the matching id
      href={`#${targetId}`}
      // Classes are grouped in an array and joined for readability
      className={[
        // Hidden visually by default, but still available to screen readers
        "sr-only",
        // On focus: undo the hiding and pin the link to the top-left, above other content
        "focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50",
        // On focus: give it a visible, button-like appearance (border, background, rounded corners)
        "focus:rounded focus:border focus:border-blue-600 focus:bg-white",
        // On focus: padding, text color and shadow; the default outline is removed
        // because the blue border already acts as the focus indicator
        "focus:px-4 focus:py-2 focus:text-blue-700 focus:shadow-lg focus:outline-none",
      ].join(" ")}
      // Explicit accessible name for assistive technologies
      aria-label={label}
    >
      {label}
    </a>
  );
}