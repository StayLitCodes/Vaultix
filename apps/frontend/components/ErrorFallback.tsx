'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { AlertTriangle, RefreshCw, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { classifyError } from '@/lib/errorUtils';

interface ErrorFallbackProps {
  error: Error & { digest?: string };
  reset: () => void;
  title?: string;
  compact?: boolean;
}

export function ErrorFallback({
  error,
  reset,
  title,
  compact = false,
}: ErrorFallbackProps) {
  const router = useRouter();
  const { kind, title: kindTitle, description } = classifyError(error);
  const header = title || kindTitle;
  const message = error.message || description;

  const primaryLabel = 'Try again';
  const secondaryLabel = kind === 'auth' ? 'Go Home' : 'Go to Dashboard';
  const containerClasses = compact
    ? 'p-6 text-center'
    : 'min-h-[400px] flex flex-col items-center justify-center p-8 text-center';
  const iconClasses = compact
    ? 'w-8 h-8'
    : 'w-12 h-12';

  return (
    <div className={containerClasses}>
      <AlertTriangle
        className={`${iconClasses} text-amber-500 dark:text-amber-400 mb-4`}
      />
      <h2 className="text-xl font-semibold text-foreground">{header}</h2>
      <p className="text-sm text-muted-foreground mt-2 max-w-md">
        {message}
      </p>
      {error.digest && (
        <code className="mt-3 inline-block bg-muted text-muted-foreground text-xs rounded px-2 py-1 font-mono">
          Error ID: {error.digest}
        </code>
      )}
      <div className="mt-6 flex gap-3 flex-wrap justify-center">
        <Button size="sm" onClick={reset}>
          <RefreshCw className="mr-1.5 h-4 w-4" />
          {primaryLabel}
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={() => router.push(kind === 'auth' ? '/' : '/dashboard')}
        >
          {secondaryLabel}
        </Button>
        <Button size="sm" variant="ghost" asChild>
          <a
            href="https://github.com/zhero-o/Vaultix/issues/new"
            target="_blank"
            rel="noopener noreferrer"
          >
            <ExternalLink className="mr-1.5 h-4 w-4" />
            Report issue
          </a>
        </Button>
        {kind !== 'auth' && (
          <Button size="sm" variant="secondary" asChild>
            <Link href="/">Go Home</Link>
          </Button>
        )}
      </div>
    </div>
  );
}
