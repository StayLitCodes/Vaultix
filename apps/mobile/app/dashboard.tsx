/**
 * #314 – Mobile Dashboard: escrow list + filters by status
 * Features: status filter tabs, infinite scroll/pagination, skeleton loaders, pull-to-refresh
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
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
import { escrowApi } from '../services/api';
import { Escrow, EscrowStatus } from '../types/escrow';
import { OfflineBanner } from '../components/OfflineBanner';
import { useNetworkStatus } from '../hooks/useNetworkStatus';
import { toFriendlyError, isOfflineError } from '../utils/errors';

const STATUS_FILTERS: Array<{ label: string; value: EscrowStatus | 'all' }> = [
  { label: 'All', value: 'all' },
  { label: 'Created', value: 'created' },
  { label: 'Funded', value: 'funded' },
  { label: 'Active', value: 'confirmed' },
  { label: 'Completed', value: 'completed' },
  { label: 'Disputed', value: 'disputed' },
  { label: 'Expired', value: 'expired' },
];

const STATUS_COLORS: Record<string, string> = {
  created: '#6c63ff',
  funded: '#00b4d8',
  confirmed: '#06d6a0',
  released: '#06d6a0',
  completed: '#06d6a0',
  cancelled: '#aaa',
  disputed: '#ef476f',
  expired: '#f77f00',
};

function SkeletonCard() {
  return (
    <View style={styles.skeletonCard}>
      <View style={styles.skeletonTitle} />
      <View style={styles.skeletonLine} />
      <View style={[styles.skeletonLine, { width: '50%' }]} />
    </View>
  );
}

function EscrowCard({ escrow, onPress }: { escrow: Escrow; onPress: () => void }) {
  const color = STATUS_COLORS[escrow.status] ?? '#aaa';
  return (
    <TouchableOpacity style={styles.card} onPress={onPress} accessibilityRole="button" accessibilityLabel={`Escrow ${escrow.title}`}>
      <View style={styles.cardHeader}>
        <Text style={styles.cardTitle} numberOfLines={1}>{escrow.title}</Text>
        <View style={[styles.badge, { backgroundColor: color + '33', borderColor: color }]}>
          <Text style={[styles.badgeText, { color }]}>{escrow.status.toUpperCase()}</Text>
        </View>
      </View>
      <Text style={styles.cardAmount}>{escrow.amount} {escrow.asset}</Text>
      <Text style={styles.cardMeta}>Deadline: {new Date(escrow.deadline).toLocaleDateString()}</Text>
    </TouchableOpacity>
  );
}

export default function DashboardScreen() {
  const router = useRouter();
  const [activeFilter, setActiveFilter] = useState<EscrowStatus | 'all'>('all');
  const [escrows, setEscrows] = useState<Escrow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<{ title: string; message: string } | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasNextPage, setHasNextPage] = useState(false);
  const pageRef = useRef(1);
  const { isOffline, markOffline, markOnline } = useNetworkStatus();

  const fetchEscrows = useCallback(async (status: EscrowStatus | 'all', page: number, append = false) => {
    try {
      const res = await escrowApi.list({ status, page, limit: 20 });
      setEscrows((prev) => (append ? [...prev, ...res.escrows] : res.escrows));
      setHasNextPage(res.hasNextPage);
      pageRef.current = page;
      setError(null);
      markOnline();
    } catch (err) {
      const friendly = toFriendlyError(err);
      setError({ title: friendly.title, message: friendly.message });
      if (isOfflineError(err)) markOffline();
    }
  }, [markOnline, markOffline]);

  useEffect(() => {
    setLoading(true);
    fetchEscrows(activeFilter, 1).finally(() => setLoading(false));
  }, [activeFilter, fetchEscrows]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchEscrows(activeFilter, 1);
    setRefreshing(false);
  }, [activeFilter, fetchEscrows]);

  const onLoadMore = useCallback(async () => {
    if (!hasNextPage || loadingMore) return;
    setLoadingMore(true);
    await fetchEscrows(activeFilter, pageRef.current + 1, true);
    setLoadingMore(false);
  }, [hasNextPage, loadingMore, activeFilter, fetchEscrows]);

  return (
    <View style={styles.container}>
      <OfflineBanner visible={isOffline} />

      {/* Status filter tabs */}
      <FlatList
        horizontal
        data={STATUS_FILTERS}
        keyExtractor={(item) => item.value}
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.filterRow}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={[styles.filterTab, activeFilter === item.value && styles.filterTabActive]}
            onPress={() => setActiveFilter(item.value)}
            accessibilityRole="tab"
            accessibilityState={{ selected: activeFilter === item.value }}
          >
            <Text style={[styles.filterTabText, activeFilter === item.value && styles.filterTabTextActive]}>
              {item.label}
            </Text>
          </TouchableOpacity>
        )}
      />

      {/* Escrow list */}
      {loading ? (
        <View style={styles.skeletonList}>
          {[1, 2, 3, 4].map((k) => <SkeletonCard key={k} />)}
        </View>
      ) : error ? (
        <View style={styles.errorContainer}>
          <Text style={styles.errorEmoji}>⚠️</Text>
          <Text style={styles.errorTitle}>{error.title}</Text>
          <Text style={styles.errorMessage}>{error.message}</Text>
          <TouchableOpacity style={styles.retryBtn} onPress={onRefresh}>
            <Text style={styles.retryText}>Retry</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={escrows}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#6c63ff" />}
          onEndReached={onLoadMore}
          onEndReachedThreshold={0.3}
          ListEmptyComponent={<Text style={styles.empty}>No escrows found.</Text>}
          ListFooterComponent={loadingMore ? <ActivityIndicator color="#6c63ff" style={{ marginVertical: 16 }} /> : null}
          renderItem={({ item }) => (
            <EscrowCard
              escrow={item}
              onPress={() => router.push({ pathname: '/escrow/[id]', params: { id: item.id } })}
            />
          )}
        />
      )}

      {/* FAB – create escrow */}
      <TouchableOpacity style={styles.fab} onPress={() => router.push('/escrow/create')} accessibilityRole="button" accessibilityLabel="Create new escrow">
        <Text style={styles.fabText}>＋</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#12121f' },
  filterRow: { paddingHorizontal: 16, paddingVertical: 12, gap: 8 },
  filterTab: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, backgroundColor: '#2d2d44', marginRight: 8 },
  filterTabActive: { backgroundColor: '#6c63ff' },
  filterTabText: { color: '#aaa', fontSize: 13, fontWeight: '500' },
  filterTabTextActive: { color: '#fff' },
  list: { paddingHorizontal: 16, paddingBottom: 100 },
  card: { backgroundColor: '#1e1e30', borderRadius: 12, padding: 16, marginBottom: 12 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  cardTitle: { color: '#fff', fontWeight: '600', fontSize: 15, flex: 1, marginRight: 8 },
  badge: { borderRadius: 6, borderWidth: 1, paddingHorizontal: 8, paddingVertical: 2 },
  badgeText: { fontSize: 10, fontWeight: '700' },
  cardAmount: { color: '#6c63ff', fontWeight: '700', fontSize: 18, marginBottom: 4 },
  cardMeta: { color: '#888', fontSize: 12 },
  empty: { color: '#888', textAlign: 'center', marginTop: 60, fontSize: 15 },
  errorContainer: { alignItems: 'center', justifyContent: 'center', marginTop: 60, paddingHorizontal: 32 },
  errorEmoji: { fontSize: 36, marginBottom: 8 },
  errorTitle: { color: '#ef476f', fontSize: 16, fontWeight: '700', marginBottom: 6, textAlign: 'center' },
  errorMessage: { color: '#aaa', fontSize: 13, textAlign: 'center', lineHeight: 18, marginBottom: 16 },
  retryBtn: { backgroundColor: '#6c63ff', borderRadius: 10, paddingHorizontal: 24, paddingVertical: 10 },
  retryText: { color: '#fff', fontWeight: '600' },
  skeletonList: { padding: 16 },
  skeletonCard: { backgroundColor: '#1e1e30', borderRadius: 12, padding: 16, marginBottom: 12 },
  skeletonTitle: { height: 16, backgroundColor: '#2d2d44', borderRadius: 4, marginBottom: 10, width: '70%' },
  skeletonLine: { height: 12, backgroundColor: '#2d2d44', borderRadius: 4, marginBottom: 8, width: '90%' },
  fab: { position: 'absolute', bottom: 28, right: 24, backgroundColor: '#6c63ff', width: 56, height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center', elevation: 6 },
  fabText: { color: '#fff', fontSize: 28, lineHeight: 32 },
});
