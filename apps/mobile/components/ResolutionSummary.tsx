import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { DisputeDetails, DisputeResolution } from '../hooks/useDisputes';
import { colors } from '../theme';

interface ResolutionSummaryProps {
  dispute: DisputeDetails;
}

/** Display labels for the on-chain `Resolution` vocabulary. */
const RESOLUTION_LABELS: Record<DisputeResolution, string> = {
  depositor: 'Depositor',
  recipient: 'Recipient',
  split: 'Split',
};

export const ResolutionSummary: React.FC<ResolutionSummaryProps> = ({ dispute }) => {
  if (dispute.status !== 'RESOLVED' && dispute.status !== 'REJECTED') {
    return null;
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Resolution Summary</Text>
      
      <View style={styles.row}>
        <Text style={styles.label}>Decision:</Text>
        <Text style={styles.value}>{dispute.adminDecision || 'N/A'}</Text>
      </View>

      {dispute.status === 'RESOLVED' && dispute.winner && (
        <View style={styles.row}>
          <Text style={styles.label}>Resolved in favour of:</Text>
          <Text style={styles.value}>{RESOLUTION_LABELS[dispute.winner]}</Text>
        </View>
      )}

      {dispute.status === 'RESOLVED' && dispute.finalPayouts && (
        <View style={styles.payouts}>
          <Text style={styles.label}>Final Payouts:</Text>
          <Text style={styles.payoutText}>Depositor: ${dispute.finalPayouts.depositorAmount}</Text>
          <Text style={styles.payoutText}>Recipient: ${dispute.finalPayouts.recipientAmount}</Text>
        </View>
      )}

      {dispute.resolvedAt && (
        <Text style={styles.timestamp}>Resolved on: {new Date(dispute.resolvedAt).toLocaleDateString()}</Text>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.background,
    padding: 16,
    borderRadius: 8,
    marginTop: 16,
    borderWidth: 1,
    borderColor: colors.border,
  },
  title: {
    fontSize: 16,
    fontWeight: 'bold',
    color: colors.success, // Green for resolved
    marginBottom: 12,
  },
  row: {
    marginBottom: 8,
  },
  label: {
    color: colors.textSecondary,
    fontSize: 12,
    fontWeight: '600',
  },
  value: {
    color: colors.text,
    fontSize: 14,
    marginTop: 2,
  },
  payouts: {
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  payoutText: {
    color: colors.text,
    fontSize: 14,
    marginTop: 4,
  },
  timestamp: {
    color: colors.textTertiary,
    fontSize: 12,
    marginTop: 16,
    textAlign: 'right',
  },
});
