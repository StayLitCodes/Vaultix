'use client';

import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';

jest.mock('@/lib/errorReporter', () => ({
  reportError: jest.fn(),
}));

jest.mock('next/navigation', () => ({
  useRouter: () => ({
    push: jest.fn(),
  }),
}));

import { reportError } from '@/lib/errorReporter';
import { ErrorBoundary } from './ErrorBoundary';

const ThrowingChild = ({ shouldThrow }: { shouldThrow: boolean }) => {
  if (shouldThrow) {
    throw new Error('Test render error');
  }
  return <div>Child content rendered</div>;
};

describe('ErrorBoundary', () => {
  let consoleErrorSpy: jest.SpyInstance;

  beforeEach(() => {
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    (reportError as jest.Mock).mockClear();
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
  });

  it('renders children normally when no error occurs', () => {
    render(
      <ErrorBoundary>
        <ThrowingChild shouldThrow={false} />
      </ErrorBoundary>,
    );

    expect(screen.getByText('Child content rendered')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /try again/i })).not.toBeInTheDocument();
  });

  it('renders the default ErrorFallback when a child throws', () => {
    render(
      <ErrorBoundary>
        <ThrowingChild shouldThrow={true} />
      </ErrorBoundary>,
    );

    expect(screen.getByRole('button', { name: /try again/i })).toBeInTheDocument();
    expect(screen.getByText(/try again/i)).toBeInTheDocument();
  });

  it('resets error state when clicking the Try again button and child no longer throws', () => {
    const ErrorToggle = () => {
      const [shouldThrow, setShouldThrow] = React.useState(true);
      return (
        <>
          <ErrorBoundary>
            <ThrowingChild shouldThrow={shouldThrow} />
          </ErrorBoundary>
          <button onClick={() => setShouldThrow(false)}>resolve</button>
        </>
      );
    };

    render(<ErrorToggle />);

    fireEvent.click(screen.getByText('resolve'));
    fireEvent.click(screen.getByRole('button', { name: /try again/i }));

    expect(screen.getByText('Child content rendered')).toBeInTheDocument();
  });

  it('uses a custom fallback function when provided', () => {
    const customFallback = jest.fn(({ error, reset }) => (
      <div>
        <p>Custom fallback: {error.message}</p>
        <button onClick={reset}>Custom retry</button>
      </div>
    ));

    render(
      <ErrorBoundary fallback={customFallback}>
        <ThrowingChild shouldThrow={true} />
      </ErrorBoundary>,
    );

    expect(customFallback).toHaveBeenCalled();
    expect(customFallback.mock.calls[0][0]).toHaveProperty('error');
    expect(customFallback.mock.calls[0][0]).toHaveProperty('reset');
    expect(screen.getByText(/custom fallback/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /custom retry/i })).toBeInTheDocument();
  });

  it('calls reportError with the error and componentStack when a child throws', () => {
    render(
      <ErrorBoundary>
        <ThrowingChild shouldThrow={true} />
      </ErrorBoundary>,
    );

    expect(reportError).toHaveBeenCalledTimes(1);
    expect(reportError).toHaveBeenCalledWith(
      expect.any(Error),
      expect.objectContaining({
        componentStack: expect.any(String),
      }),
    );
  });
});
