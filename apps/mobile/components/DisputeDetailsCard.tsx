import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { DisputeStatus } from '../hooks/useDisputes';
import { colors } from '../theme';

interface DisputeDetailsCardProps {
  status: DisputeStatus;
  reason: string;
}

export const DisputeDetailsCard: React.FC<DisputeDetailsCardProps> = ({ status, reason }) => {
  const getStatusColor = () => {
    switch (status) {
      case 'OPEN': return colors.danger; // Red
      case 'UNDER_REVIEW': return colors.warning; // Amber
      case 'RESOLVED': return colors.success; // Green
      case 'REJECTED': return colors.textTertiary; // Slate
      default: return colors.infoStrong;
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
    backgroundColor: colors.surface,
    padding: 16,
    borderRadius: 8,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: colors.border,
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
    color: colors.text,
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  badgeText: {
    color: colors.text,
    fontSize: 12,
    fontWeight: 'bold',
  },
  reasonLabel: {
    color: colors.textSecondary,
    fontSize: 12,
    marginBottom: 4,
  },
  reasonText: {
    color: colors.text,
    fontSize: 14,
  },
});
