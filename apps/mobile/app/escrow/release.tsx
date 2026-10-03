/**
 * #317 – Mobile Release Milestone + Transaction Status Tracking
 * Features: trigger release, show tx lifecycle (submitting/submitted/confirmed/failed), retry on failure
 *
 * #709: release is executed by the backend, which returns only a tx hash, so
 * there is no envelope for the device wallet to sign yet. See the tracking note
 * on `escrowApi.releaseMilestone` for the switch to `signTransactionXDR`.
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
import { useBiometricLock } from '../../hooks/useBiometricLock';
import { Escrow, TxState, TxStatus } from '../../types/escrow';
import { toFriendlyError } from '../../utils/errors';
import { colors } from '../../theme';

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
          <ActivityIndicator size="small" color={colors.text} />
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
  const { escrowId, milestoneId } = useLocalSearchParams<{ escrowId?: string; milestoneId?: string }>();
  const router = useRouter();
  const [tx, setTx] = useState<TxState>({ status: 'idle' });
  // #762 — re-auth before moving funds.
  const { reauthenticate, isReauthing } = useBiometricLock();
  // Loaded so the re-auth prompt can name the amount being released.
  const [escrow, setEscrow] = useState<Escrow | null>(null);
  const pollCount = useRef(0);
  const pollTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const milestone = escrow?.milestones?.find((m) => m.id === milestoneId);
  const releaseAmount = milestone?.amount;
  const releaseAsset = escrow?.asset ?? 'XLM';

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

  // Best effort: only used to name the amount in the re-auth prompt, so a
  // failure here must not block the release itself.
  useEffect(() => {
    if (!escrowId) return;
    let cancelled = false;
    void escrowApi
      .getById(escrowId)
      .then((data) => {
        if (!cancelled) setEscrow(data);
      })
      .catch(() => {
        /* keep the prompt generic */
      });
    return () => {
      cancelled = true;
    };
  }, [escrowId]);

  useEffect(() => () => stopPolling(), [stopPolling]);

  const handleRelease = useCallback(async () => {
    if (!escrowId || !milestoneId) return;

    // #762 — a plain button tap must not move funds. Re-authenticate first and
    // bail out before *any* state change if the prompt is cancelled or fails.
    const reauth = await reauthenticate({
      promptMessage: 'Confirm milestone release',
      subtitle: releaseAmount
        ? `Releasing ${releaseAmount} ${releaseAsset} — this cannot be undone.`
        : 'Releasing funds to the recipient — this cannot be undone.',
    });
    if (reauth.required && !reauth.success) {
      Alert.alert(
        'Release cancelled',
        reauth.reason === 'unavailable'
          ? 'Biometric authentication is unavailable on this device, so the release was not submitted.'
          : 'Authentication was not completed, so the release was not submitted.',
        [{ text: 'OK' }],
      );
      return;
    }

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
  }, [escrowId, milestoneId, pollTxStatus, reauthenticate, releaseAmount, releaseAsset]);

  const handleRetry = useCallback(() => {
    if (!escrowId || !milestoneId) return;
    setTx({ status: 'idle' });
  }, [escrowId, milestoneId]);

  // All hooks must run before this return: params can arrive after the first render
  if (!escrowId || !milestoneId) {
    return (
      <View style={styles.container}>
        <Text style={styles.title}>Invalid Release Link</Text>
        <Text style={styles.subtitle}>This milestone release link is missing required information.</Text>
      </View>
    );
  }

  const visibleSteps = TX_STEPS.filter((s) => s.status !== 'failed');

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Release Milestone</Text>
      <Text style={styles.subtitle}>Escrow: {escrowId}</Text>
      <Text style={styles.subtitle}>Milestone: {milestoneId}</Text>
      {milestone && (
        <Text style={styles.amountLine}>
          {milestone.title} — {milestone.amount} {releaseAsset}
        </Text>
      )}

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
          <TouchableOpacity
            style={styles.primaryBtn}
            onPress={handleRelease}
            disabled={isReauthing}
            accessibilityRole="button"
            accessibilityLabel="Confirm release milestone"
          >
            {isReauthing ? (
              <ActivityIndicator color={colors.onAccent} />
            ) : (
              <Text style={styles.primaryBtnText}>Confirm Release</Text>
            )}
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
  const friendly = toFriendlyError(err);
  // For release-specific context, provide more specific messages
  if (err && typeof err === 'object' && 'response' in err) {
    const axiosErr = err as { response?: { status?: number } };
    if (axiosErr.response?.status === 403) return 'You don\'t have permission to release this milestone.';
    if (axiosErr.response?.status === 402) return 'Insufficient balance to complete this transaction.';
  }
  return friendly.message;
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background, padding: 20 },
  title: { color: colors.text, fontSize: 22, fontWeight: '700', marginBottom: 4 },
  subtitle: { color: colors.textTertiary, fontSize: 13, marginBottom: 4 },
  amountLine: { color: colors.accent, fontSize: 15, fontWeight: '600', marginBottom: 4 },
  stepsCard: { backgroundColor: colors.surface, borderRadius: 14, padding: 16, marginTop: 24, marginBottom: 16 },
  stepRow: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 16 },
  stepCircle: { width: 32, height: 32, borderRadius: 16, backgroundColor: colors.surfaceRaised, alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  stepCircleDone: { backgroundColor: colors.successBright },
  stepCircleActive: { backgroundColor: colors.accent },
  stepCircleFailed: { backgroundColor: colors.danger },
  stepCheck: { color: colors.text, fontWeight: '700', fontSize: 14 },
  stepNum: { color: colors.textTertiary, fontSize: 13 },
  stepInfo: { flex: 1 },
  stepLabel: { color: colors.textSecondary, fontWeight: '500', fontSize: 14 },
  stepLabelActive: { color: colors.text, fontWeight: '700' },
  stepDesc: { color: colors.textTertiary, fontSize: 12, marginTop: 2 },
  hashCard: { backgroundColor: colors.surface, borderRadius: 10, padding: 14, marginBottom: 12 },
  hashLabel: { color: colors.textTertiary, fontSize: 11, marginBottom: 4 },
  hashValue: { color: colors.accent, fontSize: 12, fontFamily: 'monospace' },
  errorCard: { backgroundColor: colors.dangerSurface, borderRadius: 10, padding: 14, borderWidth: 1, borderColor: colors.danger, marginBottom: 12 },
  errorTitle: { color: colors.danger, fontWeight: '700', marginBottom: 4 },
  errorMsg: { color: colors.dangerSoft, fontSize: 13 },
  actions: { marginTop: 8, gap: 12 },
  primaryBtn: { backgroundColor: colors.accent, borderRadius: 12, paddingVertical: 16, alignItems: 'center' },
  primaryBtnText: { color: colors.onAccent, fontWeight: '700', fontSize: 16 },
  secondaryBtn: { backgroundColor: colors.surfaceRaised, borderRadius: 12, paddingVertical: 14, alignItems: 'center' },
  secondaryBtnText: { color: colors.textSecondary, fontWeight: '600' },
  successBanner: { backgroundColor: colors.successSurface, borderRadius: 10, padding: 14, borderWidth: 1, borderColor: colors.successBright, alignItems: 'center' },
  successText: { color: colors.successBright, fontWeight: '600', fontSize: 15 },
});
