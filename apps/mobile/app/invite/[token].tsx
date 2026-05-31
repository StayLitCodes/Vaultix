/**
 * Deep link target: invitation acceptance
 * Supports authenticated users and redirects via welcome screen when needed.
 */
import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { inviteApi } from '../../services/api';
import { requireAuth } from '../../services/auth';

interface InviteValidation {
  escrowId: string;
  role: string;
  sender: string;
  expiresAt: string;
}

export default function InvitationAcceptScreen() {
  const { token } = useLocalSearchParams<{ token: string }>();
  const router = useRouter();
  const [invite, setInvite] = useState<InviteValidation | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [accepting, setAccepting] = useState(false);

  useEffect(() => {
    if (!token) {
      setError('This invitation link is invalid.');
      setLoading(false);
      return;
    }

    if (!requireAuth(router, { pathname: '/invite/[token]', params: { token } })) {
      return;
    }

    const loadInvite = async () => {
      try {
        setLoading(true);
        setError(null);
        const validation = await inviteApi.validateToken(token);
        setInvite(validation);
      } catch {
        setError('This invitation link is invalid or has expired.');
      } finally {
        setLoading(false);
      }
    };

    loadInvite();
  }, [router, token]);

  const handleAccept = useCallback(async () => {
    if (!token) return;
    setAccepting(true);

    try {
      const accepted = await inviteApi.acceptInvitation(token);
      Alert.alert('Invitation Accepted', 'You have been added to the escrow.', [
        {
          text: 'View Escrow',
          onPress: () => router.replace({ pathname: '/escrow/[id]', params: { id: accepted.escrowId } }),
        },
      ]);
    } catch {
      Alert.alert('Unable to Accept', 'This invitation could not be accepted. Please try again later.');
    } finally {
      setAccepting(false);
    }
  }, [router, token]);

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color="#6c63ff" size="large" />
        <Text style={styles.message}>Validating invitation…</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorTitle}>Invitation Not Found</Text>
        <Text style={styles.errorText}>{error}</Text>
        <TouchableOpacity style={styles.button} onPress={() => router.replace('/')}>
          <Text style={styles.buttonText}>Back to Welcome</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Invite to Join Escrow</Text>
      <Text style={styles.subtitle}>You have been invited as a {invite?.role}.</Text>
      <View style={styles.card}>
        <Text style={styles.cardLabel}>Escrow ID</Text>
        <Text style={styles.cardValue}>{invite?.escrowId}</Text>
        <Text style={styles.cardLabel}>Sender</Text>
        <Text style={styles.cardValue}>{invite?.sender}</Text>
        <Text style={styles.cardLabel}>Expires</Text>
        <Text style={styles.cardValue}>{new Date(invite?.expiresAt ?? '').toLocaleString()}</Text>
      </View>

      <TouchableOpacity
        style={[styles.button, accepting && styles.buttonDisabled]}
        onPress={handleAccept}
        disabled={accepting}
      >
        {accepting ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Accept Invitation</Text>}
      </TouchableOpacity>

      <TouchableOpacity style={styles.secondaryButton} onPress={() => router.replace('/')}>
        <Text style={styles.secondaryButtonText}>Not now</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#12121f' },
  content: { padding: 24, paddingTop: 40 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#12121f', padding: 24 },
  title: { color: '#fff', fontSize: 26, fontWeight: '800', marginBottom: 10 },
  subtitle: { color: '#888', fontSize: 15, marginBottom: 24 },
  message: { color: '#888', fontSize: 15, marginTop: 16, textAlign: 'center' },
  card: { backgroundColor: '#1e1e30', borderRadius: 16, padding: 18, marginBottom: 24 },
  cardLabel: { color: '#888', fontSize: 12, textTransform: 'uppercase', marginBottom: 4 },
  cardValue: { color: '#fff', fontSize: 15, marginBottom: 12 },
  button: { backgroundColor: '#6c63ff', borderRadius: 14, paddingVertical: 16, alignItems: 'center', marginBottom: 12 },
  buttonDisabled: { opacity: 0.65 },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  secondaryButton: { alignItems: 'center', paddingVertical: 12 },
  secondaryButtonText: { color: '#888', fontSize: 14 },
  errorTitle: { color: '#fff', fontSize: 22, fontWeight: '700', marginBottom: 12, textAlign: 'center' },
  errorText: { color: '#ef476f', fontSize: 14, lineHeight: 20, textAlign: 'center', marginBottom: 24 },
});
