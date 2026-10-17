'use client';

import { fireEvent, render, screen } from '@testing-library/react';
import { OfflineBanner } from './OfflineBanner';

describe('OfflineBanner', () => {
  const originalOnLine = Object.getOwnPropertyDescriptor(navigator, 'onLine');

  beforeEach(() => {
    Object.defineProperty(navigator, 'onLine', { configurable: true, value: true });
  });

  afterEach(() => {
    if (originalOnLine) {
      Object.defineProperty(navigator, 'onLine', originalOnLine);
    } else {
      Reflect.deleteProperty(navigator, 'onLine');
    }
  });

  it('appears when the browser is already offline on mount', () => {
    Object.defineProperty(navigator, 'onLine', { configurable: true, value: false });

    render(<OfflineBanner />);

    expect(screen.getByRole('status')).toHaveTextContent(/you are offline/i);
  });

  it('appears when the browser goes offline and hides when it comes back online', () => {
    render(<OfflineBanner />);

    expect(screen.queryByRole('status')).not.toBeInTheDocument();
    fireEvent(window, new Event('offline'));
    expect(screen.getByRole('status')).toHaveTextContent(/you are offline/i);

    fireEvent(window, new Event('online'));
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });
});