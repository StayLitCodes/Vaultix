'use client';

import { AlertTriangle, RefreshCw, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface ErrorFallbackProps {
  error: Error & { digest?: string };
  reset: () => void;
  title?: string;
}

export function ErrorFallback({ error, reset, title = 'Something went wrong' }: ErrorFallbackProps) {
  return (
    <div className="min-h-[400px] flex flex-col items-center justify-center p-8 text-center">
      <AlertTriangle className="w-12 h-12 text-amber-500 dark:text-amber-400 mb-4" />
      <h2 className="text-xl font-semibold text-foreground">{title}</h2>
      <p className="text-sm text-muted-foreground mt-2 max-w-md line-clamp-3">
        {error.message || 'An unexpected error occurred.'}
      </p>
      {error.digest && (
        <code className="mt-3 inline-block bg-muted text-muted-foreground text-xs rounded px-2 py-1 font-mono">
          Error ID: {error.digest}
        </code>
      )}
      <div className="mt-6 flex gap-3 flex-wrap justify-center">
        <Button size="sm" onClick={reset}>
          <RefreshCw className="mr-1.5 h-4 w-4" />
          Try again
        </Button>
        <Button size="sm" variant="outline" asChild>
          <a
            href="https://github.com/zhero-o/Vaultix/issues/new"
            target="_blank"
            rel="noopener noreferrer"
          >
            <ExternalLink className="mr-1.5 h-4 w-4" />
            Report issue
          </a>
        </Button>
      </div>
    </div>
  );
}
