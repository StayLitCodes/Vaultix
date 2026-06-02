import { renderHook, act } from '@testing-library/react-native';
import { useNotifications } from '../hooks/useNotifications';
import { NotificationService } from '../services/NotificationService';

describe('useNotifications', () => {
  it('loads and counts unread notifications', async () => {
    const { result } = renderHook(() => useNotifications());
    
    await act(async () => {
      await result.current.reload();
    });

    expect(result.current.notifications.length).toBe(2);
    expect(result.current.unreadCount).toBe(2);
  });
});
