import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useRouter } from 'expo-router';

export default function NotFoundScreen() {
  const router = useRouter();

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Sorry, that page could not be found.</Text>
      <Text style={styles.message}>The link you followed appears to be invalid or no longer exists.</Text>
      <TouchableOpacity style={styles.button} onPress={() => router.replace('/')}> 
        <Text style={styles.buttonText}>Return to Welcome</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, backgroundColor: '#12121f' },
  title: { color: '#fff', fontSize: 24, fontWeight: '700', marginBottom: 12, textAlign: 'center' },
  message: { color: '#888', fontSize: 16, textAlign: 'center', marginBottom: 24, lineHeight: 22 },
  button: { backgroundColor: '#6c63ff', borderRadius: 14, paddingVertical: 16, paddingHorizontal: 32 },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '700' },
});
