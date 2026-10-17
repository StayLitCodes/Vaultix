/**
 * #315 – Mobile Escrow Detail: milestones, parties, timeline, role-gated actions
 */
import React, { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { escrowApi } from '../../services/api';
import { requireAuth } from '../../services/auth';
import { Escrow, Milestone, Party, EscrowEvent } from '../../types/escrow';
import { OfflineBanner } from '../../components/OfflineBanner';
import StaleDataBadge from '../../components/StaleDataBadge';
import CacheTimestamp from '../../components/CacheTimestamp';
import { cacheEscrowDetail, getCachedEscrowDetail } from '../../services/cache/escrowCache';
import { CopyButton } from '../../components/CopyButton';
import { ShareButton, buildEscrowShareUrl } from '../../components/ShareButton';
import { EscrowQRCode } from '../../components/EscrowQRCode';
import { useNetworkStatus } from '../../hooks/useNetworkStatus';
import { toFriendlyError, isOfflineError } from '../../utils/errors';
import { useDisputes } from '../../hooks/useDisputes';
import { RaiseDisputeModal } from '../../components/RaiseDisputeModal';
import { DisputeDetailsCard } from '../../components/DisputeDetailsCard';
import { ResolutionSummary } from '../../components/ResolutionSummary';
import { colors } from '../../theme';

const CURRENT_USER_ROLE: 'depositor' | 'recipient' | 'arbitrator' = 'depositor';

const STATUS_COLOR: Record<string, string> = {
  created: colors.accent,
  funded: colors.infoAlt,    // mobile alias for contract Active
  active: colors.infoAlt,    // canonical backend value for contract Active
  confirmed: colors.successBright, // client-only transient alias
  released: colors.successBright,
  completed: colors.successBright,
  cancelled: colors.textSecondary,
  disputed: colors.danger,
  resolved: colors.accentSoft,  // contract Resolved terminal state
  expired: colors.warning,
};

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {children}
    </View>
  );
}

function MilestoneRow({ milestone, canRelease, onRelease }: {
  milestone: Milestone;
  canRelease: boolean;
  onRelease: (id: string) => void;
}) {
  const released = milestone.status === 'released';
  // contract MilestoneStatus::Disputed — milestone is frozen under dispute; not releasable
  const disputed = milestone.status === 'disputed';
  // canRelease must explicitly exclude disputed milestones
  const releasable = canRelease && !disputed;
  return (
    <View style={styles.milestoneRow}>
      <View style={styles.milestoneInfo}>
        <Text style={styles.milestoneTitle}>{milestone.title}</Text>
        <Text style={styles.milestoneAmount}>{milestone.amount} XLM</Text>
      </View>
      {released ? (
        <View style={styles.releasedBadge}><Text style={styles.releasedText}>Released</Text></View>
      ) : disputed ? (
        // Disputed milestone: clearly distinct from Pending — not releasable
        <View style={styles.disputedMilestoneBadge}>
          <Text style={styles.disputedMilestoneText}>Disputed</Text>
        </View>
      ) : releasable ? (
        <TouchableOpacity
          style={styles.releaseBtn}
          onPress={() => onRelease(milestone.id)}
          accessibilityRole="button"
          accessibilityLabel={`Release ${milestone.title}`}
        >
          <Text style={styles.releaseBtnText}>Release</Text>
        </TouchableOpacity>
      ) : (
        <View style={styles.pendingBadge}><Text style={styles.pendingText}>Pending</Text></View>
      )}
    </View>
  );
}

function PartyRow({ party }: { party: Party }) {
  return (
    <View style={styles.partyRow}>
      <View style={styles.partyInfo}>
        <Text style={styles.partyRole}>{party.role.toUpperCase()}</Text>
        <Text style={styles.partyAddress} numberOfLines={1}>{party.walletAddress}</Text>
        <Text style={[styles.partyStatus, party.status === 'accepted' && { color: colors.successBright }]}>
          {party.status}
        </Text>
      </View>
      <CopyButton value={party.walletAddress} label="Copy" compact />
    </View>
  );
}

function TimelineItem({ event }: { event: EscrowEvent }) {
  return (
    <View style={styles.timelineItem}>
      <View style={styles.timelineDot} />
      <View style={styles.timelineContent}>
        <Text style={styles.timelineEvent}>{event.eventType.replace(/_/g, ' ')}</Text>
        <Text style={styles.timelineDate}>{new Date(event.createdAt).toLocaleString()}</Text>
      </View>
    </View>
  );
}

function DetailSkeleton() {
  return (
    <View style={styles.container}>
      <View style={styles.content}>
        <View style={styles.skeletonHeader} />
        <View style={styles.skeletonLine} />
        <View style={[styles.skeletonLine, { width: '60%' }]} />
        <View style={styles.skeletonRow}>
          <View style={styles.skeletonBox} />
          <View style={styles.skeletonBox} />
        </View>
        <View style={styles.skeletonSection} />
        <View style={styles.skeletonCard} />
        <View style={styles.skeletonCard} />
      </View>
    </View>
  );
}

export default function EscrowDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [escrow, setEscrow] = useState<Escrow | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<{ title: string; message: string } | null>(null);
  const { isOffline, markOffline, markOnline } = useNetworkStatus();
  const [isDisputeModalVisible, setDisputeModalVisible] = useState(false);
  const [isQrVisible, setQrVisible] = useState(false);
  const { dispute, raiseDispute, hasActiveDispute, isSubmitting } = useDisputes(id);
  const [isStale, setIsStale] = useState(false);
  const [cacheUpdatedAt, setCacheUpdatedAt] = useState<number>();

  const load = useCallback(async () => {
    if (!id) return;
    try {
      setError(null);
      const data = await escrowApi.getById(id);
      setEscrow(data);
      // Surface the cache staleness the offline layer already tracks (#697).
      // A cache write failure must never turn a successful load into an error.
      try {
        await cacheEscrowDetail(id, data);
        setIsStale(false);
        setCacheUpdatedAt(Date.now());
      } catch {
        // Keep the freshly fetched data on screen; caching is best-effort.
      }
      markOnline();
    } catch (err) {
      const friendly = toFriendlyError(err);
      if (isOfflineError(err)) {
        // Offline: fall back to the cached copy when we have one, and flag it
        // as stale rather than showing a dead-end error screen.
        const cached = await getCachedEscrowDetail(id).catch(() => null);
        if (cached?.data) {
          setEscrow(cached.data as Escrow);
          setIsStale(cached.stale);
          setCacheUpdatedAt(cached.updatedAt);
          markOffline();
          return;
        }
      }
      setError({ title: friendly.title, message: friendly.message });
      if (isOfflineError(err)) markOffline();
    } finally {
      setLoading(false);
    }
  }, [id, markOnline, markOffline]);

  useEffect(() => {
    if (!id) return;
    if (!requireAuth(router, { pathname: '/escrow/[id]', params: { id } })) return;
    load();
  }, [id, load, router]);

  const handleRelease = useCallback((milestoneId: string) => {
    router.push({ pathname: '/escrow/release', params: { escrowId: id, milestoneId } });
  }, [id, router]);

  if (loading) {
    return <DetailSkeleton />;
  }
  if (error || !escrow) {
    return (
      <View style={styles.root}>
        <OfflineBanner visible={isOffline} />
        <View style={styles.center}>
          <Text style={styles.errorEmoji}>⚠️</Text>
          <Text style={styles.errorTitle}>{error?.title ?? 'Not found'}</Text>
          <Text style={styles.errorMessage}>{error?.message ?? 'Escrow not found.'}</Text>
          <TouchableOpacity style={styles.retryBtn} onPress={load}>
            <Text style={styles.retryText}>Retry</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  const statusColor = STATUS_COLOR[escrow.status] || colors.textSecondary;
  // The contract reports `Active` which the backend serialises as `'active'`.
  // Legacy mobile aliases `'funded'` and `'confirmed'` are also accepted for
  // backwards-compatibility (see types/escrow.ts STATUS_MAPPING comment).
  const isActiveEscrow = ['active', 'funded', 'confirmed'].includes(escrow.status);
  const canReleaseMilestones =
    CURRENT_USER_ROLE === 'depositor' &&
    isActiveEscrow &&
    !hasActiveDispute;

  return (
    <View style={styles.root}>
      <OfflineBanner visible={isOffline} />
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <Text style={styles.title}>{escrow.title}</Text>
        <View style={[styles.statusBadge, { backgroundColor: statusColor + '22', borderColor: statusColor }]}>
          <Text style={[styles.statusText, { color: statusColor }]}>{escrow.status.toUpperCase()}</Text>
        </View>
      </View>
      <StaleDataBadge stale={isStale} />
      <CacheTimestamp timestamp={cacheUpdatedAt} />
      <Text style={styles.description}>{escrow.description}</Text>

      <View style={styles.shareRow}>
        <CopyButton value={escrow.id} label="Copy Escrow ID" toastMessage="Escrow ID copied!" variant="ghost" />
        <ShareButton url={buildEscrowShareUrl(escrow.id)} label="Share Escrow" variant="primary" />
        <TouchableOpacity
          style={styles.qrButton}
          onPress={() => setQrVisible(true)}
          accessibilityRole="button"
          accessibilityLabel="Show escrow QR code"
        >
          <Text style={styles.qrButtonText}>QR</Text>
        </TouchableOpacity>
      </View>

      <Modal
        visible={isQrVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setQrVisible(false)}
      >
        <View style={styles.qrBackdrop}>
          <View style={styles.qrCard}>
            <Text style={styles.qrTitle}>Share Escrow QR</Text>
            <EscrowQRCode escrowId={escrow.id} />
            <TouchableOpacity
              style={styles.qrCloseButton}
              onPress={() => setQrVisible(false)}
              accessibilityRole="button"
              accessibilityLabel="Close escrow QR code"
            >
              <Text style={styles.qrCloseText}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <View style={styles.metaRow}>
        <View style={styles.metaItem}>
          <Text style={styles.metaLabel}>Amount</Text>
          <Text style={styles.metaValue}>{escrow.amount} {escrow.asset}</Text>
        </View>
        <View style={styles.metaItem}>
          <Text style={styles.metaLabel}>Deadline</Text>
          <Text style={styles.metaValue}>{new Date(escrow.deadline).toLocaleDateString()}</Text>
        </View>
      </View>

      {dispute && (
        <Section title="Dispute Information">
          <DisputeDetailsCard status={dispute.status} reason={dispute.reason} />
          <ResolutionSummary dispute={dispute} />
        </Section>
      )}

      {escrow.milestones && escrow.milestones.length > 0 && (
        <Section title="Milestones">
          {escrow.milestones.map((m) => (
            <MilestoneRow
              key={m.id}
              milestone={m}
              canRelease={canReleaseMilestones}
              onRelease={handleRelease}
            />
          ))}
        </Section>
      )}

      {escrow.parties && escrow.parties.length > 0 && (
        <Section title="Parties">
          {escrow.parties.map((p) => <PartyRow key={p.id} party={p} />)}
        </Section>
      )}

      {escrow.events && escrow.events.length > 0 && (
        <Section title="Activity Timeline">
          {escrow.events.map((e) => <TimelineItem key={e.id} event={e} />)}
        </Section>
      )}

      <Section title="Actions">
        {escrow.status === 'disputed' && CURRENT_USER_ROLE === 'arbitrator' && (
          <TouchableOpacity style={[styles.actionBtn, { backgroundColor: colors.danger }]}>
            <Text style={styles.actionBtnText}>Resolve Dispute</Text>
          </TouchableOpacity>
        )}
        {escrow.status === 'created' && CURRENT_USER_ROLE === 'depositor' && (
          <TouchableOpacity style={[styles.actionBtn, { backgroundColor: colors.infoAlt }]}>
            <Text style={styles.actionBtnText}>Fund Escrow</Text>
          </TouchableOpacity>
        )}
        {/* Raise dispute available when escrow is in any active variant and user is depositor */}
        {isActiveEscrow && CURRENT_USER_ROLE === 'depositor' && !hasActiveDispute && (
          <TouchableOpacity
            style={[styles.actionBtn, { backgroundColor: colors.dangerSurface, borderWidth: 1, borderColor: colors.danger }]}
            onPress={() => setDisputeModalVisible(true)}
          >
            <Text style={[styles.actionBtnText, { color: colors.danger }]}>Raise Dispute</Text>
          </TouchableOpacity>
        )}
        {/* resolved is a terminal state: show the resolution summary instead of generic "no actions" */}
        {escrow.status === 'resolved' && (
          <Text style={[styles.noActions, { color: colors.accentSoft }]}>
            This escrow has been resolved. See the Dispute Information section above.
          </Text>
        )}
        {!['disputed', 'created', 'active', 'funded', 'confirmed', 'resolved'].includes(escrow.status) && (
          <Text style={styles.noActions}>No actions available for this status.</Text>
        )}
      </Section>

      <RaiseDisputeModal
        visible={isDisputeModalVisible}
        onClose={() => setDisputeModalVisible(false)}
        onSubmit={async (reason, description, evidence) => {
          const res = await raiseDispute(escrow.id, reason, description, evidence);
          if (res.success) {
            setDisputeModalVisible(false);
            load();
          } else {
            // Keep the modal open so the user can retry
            Alert.alert(res.error.title, res.error.message);
          }
        }}
        isSubmitting={isSubmitting}
        escrowId={escrow.id}
      />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: 16, paddingBottom: 40 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 },
  title: { color: colors.text, fontSize: 20, fontWeight: '700', flex: 1, marginRight: 8 },
  statusBadge: { borderRadius: 8, borderWidth: 1, paddingHorizontal: 10, paddingVertical: 4 },
  statusText: { fontSize: 11, fontWeight: '700' },
  description: { color: colors.textSecondary, fontSize: 14, marginBottom: 16, lineHeight: 20 },
  metaRow: { flexDirection: 'row', gap: 16, marginBottom: 8 },
  metaItem: { flex: 1, backgroundColor: colors.surface, borderRadius: 10, padding: 12 },
  metaLabel: { color: colors.textTertiary, fontSize: 11, marginBottom: 4 },
  metaValue: { color: colors.text, fontWeight: '600', fontSize: 15 },
  section: { marginTop: 20 },
  sectionTitle: { color: colors.text, fontSize: 16, fontWeight: '700', marginBottom: 10 },
  milestoneRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: colors.surface, borderRadius: 10, padding: 12, marginBottom: 8 },
  milestoneInfo: { flex: 1, marginRight: 8 },
  milestoneTitle: { color: colors.text, fontWeight: '600', fontSize: 14 },
  milestoneAmount: { color: colors.textTertiary, fontSize: 12, marginTop: 2 },
  releasedBadge: { backgroundColor: colors.successSurface, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 4 },
  releasedText: { color: colors.successBright, fontSize: 12, fontWeight: '600' },
  releaseBtn: { backgroundColor: colors.accent, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 6 },
  releaseBtnText: { color: colors.onAccent, fontWeight: '600', fontSize: 13 },
  pendingBadge: { backgroundColor: colors.surfaceRaised, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 4 },
  pendingText: { color: colors.textSecondary, fontSize: 12 },
  disputedMilestoneBadge: { backgroundColor: colors.dangerSurface, borderRadius: 6, borderWidth: 1, borderColor: colors.danger, paddingHorizontal: 8, paddingVertical: 4 },
  disputedMilestoneText: { color: colors.danger, fontSize: 12, fontWeight: '600' },
  partyRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.surface, borderRadius: 10, padding: 12, marginBottom: 8 },
  partyInfo: { flex: 1, marginRight: 8 },
  partyRole: { color: colors.accent, fontWeight: '700', fontSize: 12 },
  partyAddress: { color: colors.text, fontSize: 14, marginTop: 2 },
  partyStatus: { color: colors.textTertiary, fontSize: 12, marginTop: 2 },
  timelineItem: { flexDirection: 'row', marginBottom: 10 },
  timelineDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.accent, marginTop: 5, marginRight: 10 },
  timelineContent: { flex: 1 },
  timelineEvent: { color: colors.text, fontSize: 14, fontWeight: '500' },
  timelineDate: { color: colors.textTertiary, fontSize: 12, marginTop: 2 },
  skeletonHeader: { height: 22, backgroundColor: colors.surfaceRaised, borderRadius: 4, marginBottom: 12, width: '60%' },
  skeletonLine: { height: 12, backgroundColor: colors.surfaceRaised, borderRadius: 4, marginBottom: 8, width: '90%' },
  skeletonRow: { flexDirection: 'row', gap: 12, marginBottom: 12 },
  skeletonBox: { flex: 1, height: 70, backgroundColor: colors.surface, borderRadius: 10 },
  skeletonSection: { height: 16, backgroundColor: colors.surfaceRaised, borderRadius: 4, marginVertical: 16, width: '40%' },
  skeletonCard: { height: 90, backgroundColor: colors.surface, borderRadius: 10, marginBottom: 12 },
  errorEmoji: { fontSize: 36, marginBottom: 8 },
  errorTitle: { color: colors.danger, fontSize: 16, fontWeight: '700', marginBottom: 6, textAlign: 'center' },
  errorMessage: { color: colors.textSecondary, fontSize: 13, textAlign: 'center', lineHeight: 18, marginBottom: 16 },
  retryBtn: { backgroundColor: colors.accent, borderRadius: 10, paddingHorizontal: 24, paddingVertical: 10 },
  retryText: { color: colors.onAccent, fontWeight: '600' },
  shareRow: { flexDirection: 'row', gap: 8, marginBottom: 16 },
  actionBtn: { borderRadius: 10, paddingVertical: 14, alignItems: 'center', justifyContent: 'center', marginBottom: 10 },
  actionBtnText: { color: colors.onAccent, fontWeight: '600', fontSize: 15 },
  noActions: { color: colors.textTertiary, fontSize: 14, textAlign: 'center', marginTop: 8 },
});
