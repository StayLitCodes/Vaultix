/**
 * Dashboard tab: escrow list + filters by status
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
import { escrowApi } from '../../services/api';
import { Escrow, EscrowStatus } from '../../types/escrow';

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
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasNextPage, setHasNextPage] = useState(false);
  const pageRef = useRef(1);

  const fetchEscrows = useCallback(async (status: EscrowStatus | 'all', page: number, append = false) => {
    try {
      setError(null);
      const res = await escrowApi.list({ status, page, limit: 20 });
      setEscrows((prev) => (append ? [...prev, ...res.escrows] : res.escrows));
      setHasNextPage(res.hasNextPage);
      pageRef.current = page;
    } catch {
      setError('Failed to load escrows. Pull to retry.');
    }
  }, []);

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
      {/* Screen header (tabs hide the stack header) */}
      <View style={styles.screenHeader}>
        <Text style={styles.screenTitle}>Dashboard</Text>
        <TouchableOpacity
          style={styles.createBtn}
          onPress={() => router.push('/escrow/create')}
          accessibilityRole="button"
          accessibilityLabel="Create new escrow"
        >
          <Text style={styles.createBtnText}>＋</Text>
        </TouchableOpacity>
      </View>

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
          <Text style={styles.errorText}>{error}</Text>
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
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyEmoji}>📋</Text>
              <Text style={styles.empty}>No escrows found.</Text>
              <Text style={styles.emptySub}>Create one to get started!</Text>
              <TouchableOpacity style={styles.emptyCta} onPress={() => router.push('/escrow/create')}>
                <Text style={styles.emptyCtaText}>Create Escrow</Text>
              </TouchableOpacity>
            </View>
          }
          ListFooterComponent={loadingMore ? <ActivityIndicator color="#6c63ff" style={{ marginVertical: 16 }} /> : null}
          renderItem={({ item }) => (
            <EscrowCard
              escrow={item}
              onPress={() => router.push({ pathname: '/escrow/[id]', params: { id: item.id } })}
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
    paddingBottom: 4,
  },
  screenTitle: { color: '#fff', fontSize: 22, fontWeight: '700' },
  createBtn: {
    backgroundColor: '#6c63ff',
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  createBtnText: { color: '#fff', fontSize: 20, lineHeight: 24 },
  filterRow: { paddingHorizontal: 16, paddingVertical: 12, gap: 8 },
  filterTab: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, backgroundColor: '#2d2d44', marginRight: 8 },
  filterTabActive: { backgroundColor: '#6c63ff' },
  filterTabText: { color: '#aaa', fontSize: 13, fontWeight: '500' },
  filterTabTextActive: { color: '#fff' },
  list: { paddingHorizontal: 16, paddingBottom: 20 },
  card: { backgroundColor: '#1e1e30', borderRadius: 12, padding: 16, marginBottom: 12 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  cardTitle: { color: '#fff', fontWeight: '600', fontSize: 15, flex: 1, marginRight: 8 },
  badge: { borderRadius: 6, borderWidth: 1, paddingHorizontal: 8, paddingVertical: 2 },
  badgeText: { fontSize: 10, fontWeight: '700' },
  cardAmount: { color: '#6c63ff', fontWeight: '700', fontSize: 18, marginBottom: 4 },
  cardMeta: { color: '#888', fontSize: 12 },
  emptyContainer: { alignItems: 'center', marginTop: 60 },
  emptyEmoji: { fontSize: 40, marginBottom: 8 },
  empty: { color: '#888', textAlign: 'center', fontSize: 15 },
  emptySub: { color: '#666', fontSize: 13, marginTop: 4, marginBottom: 16 },
  emptyCta: { backgroundColor: '#6c63ff', borderRadius: 10, paddingHorizontal: 24, paddingVertical: 10 },
  emptyCtaText: { color: '#fff', fontWeight: '600' },
  errorContainer: { alignItems: 'center', justifyContent: 'center', marginTop: 60, paddingHorizontal: 32 },
  errorText: { color: '#ef476f', fontSize: 14, textAlign: 'center', marginBottom: 16 },
  retryBtn: { backgroundColor: '#6c63ff', borderRadius: 10, paddingHorizontal: 24, paddingVertical: 10 },
  retryText: { color: '#fff', fontWeight: '600' },
  skeletonList: { padding: 16 },
  skeletonCard: { backgroundColor: '#1e1e30', borderRadius: 12, padding: 16, marginBottom: 12 },
  skeletonTitle: { height: 16, backgroundColor: '#2d2d44', borderRadius: 4, marginBottom: 10, width: '70%' },
  skeletonLine: { height: 12, backgroundColor: '#2d2d44', borderRadius: 4, marginBottom: 8, width: '90%' },
});
