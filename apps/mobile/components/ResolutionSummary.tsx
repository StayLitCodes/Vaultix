import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { DisputeDetails } from '../hooks/useDisputes';

interface ResolutionSummaryProps {
  dispute: DisputeDetails;
}

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
          <Text style={styles.label}>Winner:</Text>
          <Text style={styles.value}>{dispute.winner}</Text>
        </View>
      )}

      {dispute.status === 'RESOLVED' && dispute.finalPayouts && (
        <View style={styles.payouts}>
          <Text style={styles.label}>Final Payouts:</Text>
          <Text style={styles.payoutText}>Buyer: ${dispute.finalPayouts.buyerAmount}</Text>
          <Text style={styles.payoutText}>Seller: ${dispute.finalPayouts.sellerAmount}</Text>
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
    backgroundColor: '#0F172A',
    padding: 16,
    borderRadius: 8,
    marginTop: 16,
    borderWidth: 1,
    borderColor: '#334155',
  },
  title: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#10B981', // Green for resolved
    marginBottom: 12,
  },
  row: {
    marginBottom: 8,
  },
  label: {
    color: '#94A3B8',
    fontSize: 12,
    fontWeight: '600',
  },
  value: {
    color: '#FFF',
    fontSize: 14,
    marginTop: 2,
  },
  payouts: {
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#334155',
  },
  payoutText: {
    color: '#FFF',
    fontSize: 14,
    marginTop: 4,
  },
  timestamp: {
    color: '#64748B',
    fontSize: 12,
    marginTop: 16,
    textAlign: 'right',
  },
});
