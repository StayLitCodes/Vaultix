import React from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet } from 'react-native';
import { useNotifications } from '../hooks/useNotifications';
import { NotificationItem } from '../services/NotificationService';

export default function NotificationsScreen() {
  const { notifications, unreadCount, markAsRead, markAllAsRead } = useNotifications();

  const renderItem = ({ item }: { item: NotificationItem }) => (
    <TouchableOpacity
      style={[styles.notificationCard, !item.isRead && styles.unreadCard]}
      onPress={() => markAsRead(item.id)}
    >
      <View style={styles.cardHeader}>
        <Text style={styles.typeText}>{item.type.replace('_', ' ')}</Text>
        {!item.isRead && <View style={styles.unreadDot} />}
      </View>
      <Text style={styles.messageText}>{item.message}</Text>
      <Text style={styles.dateText}>{new Date(item.createdAt).toLocaleDateString()}</Text>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Notifications</Text>
        {unreadCount > 0 && (
          <TouchableOpacity onPress={markAllAsRead}>
            <Text style={styles.markAllText}>Mark all as read</Text>
          </TouchableOpacity>
        )}
      </View>

      <FlatList
        data={notifications}
        keyExtractor={item => item.id}
        renderItem={renderItem}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={
          <Text style={styles.emptyText}>No notifications yet.</Text>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0F172A',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#1E293B',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  markAllText: {
    color: '#3B82F6',
    fontWeight: '600',
  },
  listContent: {
    padding: 16,
  },
  notificationCard: {
    backgroundColor: '#1E293B',
    padding: 16,
    borderRadius: 8,
    marginBottom: 12,
  },
  unreadCard: {
    borderColor: '#3B82F6',
    borderWidth: 1,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  typeText: {
    color: '#94A3B8',
    fontSize: 12,
    fontWeight: 'bold',
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#3B82F6',
  },
  messageText: {
    color: '#FFFFFF',
    fontSize: 14,
    marginBottom: 8,
  },
  dateText: {
    color: '#64748B',
    fontSize: 12,
  },
  emptyText: {
    color: '#94A3B8',
    textAlign: 'center',
    marginTop: 32,
  },
});
