import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { DisputeStatus } from '../hooks/useDisputes';

interface DisputeDetailsCardProps {
  status: DisputeStatus;
  reason: string;
}

export const DisputeDetailsCard: React.FC<DisputeDetailsCardProps> = ({ status, reason }) => {
  const getStatusColor = () => {
    switch (status) {
      case 'OPEN': return '#EF4444'; // Red
      case 'UNDER_REVIEW': return '#F59E0B'; // Amber
      case 'RESOLVED': return '#10B981'; // Green
      case 'REJECTED': return '#64748B'; // Slate
      default: return '#3B82F6';
    }
  };

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <Text style={styles.title}>Dispute Details</Text>
        <View style={[styles.badge, { backgroundColor: getStatusColor() }]}>
          <Text style={styles.badgeText}>{status.replace('_', ' ')}</Text>
        </View>
      </View>
      <Text style={styles.reasonLabel}>Reason:</Text>
      <Text style={styles.reasonText}>{reason}</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#1E293B',
    padding: 16,
    borderRadius: 8,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#334155',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  title: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#FFF',
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  badgeText: {
    color: '#FFF',
    fontSize: 12,
    fontWeight: 'bold',
  },
  reasonLabel: {
    color: '#94A3B8',
    fontSize: 12,
    marginBottom: 4,
  },
  reasonText: {
    color: '#FFF',
    fontSize: 14,
  },
});
