/**
 * #317 – Mobile Release Milestone + Transaction Status Tracking
 * Features: trigger release, show tx lifecycle (submitting/submitted/confirmed/failed), retry on failure
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { escrowApi } from '../../services/api';
import { requireAuth } from '../../services/auth';
import { TxState, TxStatus } from '../../types/escrow';

const POLL_INTERVAL_MS = 3000;
const MAX_POLLS = 20; // ~60 s timeout

const TX_STEPS: Array<{ status: TxStatus; label: string; description: string }> = [
  { status: 'idle', label: 'Ready', description: 'Confirm to release this milestone.' },
  { status: 'submitting', label: 'Submitting', description: 'Sending transaction to Stellar network…' },
  { status: 'submitted', label: 'Submitted', description: 'Transaction submitted. Waiting for confirmation…' },
  { status: 'confirmed', label: 'Confirmed', description: 'Milestone released successfully! 🎉' },
  { status: 'failed', label: 'Failed', description: 'Transaction failed. See error below.' },
];

function StatusStep({ step, current }: { step: typeof TX_STEPS[number]; current: TxStatus }) {
  const statuses: TxStatus[] = ['idle', 'submitting', 'submitted', 'confirmed'];
  const currentIdx = statuses.indexOf(current);
  const stepIdx = statuses.indexOf(step.status);
  const isDone = stepIdx < currentIdx || current === 'confirmed';
  const isActive = step.status === current;
  const isFailed = current === 'failed' && step.status === 'submitting';

  return (
    <View style={styles.stepRow}>
      <View style={[
        styles.stepCircle,
        isDone && styles.stepCircleDone,
        isActive && styles.stepCircleActive,
        isFailed && styles.stepCircleFailed,
      ]}>
        {isDone ? (
          <Text style={styles.stepCheck}>✓</Text>
        ) : isActive && current !== 'idle' ? (
          <ActivityIndicator size="small" color="#fff" />
        ) : (
          <Text style={styles.stepNum}>{statuses.indexOf(step.status) + 1}</Text>
        )}
      </View>
      <View style={styles.stepInfo}>
        <Text style={[styles.stepLabel, isActive && styles.stepLabelActive]}>{step.label}</Text>
        {isActive && <Text style={styles.stepDesc}>{step.description}</Text>}
      </View>
    </View>
  );
}

export default function ReleaseMilestoneScreen() {
  const { escrowId, milestoneId } = useLocalSearchParams<{ escrowId: string; milestoneId: string }>();
  const router = useRouter();
  const [tx, setTx] = useState<TxState>({ status: 'idle' });
  const pollCount = useRef(0);
  const pollTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const stopPolling = useCallback(() => {
    if (pollTimer.current) {
      clearTimeout(pollTimer.current);
      pollTimer.current = null;
    }
  }, []);

  const pollTxStatus = useCallback(async (txHash: string) => {
    if (pollCount.current >= MAX_POLLS) {
      stopPolling();
      setTx({ status: 'failed', txHash, error: 'Confirmation timeout. Check your wallet for status.' });
      return;
    }
    try {
      const result = await escrowApi.getTxStatus(txHash);
      if (result.confirmed) {
        stopPolling();
        setTx({ status: 'confirmed', txHash });
      } else if (result.status === 'failed') {
        stopPolling();
        setTx({ status: 'failed', txHash, error: 'Transaction rejected by the network.' });
      } else {
        pollCount.current += 1;
        pollTimer.current = setTimeout(() => pollTxStatus(txHash), POLL_INTERVAL_MS);
      }
    } catch {
      pollCount.current += 1;
      pollTimer.current = setTimeout(() => pollTxStatus(txHash), POLL_INTERVAL_MS);
    }
  }, [stopPolling]);

  useEffect(() => {
    if (!escrowId || !milestoneId) return;
    requireAuth(router, { pathname: '/escrow/release', params: { escrowId, milestoneId } });
  }, [escrowId, milestoneId, router]);

  useEffect(() => () => stopPolling(), [stopPolling]);

  if (!escrowId || !milestoneId) {
    return (
      <View style={styles.container}>
        <Text style={styles.title}>Invalid Release Link</Text>
        <Text style={styles.subtitle}>This milestone release link is missing required information.</Text>
      </View>
    );
  }

  const handleRelease = useCallback(async () => {
    if (!escrowId || !milestoneId) return;
    pollCount.current = 0;
    setTx({ status: 'submitting' });
    try {
      const { txHash } = await escrowApi.releaseMilestone({ escrowId, milestoneId });
      setTx({ status: 'submitted', txHash });
      pollTxStatus(txHash);
    } catch (err: unknown) {
      const message = getErrorMessage(err);
      setTx({ status: 'failed', error: message });
    }
  }, [escrowId, milestoneId, pollTxStatus]);

  const handleRetry = useCallback(() => {
    setTx({ status: 'idle' });
  }, []);

  const visibleSteps = TX_STEPS.filter((s) => s.status !== 'failed');

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Release Milestone</Text>
      <Text style={styles.subtitle}>Escrow: {escrowId}</Text>
      <Text style={styles.subtitle}>Milestone: {milestoneId}</Text>

      {/* Transaction lifecycle steps */}
      <View style={styles.stepsCard}>
        {visibleSteps.map((s) => (
          <StatusStep key={s.status} step={s} current={tx.status} />
        ))}
      </View>

      {/* Tx hash */}
      {tx.txHash && (
        <View style={styles.hashCard}>
          <Text style={styles.hashLabel}>Transaction Hash</Text>
          <Text style={styles.hashValue} numberOfLines={2}>{tx.txHash}</Text>
        </View>
      )}

      {/* Error */}
      {tx.status === 'failed' && tx.error && (
        <View style={styles.errorCard}>
          <Text style={styles.errorTitle}>⚠ Error</Text>
          <Text style={styles.errorMsg}>{tx.error}</Text>
        </View>
      )}

      {/* Actions */}
      <View style={styles.actions}>
        {tx.status === 'idle' && (
          <TouchableOpacity style={styles.primaryBtn} onPress={handleRelease} accessibilityRole="button" accessibilityLabel="Confirm release milestone">
            <Text style={styles.primaryBtnText}>Confirm Release</Text>
          </TouchableOpacity>
        )}

        {tx.status === 'failed' && (
          <>
            <TouchableOpacity style={styles.primaryBtn} onPress={handleRetry}>
              <Text style={styles.primaryBtnText}>Retry</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.secondaryBtn} onPress={() => router.back()}>
              <Text style={styles.secondaryBtnText}>Go Back</Text>
            </TouchableOpacity>
          </>
        )}

        {tx.status === 'confirmed' && (
          <>
            <View style={styles.successBanner}>
              <Text style={styles.successText}>✅ Milestone released successfully!</Text>
            </View>
            <TouchableOpacity style={styles.primaryBtn} onPress={() => router.replace({ pathname: '/escrow/[id]', params: { id: escrowId } })}>
              <Text style={styles.primaryBtnText}>Back to Escrow</Text>
            </TouchableOpacity>
          </>
        )}

        {(tx.status === 'submitting' || tx.status === 'submitted') && (
          <TouchableOpacity style={[styles.secondaryBtn, { opacity: 0.5 }]} disabled>
            <Text style={styles.secondaryBtnText}>Processing…</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

function getErrorMessage(err: unknown): string {
  if (err && typeof err === 'object' && 'response' in err) {
    const axiosErr = err as { response?: { data?: { message?: string }; status?: number } };
    if (axiosErr.response?.status === 403) return 'Unauthorized: you cannot release this milestone.';
    if (axiosErr.response?.status === 402) return 'Insufficient balance to complete this transaction.';
    if (axiosErr.response?.data?.message) return axiosErr.response.data.message;
  }
  return 'An unexpected error occurred. Please try again.';
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#12121f', padding: 20 },
  title: { color: '#fff', fontSize: 22, fontWeight: '700', marginBottom: 4 },
  subtitle: { color: '#888', fontSize: 13, marginBottom: 4 },
  stepsCard: { backgroundColor: '#1e1e30', borderRadius: 14, padding: 16, marginTop: 24, marginBottom: 16 },
  stepRow: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 16 },
  stepCircle: { width: 32, height: 32, borderRadius: 16, backgroundColor: '#2d2d44', alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  stepCircleDone: { backgroundColor: '#06d6a0' },
  stepCircleActive: { backgroundColor: '#6c63ff' },
  stepCircleFailed: { backgroundColor: '#ef476f' },
  stepCheck: { color: '#fff', fontWeight: '700', fontSize: 14 },
  stepNum: { color: '#888', fontSize: 13 },
  stepInfo: { flex: 1 },
  stepLabel: { color: '#aaa', fontWeight: '500', fontSize: 14 },
  stepLabelActive: { color: '#fff', fontWeight: '700' },
  stepDesc: { color: '#888', fontSize: 12, marginTop: 2 },
  hashCard: { backgroundColor: '#1e1e30', borderRadius: 10, padding: 14, marginBottom: 12 },
  hashLabel: { color: '#888', fontSize: 11, marginBottom: 4 },
  hashValue: { color: '#6c63ff', fontSize: 12, fontFamily: 'monospace' },
  errorCard: { backgroundColor: '#ef476f22', borderRadius: 10, padding: 14, borderWidth: 1, borderColor: '#ef476f', marginBottom: 12 },
  errorTitle: { color: '#ef476f', fontWeight: '700', marginBottom: 4 },
  errorMsg: { color: '#ffb3c1', fontSize: 13 },
  actions: { marginTop: 8, gap: 12 },
  primaryBtn: { backgroundColor: '#6c63ff', borderRadius: 12, paddingVertical: 16, alignItems: 'center' },
  primaryBtnText: { color: '#fff', fontWeight: '700', fontSize: 16 },
  secondaryBtn: { backgroundColor: '#2d2d44', borderRadius: 12, paddingVertical: 14, alignItems: 'center' },
  secondaryBtnText: { color: '#ccc', fontWeight: '600' },
  successBanner: { backgroundColor: '#06d6a022', borderRadius: 10, padding: 14, borderWidth: 1, borderColor: '#06d6a0', alignItems: 'center' },
  successText: { color: '#06d6a0', fontWeight: '600', fontSize: 15 },
});
