/**
 * #315 – Mobile Escrow Detail: milestones, parties, timeline, role-gated actions
 */
import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
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
<<<<<<< HEAD
import { OfflineBanner } from '../../components/OfflineBanner';
import { CopyButton } from '../../components/CopyButton';
import { ShareButton, buildEscrowShareUrl } from '../../components/ShareButton';
import { useNetworkStatus } from '../../hooks/useNetworkStatus';
import { toFriendlyError, isOfflineError } from '../../utils/errors';
=======
import { useDisputes } from '../../hooks/useDisputes';
import { RaiseDisputeModal } from '../../components/RaiseDisputeModal';
import { DisputeDetailsCard } from '../../components/DisputeDetailsCard';
import { ResolutionSummary } from '../../components/ResolutionSummary';
>>>>>>> d431ba40ce53cfcf510d9b702e2540ee53b1f9f1

// Simulated current user role – in production this comes from auth context
const CURRENT_USER_ROLE: 'depositor' | 'recipient' | 'arbitrator' = 'depositor';

const STATUS_COLOR: Record<string, string> = {
  created: '#6c63ff', funded: '#00b4d8', confirmed: '#06d6a0',
  released: '#06d6a0', completed: '#06d6a0', cancelled: '#aaa',
  disputed: '#ef476f', expired: '#f77f00',
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
  return (
    <View style={styles.milestoneRow}>
      <View style={styles.milestoneInfo}>
        <Text style={styles.milestoneTitle}>{milestone.title}</Text>
        <Text style={styles.milestoneAmount}>{milestone.amount} XLM</Text>
      </View>
      {released ? (
        <View style={styles.releasedBadge}><Text style={styles.releasedText}>✓ Released</Text></View>
      ) : canRelease ? (
        <TouchableOpacity
          style={styles.releaseBtn}
          onPress={() => onRelease(milestone.id)}
          accessibilityRole="button"
          accessibilityLabel={`Release milestone ${milestone.title}`}
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
        <Text style={[styles.partyStatus, party.status === 'accepted' && { color: '#06d6a0' }]}>
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
<<<<<<< HEAD
  const [error, setError] = useState<{ title: string; message: string } | null>(null);
  const { isOffline, markOffline, markOnline } = useNetworkStatus();
=======
  const [error, setError] = useState<string | null>(null);
  const [isDisputeModalVisible, setDisputeModalVisible] = useState(false);
  const { dispute, raiseDispute, hasActiveDispute, isSubmitting } = useDisputes();
>>>>>>> d431ba40ce53cfcf510d9b702e2540ee53b1f9f1

  const load = useCallback(async () => {
    if (!id) return;
    try {
      setError(null);
      const data = await escrowApi.getById(id);
      setEscrow(data);
      markOnline();
    } catch (err) {
      const friendly = toFriendlyError(err);
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

  const statusColor = STATUS_COLOR[escrow.status] ?? '#aaa';
  // Role-gated: only depositor can release milestones when escrow is funded/confirmed
  const canReleaseMilestones =
    CURRENT_USER_ROLE === 'depositor' &&
    ['funded', 'confirmed'].includes(escrow.status) &&
    !hasActiveDispute;

  return (
    <View style={styles.root}>
      <OfflineBanner visible={isOffline} />
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>{escrow.title}</Text>
        <View style={[styles.statusBadge, { backgroundColor: statusColor + '22', borderColor: statusColor }]}>
          <Text style={[styles.statusText, { color: statusColor }]}>{escrow.status.toUpperCase()}</Text>
        </View>
      </View>
      <Text style={styles.description}>{escrow.description}</Text>

      {/* Share & Copy row */}
      <View style={styles.shareRow}>
        <CopyButton value={escrow.id} label="Copy Escrow ID" toastMessage="Escrow ID copied!" variant="ghost" />
        <ShareButton url={buildEscrowShareUrl(escrow.id)} label="Share Escrow" variant="primary" />
      </View>

      {/* Amount & Deadline */}
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

      {/* Milestones */}
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

      {/* Parties */}
      {escrow.parties && escrow.parties.length > 0 && (
        <Section title="Parties">
          {escrow.parties.map((p) => <PartyRow key={p.id} party={p} />)}
        </Section>
      )}

      {/* Timeline */}
      {escrow.events && escrow.events.length > 0 && (
        <Section title="Activity Timeline">
          {escrow.events.map((e) => <TimelineItem key={e.id} event={e} />)}
        </Section>
      )}

      {/* Role-gated actions */}
      <Section title="Actions">
        {escrow.status === 'disputed' && CURRENT_USER_ROLE === 'arbitrator' && (
          <TouchableOpacity style={[styles.actionBtn, { backgroundColor: '#ef476f' }]}>
            <Text style={styles.actionBtnText}>Resolve Dispute</Text>
          </TouchableOpacity>
        )}
        {escrow.status === 'created' && CURRENT_USER_ROLE === 'depositor' && (
          <TouchableOpacity style={[styles.actionBtn, { backgroundColor: '#00b4d8' }]}>
            <Text style={styles.actionBtnText}>Fund Escrow</Text>
          </TouchableOpacity>
        )}
        {['funded', 'confirmed'].includes(escrow.status) && CURRENT_USER_ROLE === 'depositor' && !hasActiveDispute && (
          <TouchableOpacity 
            style={[styles.actionBtn, { backgroundColor: '#ef476f22', borderWidth: 1, borderColor: '#ef476f' }]}
            onPress={() => setDisputeModalVisible(true)}
          >
            <Text style={[styles.actionBtnText, { color: '#ef476f' }]}>Raise Dispute</Text>
          </TouchableOpacity>
        )}
        {!['disputed', 'created', 'funded', 'confirmed'].includes(escrow.status) && (
          <Text style={styles.noActions}>No actions available for this status.</Text>
        )}
      </Section>
<<<<<<< HEAD
      </ScrollView>
    </View>
=======

      <RaiseDisputeModal
        visible={isDisputeModalVisible}
        onClose={() => setDisputeModalVisible(false)}
        onSubmit={async (reason, description) => {
          const res = await raiseDispute(escrow.id, reason, description);
          if (res.success) {
            setDisputeModalVisible(false);
          }
        }}
        isSubmitting={isSubmitting}
      />
    </ScrollView>
>>>>>>> d431ba40ce53cfcf510d9b702e2540ee53b1f9f1
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#12121f' },
  container: { flex: 1, backgroundColor: '#12121f' },
  content: { padding: 16, paddingBottom: 40 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#12121f' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 },
  title: { color: '#fff', fontSize: 20, fontWeight: '700', flex: 1, marginRight: 8 },
  statusBadge: { borderRadius: 8, borderWidth: 1, paddingHorizontal: 10, paddingVertical: 4 },
  statusText: { fontSize: 11, fontWeight: '700' },
  description: { color: '#aaa', fontSize: 14, marginBottom: 16, lineHeight: 20 },
  metaRow: { flexDirection: 'row', gap: 16, marginBottom: 8 },
  metaItem: { flex: 1, backgroundColor: '#1e1e30', borderRadius: 10, padding: 12 },
  metaLabel: { color: '#888', fontSize: 11, marginBottom: 4 },
  metaValue: { color: '#fff', fontWeight: '600', fontSize: 15 },
  section: { marginTop: 20 },
  sectionTitle: { color: '#6c63ff', fontWeight: '700', fontSize: 13, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 10 },
  milestoneRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#1e1e30', borderRadius: 10, padding: 12, marginBottom: 8 },
  milestoneInfo: { flex: 1 },
  milestoneTitle: { color: '#fff', fontWeight: '500', fontSize: 14 },
  milestoneAmount: { color: '#6c63ff', fontSize: 13, marginTop: 2 },
  releaseBtn: { backgroundColor: '#6c63ff', borderRadius: 8, paddingHorizontal: 14, paddingVertical: 8 },
  releaseBtnText: { color: '#fff', fontWeight: '600', fontSize: 13 },
  releasedBadge: { backgroundColor: '#06d6a022', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6 },
  releasedText: { color: '#06d6a0', fontSize: 12, fontWeight: '600' },
  pendingBadge: { backgroundColor: '#2d2d44', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6 },
  pendingText: { color: '#888', fontSize: 12 },
  partyRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#1e1e30', borderRadius: 10, padding: 12, marginBottom: 8 },
  partyInfo: { flexDirection: 'row', alignItems: 'center', flex: 1, gap: 4 },
  partyRole: { color: '#6c63ff', fontWeight: '700', fontSize: 11, width: 80 },
  partyAddress: { color: '#ccc', fontSize: 12, flex: 1 },
  partyStatus: { color: '#888', fontSize: 11, marginLeft: 8 },
  shareRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 12, gap: 8 },
  timelineItem: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 12 },
  timelineDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: '#6c63ff', marginTop: 4, marginRight: 12 },
  timelineContent: { flex: 1 },
  timelineEvent: { color: '#fff', fontSize: 13, fontWeight: '500' },
  timelineDate: { color: '#888', fontSize: 11, marginTop: 2 },
  actionBtn: { borderRadius: 12, paddingVertical: 14, alignItems: 'center', marginBottom: 10 },
  actionBtnText: { color: '#fff', fontWeight: '600', fontSize: 15 },
  noActions: { color: '#888', fontSize: 13, textAlign: 'center', paddingVertical: 8 },
  errorEmoji: { fontSize: 36, marginBottom: 8 },
  errorTitle: { color: '#ef476f', fontSize: 16, fontWeight: '700', marginBottom: 6, textAlign: 'center' },
  errorMessage: { color: '#aaa', fontSize: 13, textAlign: 'center', lineHeight: 18, marginBottom: 16 },
  retryBtn: { backgroundColor: '#6c63ff', borderRadius: 10, paddingHorizontal: 24, paddingVertical: 12 },
  retryText: { color: '#fff', fontWeight: '600' },
  // Skeleton styles
  skeletonHeader: { height: 24, backgroundColor: '#2d2d44', borderRadius: 6, marginBottom: 12, width: '70%' },
  skeletonLine: { height: 14, backgroundColor: '#2d2d44', borderRadius: 4, marginBottom: 8, width: '90%' },
  skeletonRow: { flexDirection: 'row', gap: 12, marginBottom: 16 },
  skeletonBox: { flex: 1, height: 60, backgroundColor: '#2d2d44', borderRadius: 10 },
  skeletonSection: { height: 14, backgroundColor: '#2d2d44', borderRadius: 4, marginTop: 20, marginBottom: 12, width: '40%' },
  skeletonCard: { height: 48, backgroundColor: '#2d2d44', borderRadius: 10, marginBottom: 8 },
});
