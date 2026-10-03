"use client"; // Next.js directive: this component runs on the client (uses click handlers)
import React from "react";
import { ChevronLeft, ChevronRight } from "lucide-react"; // Arrow icons for previous/next buttons

/**
 * Props for Pagination.
 */
interface PaginationProps {
  /** The page currently being viewed (1-based) */
  currentPage: number;
  /** Total number of pages available */
  totalPages: number;
  /** Called with the new page number when the user picks a page */
  onPageChange: (page: number) => void;
}

/**
 * Pagination
 * Renders previous/next buttons and a sliding window of up to 5 page numbers.
 * The component is controlled: the parent owns `currentPage` and updates it
 * in response to `onPageChange`.
 */
export default function Pagination({
  currentPage,
  totalPages,
  onPageChange,
}: PaginationProps) {
  // Nothing to paginate when there is only one page (or none)
  if (totalPages <= 1) return null;

  // Show at most 5 page buttons (fewer if there are fewer than 5 pages)
  const windowSize = Math.min(5, totalPages);
  // First page number in the window: try to center the current page
  // (two pages before it), but clamp so the window never starts below 1
  // or runs past the last page.
  const start = Math.max(1, Math.min(currentPage - 2, totalPages - windowSize + 1));
  // Build the list of visible page numbers, e.g. [3, 4, 5, 6, 7]
  const pages = Array.from({ length: windowSize }, (_, i) => start + i);

  return (
    // <nav> with an aria-label marks this as a pagination landmark for screen readers
    <nav className="mt-4 flex items-center justify-center gap-1" aria-label="Pagination">
      {/* Previous button: disabled on the first page */}
      <button
        onClick={() => onPageChange(currentPage - 1)}
        disabled={currentPage === 1}
        className="rounded p-2 hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-40"
        aria-label="Previous page"
      >
        <ChevronLeft className="h-4 w-4" />
      </button>

      {/* Numbered page buttons */}
      {pages.map((page) => (
        <button
          key={page}
          onClick={() => onPageChange(page)}
          // aria-current tells assistive tech which page is active
          aria-current={currentPage === page ? "page" : undefined}
          // Active page is highlighted in blue; others get a hover background
          className={`h-8 w-8 rounded text-sm font-medium transition-colors ${
            currentPage === page
              ? "bg-blue-600 text-white"
              : "text-gray-700 hover:bg-gray-100"
          }`}
        >
          {page}
        </button>
      ))}

      {/* Next button: disabled on the last page */}
      <button
        onClick={() => onPageChange(currentPage + 1)}
        disabled={currentPage === totalPages}
        className="rounded p-2 hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-40"
        aria-label="Next page"
      >
        <ChevronRight className="h-4 w-4" />
      </button>
    </nav>
  );
}