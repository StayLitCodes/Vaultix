import { renderHook, act } from '@testing-library/react-native';
import { useNotifications } from '../hooks/useNotifications';
import { notificationApi } from '../services/api';
import { NotificationsResponse } from '../types/notification';

jest.mock('../services/api', () => ({
  notificationApi: {
    list: jest.fn(),
    getUnreadCount: jest.fn(),
    markAsRead: jest.fn(),
  },
}));

const mockList = notificationApi.list as jest.Mock;
const mockMarkAsRead = notificationApi.markAsRead as jest.Mock;

const MOCK_RESPONSE: NotificationsResponse = {
  notifications: [
    {
      id: '1',
      userId: 'u1',
      escrowId: 'e1',
      eventType: 'FUNDED',
      payload: {},
      status: 'sent',
      readAt: null,
      retryCount: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    {
      id: '2',
      userId: 'u1',
      escrowId: undefined,
      eventType: 'CREATED',
      payload: {},
      status: 'sent',
      readAt: null,
      retryCount: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
  ],
  unreadCount: 2,
};

beforeEach(() => {
  mockList.mockResolvedValue(MOCK_RESPONSE);
  mockMarkAsRead.mockResolvedValue(undefined);
});

afterEach(() => {
  jest.clearAllMocks();
});

describe('useNotifications', () => {
  it('loads and counts unread notifications', async () => {
    const { result } = renderHook(() => useNotifications());

    await act(async () => {
      await result.current.reload();
    });

    expect(result.current.notifications.length).toBe(2);
    expect(result.current.unreadCount).toBe(2);
  });

  it('exposes loading=true initially then false after load', async () => {
    const { result } = renderHook(() => useNotifications());

    // After the initial load completes, loading should be false
    await act(async () => {});

    expect(result.current.loading).toBe(false);
    expect(mockList).toHaveBeenCalledTimes(1);
  });

  it('sets error state when API fails', async () => {
    mockList.mockRejectedValueOnce(new Error('Network error'));
    const { result } = renderHook(() => useNotifications());

    await act(async () => {});

    expect(result.current.error).toBeTruthy();
    expect(result.current.notifications).toHaveLength(0);
  });

  it('markAsRead calls API and updates local state on success', async () => {
    const { result } = renderHook(() => useNotifications());

    await act(async () => {});

    await act(async () => {
      await result.current.markAsRead('1');
    });

    expect(mockMarkAsRead).toHaveBeenCalledWith('1');
    const updated = result.current.notifications.find((n) => n.id === '1');
    expect(updated?.readAt).not.toBeNull();
    expect(result.current.unreadCount).toBe(1);
  });

  it('markAllAsRead calls API with no id and marks all as read', async () => {
    const { result } = renderHook(() => useNotifications());

    await act(async () => {});

    await act(async () => {
      await result.current.markAllAsRead();
    });

    expect(mockMarkAsRead).toHaveBeenCalledWith();
    expect(result.current.unreadCount).toBe(0);
    result.current.notifications.forEach((n) => expect(n.readAt).not.toBeNull());
  });

  it('reload re-fetches from the API', async () => {
    const { result } = renderHook(() => useNotifications());

    await act(async () => {});

    await act(async () => {
      await result.current.reload();
    });

    expect(mockList).toHaveBeenCalledTimes(2);
  });
});
