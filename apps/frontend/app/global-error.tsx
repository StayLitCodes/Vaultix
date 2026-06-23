'use client';

import { useEffect } from 'react';
import { AlertTriangle, RefreshCw, ExternalLink } from 'lucide-react';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <html lang="en">
      <body className="min-h-screen bg-gray-950 text-white flex items-center justify-center p-8">
        <div className="text-center max-w-md">
          <AlertTriangle className="w-12 h-12 text-amber-400 mx-auto mb-4" />
          <h1 className="text-2xl font-bold">Critical Error</h1>
          <p className="text-gray-400 mt-2 text-sm">
            {error.message || 'A critical error occurred. Please try again.'}
          </p>
          {error.digest && (
            <code className="mt-3 inline-block bg-gray-800 text-gray-400 text-xs rounded px-2 py-1 font-mono">
              Error ID: {error.digest}
            </code>
          )}
          <div className="mt-6 flex gap-3 justify-center">
            <button
              onClick={reset}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-white text-gray-900 rounded-md text-sm font-medium hover:bg-gray-100 transition-colors"
            >
              <RefreshCw className="w-4 h-4" />
              Try again
            </button>
            <a
              href="/"
              className="px-4 py-2 border border-gray-700 text-gray-300 rounded-md text-sm font-medium hover:bg-gray-800 transition-colors"
            >
              Go home
            </a>
            <a
              href="https://github.com/zhero-o/Vaultix/issues/new"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 px-4 py-2 border border-gray-700 text-gray-300 rounded-md text-sm font-medium hover:bg-gray-800 transition-colors"
            >
              <ExternalLink className="w-4 h-4" />
              Report issue
            </a>
          </div>
        </div>
      </body>
    </html>
  );
}
