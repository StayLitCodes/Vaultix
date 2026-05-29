import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';

export default function HomeScreen() {
  const router = useRouter();
  return (
    <View style={styles.container}>
      <Text style={styles.logo}>🔐 Vaultix</Text>
      <Text style={styles.tagline}>Trustless Escrow on Stellar</Text>
      <TouchableOpacity style={styles.btn} onPress={() => router.push('/wallet/connect')}>
        <Text style={styles.btnText}>Connect Wallet</Text>
      </TouchableOpacity>
      <TouchableOpacity style={styles.btn} onPress={() => router.push('/dashboard')}>
        <Text style={styles.btnText}>Open Dashboard</Text>
      </TouchableOpacity>
      <TouchableOpacity style={[styles.btn, styles.btnSecondary]} onPress={() => router.push('/escrow/create')}>
        <Text style={styles.btnText}>Create Escrow</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#1a1a2e', padding: 24 },
  logo: { fontSize: 40, marginBottom: 8 },
  tagline: { color: '#aaa', fontSize: 16, marginBottom: 40 },
  btn: { backgroundColor: '#6c63ff', borderRadius: 12, paddingVertical: 14, paddingHorizontal: 32, marginBottom: 16, width: '100%', alignItems: 'center' },
  btnSecondary: { backgroundColor: '#2d2d44' },
  btnText: { color: '#fff', fontWeight: '600', fontSize: 16 },
});
