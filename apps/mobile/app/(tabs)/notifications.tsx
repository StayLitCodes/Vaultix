/**
 * Notifications screen: list of user notifications with loading/empty/error states
 * Features: pull-to-refresh, mark as read, link to related escrow
 */
import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { notificationApi } from '../../services/api';
import { Notification } from '../../types/notification';

const EVENT_LABELS: Record<string, string> = {
  CREATED: 'Escrow Created',
  PARTY_ADDED: 'Party Added',
  PARTY_ACCEPTED: 'Party Accepted',
  FUNDED: 'Escrow Funded',
  CONDITION_MET: 'Condition Met',
  STATUS_CHANGED: 'Status Changed',
  MILESTONE_RELEASED: 'Milestone Released',
  COMPLETED: 'Escrow Completed',
  CANCELLED: 'Escrow Cancelled',
  DISPUTED: 'Dispute Raised',
};

function NotificationItem({
  notification,
  onRead,
  onPress,
}: {
  notification: Notification;
  onRead: (id: string) => void;
  onPress: (escrowId?: string) => void;
}) {
  const isUnread = !notification.readAt;
  const label = EVENT_LABELS[notification.eventType] ?? notification.eventType.replace(/_/g, ' ');

  return (
    <TouchableOpacity
      style={[styles.item, isUnread && styles.itemUnread]}
      onPress={() => {
        if (isUnread) onRead(notification.id);
        onPress(notification.escrowId);
      }}
      accessibilityRole="button"
      accessibilityLabel={label}
    >
      <View style={styles.itemLeft}>
        {isUnread && <View style={styles.unreadDot} />}
        <View style={styles.itemContent}>
          <Text style={[styles.itemTitle, isUnread && styles.itemTitleUnread]}>{label}</Text>
          {notification.escrowId && (
            <Text style={styles.itemMeta} numberOfLines={1}>Escrow: {notification.escrowId.slice(0, 12)}…</Text>
          )}
          <Text style={styles.itemDate}>{new Date(notification.createdAt).toLocaleString()}</Text>
        </View>
      </View>
    </TouchableOpacity>
  );
}

function SkeletonItem() {
  return (
    <View style={styles.item}>
      <View style={styles.skeletonDot} />
      <View style={styles.skeletonContent}>
        <View style={styles.skeletonTitle} />
        <View style={[styles.skeletonLine, { width: '60%' }]} />
      </View>
    </View>
  );
}

export default function NotificationsScreen() {
  const router = useRouter();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

  const fetchNotifications = useCallback(async () => {
    try {
      setError(null);
      const res = await notificationApi.list();
      setNotifications(res.notifications);
      setUnreadCount(res.unreadCount);
    } catch {
      setError('Failed to load notifications. Pull to retry.');
    }
  }, []);

  useEffect(() => {
    setLoading(true);
    fetchNotifications().finally(() => setLoading(false));
  }, [fetchNotifications]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchNotifications();
    setRefreshing(false);
  }, [fetchNotifications]);

  const handleMarkRead = useCallback(async (id: string) => {
    try {
      await notificationApi.markAsRead(id);
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, readAt: new Date().toISOString() } : n)),
      );
      setUnreadCount((c) => Math.max(0, c - 1));
    } catch {
      // silently fail
    }
  }, []);

  const handleMarkAllRead = useCallback(async () => {
    try {
      await notificationApi.markAsRead();
      setNotifications((prev) =>
        prev.map((n) => ({ ...n, readAt: n.readAt ?? new Date().toISOString() })),
      );
      setUnreadCount(0);
    } catch {
      // silently fail
    }
  }, []);

  const handlePress = useCallback(
    (escrowId?: string) => {
      if (escrowId) {
        router.push({ pathname: '/escrow/[id]', params: { id: escrowId } });
      }
    },
    [router],
  );

  return (
    <View style={styles.container}>
      {/* Screen header */}
      <View style={styles.screenHeader}>
        <View>
          <Text style={styles.screenTitle}>Notifications</Text>
          {unreadCount > 0 && (
            <Text style={styles.unreadBadge}>{unreadCount} unread</Text>
          )}
        </View>
        {unreadCount > 0 && (
          <TouchableOpacity onPress={handleMarkAllRead} accessibilityRole="button" accessibilityLabel="Mark all as read">
            <Text style={styles.markAllBtn}>Mark all read</Text>
          </TouchableOpacity>
        )}
      </View>

      {loading ? (
        <View style={styles.skeletonList}>
          {[1, 2, 3, 4, 5].map((k) => <SkeletonItem key={k} />)}
        </View>
      ) : error ? (
        <View style={styles.errorContainer}>
          <Text style={styles.errorEmoji}>⚠️</Text>
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity style={styles.retryBtn} onPress={onRefresh}>
            <Text style={styles.retryText}>Retry</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={notifications}
          keyExtractor={(item) => item.id}
          contentContainerStyle={notifications.length === 0 ? styles.emptyList : styles.list}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#6c63ff" />}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyEmoji}>🔔</Text>
              <Text style={styles.empty}>No notifications yet.</Text>
              <Text style={styles.emptySub}>You'll see updates about your escrows here.</Text>
            </View>
          }
          renderItem={({ item }) => (
            <NotificationItem
              notification={item}
              onRead={handleMarkRead}
              onPress={handlePress}
            />
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#12121f' },
  screenHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 8,
  },
  screenTitle: { color: '#fff', fontSize: 22, fontWeight: '700' },
  unreadBadge: { color: '#6c63ff', fontSize: 12, marginTop: 2 },
  markAllBtn: { color: '#6c63ff', fontSize: 13, fontWeight: '600' },
  list: { paddingHorizontal: 16, paddingBottom: 20 },
  emptyList: { flexGrow: 1 },
  item: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#1e1e30',
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
  },
  itemUnread: {
    backgroundColor: '#1e1e50',
    borderLeftWidth: 3,
    borderLeftColor: '#6c63ff',
  },
  itemLeft: { flexDirection: 'row', alignItems: 'flex-start', flex: 1 },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#6c63ff',
    marginRight: 10,
    marginTop: 6,
  },
  itemContent: { flex: 1 },
  itemTitle: { color: '#aaa', fontSize: 14, fontWeight: '500' },
  itemTitleUnread: { color: '#fff', fontWeight: '600' },
  itemMeta: { color: '#888', fontSize: 12, marginTop: 3 },
  itemDate: { color: '#666', fontSize: 11, marginTop: 3 },
  emptyContainer: { alignItems: 'center', justifyContent: 'center', flex: 1, paddingTop: 80 },
  emptyEmoji: { fontSize: 40, marginBottom: 8 },
  empty: { color: '#888', fontSize: 15, textAlign: 'center' },
  emptySub: { color: '#666', fontSize: 13, marginTop: 4, textAlign: 'center' },
  errorContainer: { alignItems: 'center', justifyContent: 'center', flex: 1, paddingHorizontal: 32 },
  errorEmoji: { fontSize: 40, marginBottom: 12 },
  errorText: { color: '#ef476f', fontSize: 14, textAlign: 'center', marginBottom: 16 },
  retryBtn: { backgroundColor: '#6c63ff', borderRadius: 10, paddingHorizontal: 24, paddingVertical: 10 },
  retryText: { color: '#fff', fontWeight: '600' },
  skeletonList: { padding: 16 },
  skeletonDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#2d2d44', marginRight: 10, marginTop: 6 },
  skeletonContent: { flex: 1 },
  skeletonTitle: { height: 14, backgroundColor: '#2d2d44', borderRadius: 4, marginBottom: 8, width: '70%' },
  skeletonLine: { height: 10, backgroundColor: '#2d2d44', borderRadius: 4, marginBottom: 6, width: '90%' },
});
