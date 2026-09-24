import React from 'react';
import { View, Text, FlatList, StyleSheet } from 'react-native';

export type TxStatus = 'pending' | 'completed' | 'failed' | 'cancelled';

export interface EscrowTransaction {
  id: string;
  type: string;
  amount: string;
  status: TxStatus;
  createdAt: string;
}

interface Props {
  transactions: EscrowTransaction[];
}

const STATUS_COLOR: Record<TxStatus, string> = {
  pending: '#F59E0B',
  completed: '#10B981',
  failed: '#EF4444',
  cancelled: '#6B7280',
};

const EscrowTransactionHistory: React.FC<Props> = ({ transactions }) => {
  if (transactions.length === 0) {
    return (
      <View style={styles.empty}>
        <Text style={styles.emptyText}>No transactions yet.</Text>
      </View>
    );
  }

  return (
    <FlatList
      data={transactions}
      keyExtractor={(item) => item.id}
      renderItem={({ item }) => (
        <View style={styles.row}>
          <View style={styles.left}>
            <Text style={styles.type}>{item.type}</Text>
            <Text style={styles.date}>{item.createdAt}</Text>
          </View>
          <View style={styles.right}>
            <Text style={styles.amount}>{item.amount}</Text>
            <Text style={[styles.status, { color: STATUS_COLOR[item.status] }]}>
              {item.status}
            </Text>
          </View>
        </View>
      )}
    />
  );
};

const styles = StyleSheet.create({
  empty: { padding: 16, alignItems: 'center' },
  emptyText: { color: '#6B7280', fontSize: 14 },
  row: { flexDirection: 'row', justifyContent: 'space-between', padding: 12, borderBottomWidth: 1, borderColor: '#E5E7EB' },
  left: { flex: 1 },
  right: { alignItems: 'flex-end' },
  type: { fontSize: 14, fontWeight: '500', color: '#111827' },
  date: { fontSize: 12, color: '#6B7280', marginTop: 2 },
  amount: { fontSize: 14, fontWeight: '600', color: '#111827' },
  status: { fontSize: 12, marginTop: 2, textTransform: 'capitalize' },
});

export default EscrowTransactionHistory;