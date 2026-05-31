import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';

interface MobileLockScreenProps {
  onUnlock: () => void;
  onDisableFallback: () => void;
}

export const MobileLockScreen: React.FC<MobileLockScreenProps> = ({ onUnlock, onDisableFallback }) => {
  return (
    <View style={styles.container}>
      <View style={styles.iconContainer}>
        <Text style={styles.icon}>🔒</Text>
      </View>
      <Text style={styles.title}>App Locked</Text>
      <Text style={styles.subtitle}>Unlock to access your secure Vaultix session.</Text>

      <TouchableOpacity style={styles.unlockButton} onPress={onUnlock}>
        <Text style={styles.unlockButtonText}>Unlock with Biometrics</Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.fallbackButton} onPress={onDisableFallback}>
        <Text style={styles.fallbackButtonText}>Disable Biometric Lock</Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#0F172A', // dark theme background
    padding: 24,
  },
  iconContainer: {
    marginBottom: 24,
  },
  icon: {
    fontSize: 64,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: 12,
  },
  subtitle: {
    fontSize: 16,
    color: '#94A3B8',
    textAlign: 'center',
    marginBottom: 48,
  },
  unlockButton: {
    backgroundColor: '#3B82F6',
    paddingVertical: 14,
    paddingHorizontal: 32,
    borderRadius: 8,
    width: '100%',
    alignItems: 'center',
    marginBottom: 16,
  },
  unlockButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  fallbackButton: {
    paddingVertical: 14,
    paddingHorizontal: 32,
    width: '100%',
    alignItems: 'center',
  },
  fallbackButtonText: {
    color: '#94A3B8',
    fontSize: 16,
  },
});
