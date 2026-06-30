import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import EscrowTimeline from './EscrowTimeline';
import { useEscrowTimeline } from '@/hooks/useEscrowTimeline';
import { IEscrowEvent } from '@/types/escrow';

jest.mock('@/hooks/useEscrowTimeline');
jest.mock('framer-motion', () => ({
  motion: {
    li: ({ children, ...p }: React.PropsWithChildren<Record<string, unknown>>) => <li {...p}>{children}</li>,
  },
  AnimatePresence: ({ children }: React.PropsWithChildren) => <>{children}</>,
}));

const mockRefetch = jest.fn();

function setupHook(overrides: Partial<ReturnType<typeof useEscrowTimeline>> = {}) {
  (useEscrowTimeline as jest.Mock).mockReturnValue({
    events: [],
    loading: false,
    error: null,
    refetch: mockRefetch,
    ...overrides,
  });
}

const BASE_EVENT: IEscrowEvent = {
  id: 'evt-1',
  eventType: 'CREATED',
  actorId: 'GABC1234567890ABCDE',
  createdAt: new Date(Date.now() - 60_000).toISOString(),
};

const FUNDED_EVENT: IEscrowEvent = {
  id: 'evt-2',
  eventType: 'FUNDED',
  actorId: 'GABC1234567890ABCDE',
  data: { amount: '500', asset: 'XLM' },
  createdAt: new Date(Date.now() - 30_000).toISOString(),
};

const DISPUTED_EVENT: IEscrowEvent = {
  id: 'evt-3',
  eventType: 'DISPUTED',
  actorId: 'GSELLER1234567890AB',
  createdAt: new Date(Date.now() - 5_000).toISOString(),
};

describe('EscrowTimeline', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    Object.assign(navigator, {
      clipboard: { writeText: jest.fn().mockResolvedValue(undefined) },
    });
  });

  describe('loading state', () => {
    it('renders skeleton when loading with no initial events', () => {
      setupHook({ loading: true, events: [] });
      render(<EscrowTimeline escrowId="esc-1" />);
      expect(screen.getByRole('list', { name: 'Loading timeline' })).toBeInTheDocument();
    });

    it('shows spinner in header while loading', () => {
      setupHook({ loading: true, events: [] });
      render(<EscrowTimeline escrowId="esc-1" />);
      expect(screen.getByLabelText('Loading')).toBeInTheDocument();
    });

    it('does not show skeleton when loading but already has events', () => {
      setupHook({ loading: true, events: [BASE_EVENT] });
      render(<EscrowTimeline escrowId="esc-1" />);
      expect(screen.queryByRole('list', { name: 'Loading timeline' })).not.toBeInTheDocument();
    });
  });

  describe('empty state', () => {
    it('shows empty state when no events and no pending steps', () => {
      setupHook({ events: [] });
      render(<EscrowTimeline escrowId="esc-1" escrowStatus="COMPLETED" />);
      expect(screen.getByRole('status')).toBeInTheDocument();
      expect(screen.getByText('No activity yet')).toBeInTheDocument();
    });
  });

  describe('event rendering', () => {
    it('renders event type badge and human label', () => {
      setupHook({ events: [BASE_EVENT] });
      render(<EscrowTimeline escrowId="esc-1" />);
      expect(screen.getByText('CREATED')).toBeInTheDocument();
      expect(screen.getByText('Escrow created')).toBeInTheDocument();
    });

    it('renders amount pill when event has amount data', () => {
      setupHook({ events: [FUNDED_EVENT] });
      render(<EscrowTimeline escrowId="esc-1" />);
      expect(screen.getByText('500 XLM')).toBeInTheDocument();
    });

    it('renders truncated actor address', () => {
      setupHook({ events: [BASE_EVENT] });
      render(<EscrowTimeline escrowId="esc-1" />);
      expect(screen.getByText('GABC12…BCDE')).toBeInTheDocument();
    });

    it('renders relative timestamp', () => {
      setupHook({ events: [BASE_EVENT] });
      render(<EscrowTimeline escrowId="esc-1" />);
      expect(screen.getByText(/ago/)).toBeInTheDocument();
    });

    it('renders full timestamp as title on hover', () => {
      setupHook({ events: [BASE_EVENT] });
      render(<EscrowTimeline escrowId="esc-1" />);
      const time = screen.getByRole('time');
      expect(time).toHaveAttribute('title');
      expect(time.getAttribute('title')).toBeTruthy();
    });

    it('highlights the latest event with LATEST badge', () => {
      setupHook({ events: [BASE_EVENT, FUNDED_EVENT] });
      render(<EscrowTimeline escrowId="esc-1" />);
      expect(screen.getByText('LATEST')).toBeInTheDocument();
    });

    it('renders only one LATEST badge for multiple events', () => {
      setupHook({ events: [BASE_EVENT, FUNDED_EVENT, DISPUTED_EVENT] });
      render(<EscrowTimeline escrowId="esc-1" />);
      expect(screen.getAllByText('LATEST')).toHaveLength(1);
    });

    it('renders external link for actor address', () => {
      setupHook({ events: [BASE_EVENT] });
      render(<EscrowTimeline escrowId="esc-1" />);
      const link = screen.getByRole('link');
      expect(link).toHaveAttribute('href', expect.stringContaining('GABC1234567890ABCDE'));
      expect(link).toHaveAttribute('target', '_blank');
    });

    it('renders event count footer', () => {
      setupHook({ events: [BASE_EVENT, FUNDED_EVENT] });
      render(<EscrowTimeline escrowId="esc-1" escrowStatus="COMPLETED" />);
      expect(screen.getByText(/2 events/)).toBeInTheDocument();
    });
  });

  describe('copy button', () => {
    it('copies actor address to clipboard on click', async () => {
      setupHook({ events: [BASE_EVENT] });
      render(<EscrowTimeline escrowId="esc-1" />);
      fireEvent.click(screen.getByLabelText('Copy address'));
      await waitFor(() =>
        expect(navigator.clipboard.writeText).toHaveBeenCalledWith(BASE_EVENT.actorId),
      );
    });

    it('shows "Copied" label after copy', async () => {
      setupHook({ events: [BASE_EVENT] });
      render(<EscrowTimeline escrowId="esc-1" />);
      fireEvent.click(screen.getByLabelText('Copy address'));
      await waitFor(() =>
        expect(screen.getByLabelText('Copied')).toBeInTheDocument(),
      );
    });
  });

  describe('pending steps', () => {
    it('shows funding pending step for PENDING escrow', () => {
      setupHook({ events: [BASE_EVENT] });
      render(<EscrowTimeline escrowId="esc-1" escrowStatus="PENDING" />);
      expect(screen.getByLabelText('Pending: Awaiting funding')).toBeInTheDocument();
    });

    it('shows completion pending step for ACTIVE escrow with no conditions', () => {
      setupHook({ events: [BASE_EVENT, FUNDED_EVENT] });
      render(<EscrowTimeline escrowId="esc-1" escrowStatus="ACTIVE" hasConditions={false} />);
      expect(screen.getByLabelText('Pending: Escrow completion')).toBeInTheDocument();
    });

    it('shows conditions pending step for ACTIVE escrow with conditions', () => {
      setupHook({ events: [BASE_EVENT, FUNDED_EVENT] });
      render(
        <EscrowTimeline escrowId="esc-1" escrowStatus="ACTIVE" hasConditions={true} />,
      );
      expect(
        screen.getByLabelText('Pending: All conditions to be confirmed'),
      ).toBeInTheDocument();
    });

    it('shows dispute resolution pending for DISPUTED escrow', () => {
      setupHook({ events: [BASE_EVENT, DISPUTED_EVENT] });
      render(<EscrowTimeline escrowId="esc-1" escrowStatus="DISPUTED" />);
      expect(
        screen.getByLabelText('Pending: Dispute resolution pending'),
      ).toBeInTheDocument();
    });

    it('shows no pending steps for COMPLETED escrow', () => {
      setupHook({ events: [BASE_EVENT] });
      render(<EscrowTimeline escrowId="esc-1" escrowStatus="COMPLETED" />);
      expect(screen.queryByText(/Pending/)).not.toBeInTheDocument();
    });

    it('shows pending count in footer', () => {
      setupHook({ events: [BASE_EVENT] });
      render(<EscrowTimeline escrowId="esc-1" escrowStatus="PENDING" />);
      expect(screen.getByText(/pending step/)).toBeInTheDocument();
    });
  });

  describe('refresh', () => {
    it('calls refetch when refresh button is clicked', async () => {
      setupHook({ events: [BASE_EVENT] });
      mockRefetch.mockResolvedValue(undefined);
      render(<EscrowTimeline escrowId="esc-1" />);
      await act(async () => {
        fireEvent.click(screen.getByLabelText('Refresh timeline'));
      });
      expect(mockRefetch).toHaveBeenCalledTimes(1);
    });

    it('disables refresh button while refreshing', async () => {
      setupHook({ events: [BASE_EVENT] });
      let resolveFetch!: () => void;
      mockRefetch.mockReturnValue(new Promise<void>((r) => (resolveFetch = r)));
      render(<EscrowTimeline escrowId="esc-1" />);
      act(() => {
        fireEvent.click(screen.getByLabelText('Refresh timeline'));
      });
      expect(screen.getByLabelText('Refresh timeline')).toBeDisabled();
      act(() => resolveFetch());
    });
  });

  describe('error state', () => {
    it('displays error message', () => {
      setupHook({ events: [], error: 'Network error' });
      render(<EscrowTimeline escrowId="esc-1" />);
      expect(screen.getByRole('alert')).toHaveTextContent('Network error');
    });
  });
});
