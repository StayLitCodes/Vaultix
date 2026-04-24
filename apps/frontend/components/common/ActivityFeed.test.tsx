import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import ActivityFeed from './ActivityFeed';
import { useEvents } from '@/hooks/useEvents';

// Mock useEvents hook
jest.mock('@/hooks/useEvents', () => ({
  useEvents: jest.fn(),
}));

// Mock ActivityFeedSkeleton to simplify
jest.mock('../ui/ActivityFeedSkeleton', () => ({
  ActivityFeedSkeleton: () => <div data-testid="skeleton">Loading...</div>,
}));

// Mock ActivityItem to simplify
jest.mock('./ActivityItem', () => {
  return ({ event }: { event: any }) => <div data-testid="activity-item">{event.title}</div>;
});

// Mock Framer Motion
jest.mock('framer-motion', () => ({
  motion: {
    div: ({ children, ...props }: any) => <div {...props}>{children}</div>,
  },
  AnimatePresence: ({ children }: any) => <>{children}</>,
}));

describe('ActivityFeed', () => {
  const mockRefetch = jest.fn();
  const mockFetchNextPage = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    (useEvents as jest.Mock).mockReturnValue({
      data: {
        pages: [
          {
            events: [
              { id: '1', title: 'Event 1', type: 'FUNDED' },
              { id: '2', title: 'Event 2', type: 'COMPLETED' },
            ],
          },
        ],
      },
      fetchNextPage: mockFetchNextPage,
      hasNextPage: true,
      isFetchingNextPage: false,
      status: 'success',
      refetch: mockRefetch,
      isFetching: false,
    });
    
    // Mock IntersectionObserver
    const mockIntersectionObserver = jest.fn();
    mockIntersectionObserver.mockReturnValue({
      observe: jest.fn(),
      unobserve: jest.fn(),
      disconnect: jest.fn(),
    });
    window.IntersectionObserver = mockIntersectionObserver;
  });

  it('renders events correctly', () => {
    render(<ActivityFeed />);
    expect(screen.getByText('Live Activity')).toBeInTheDocument();
    expect(screen.getAllByTestId('activity-item')).toHaveLength(2);
    expect(screen.getByText('Event 1')).toBeInTheDocument();
    expect(screen.getByText('Event 2')).toBeInTheDocument();
  });

  it('shows skeleton when status is pending', () => {
    (useEvents as jest.Mock).mockReturnValue({
      status: 'pending',
      isFetching: true,
    });
    
    render(<ActivityFeed />);
    expect(screen.getByTestId('skeleton')).toBeInTheDocument();
  });

  it('shows empty state when no events', () => {
    (useEvents as jest.Mock).mockReturnValue({
      data: { pages: [{ events: [] }] },
      status: 'success',
      isFetching: false,
    });
    
    render(<ActivityFeed />);
    expect(screen.getByText('No activity yet')).toBeInTheDocument();
  });

  it('changes filter when a filter button is clicked', () => {
    render(<ActivityFeed />);
    
    const foundingFilter = screen.getByText('Founding');
    fireEvent.click(foundingFilter);
    
    expect(useEvents).toHaveBeenCalledWith(expect.objectContaining({
      eventType: 'FUNDED'
    }));
  });

  it('calls refetch when refresh button is clicked', () => {
    render(<ActivityFeed />);
    
    // The refresh button is the one with RefreshCw icon
    // It's the only other button in the header besides filter buttons
    const buttons = screen.getAllByRole('button');
    // Filter buttons are 5, Close button/Refresh button depends on structure
    // Let's find it by testing for the RefreshCw icon component if possible, 
    // but icons are often harder to find by text.
    // In our case, filters are in the second div, refresh is in the first.
    
    // Let's use the first button that's NOT a filter button if possible or just get index.
    // Based on the code: filter buttons come after the zap icon.
    // Refresh button is the very first button in the component.
    fireEvent.click(buttons[0]);
    
    expect(mockRefetch).toHaveBeenCalled();
  });
});
