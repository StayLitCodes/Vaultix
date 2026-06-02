import React from 'react';
import { View, Text, Switch, StyleSheet } from 'react-native';
import { useBiometricLock } from '../../hooks/useBiometricLock';

export default function SettingsScreen() {
  const { isSupported, isEnrolled, isEnabled, enableBiometric, disableBiometric } = useBiometricLock();

  const handleToggle = async (value: boolean) => {
    if (value) {
      await enableBiometric();
    } else {
      await disableBiometric();
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.header}>Security Settings</Text>

      <View style={styles.settingRow}>
        <View>
          <Text style={styles.settingTitle}>Biometric App Lock</Text>
          <Text style={styles.settingDescription}>
            {!isSupported || !isEnrolled
              ? 'Biometrics not supported or not set up on this device.'
              : 'Require FaceID/TouchID when opening Vaultix'}
          </Text>
        </View>
        <Switch
          value={isEnabled}
          onValueChange={handleToggle}
          disabled={!isSupported || !isEnrolled}
          trackColor={{ false: '#334155', true: '#3B82F6' }}
          thumbColor={isEnabled ? '#ffffff' : '#94A3B8'}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0F172A',
    padding: 16,
  },
  header: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: 24,
  },
  settingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#1E293B',
    padding: 16,
    borderRadius: 8,
  },
  settingTitle: {
    fontSize: 16,
    color: '#FFFFFF',
    fontWeight: '600',
    marginBottom: 4,
  },
  settingDescription: {
    fontSize: 12,
    color: '#94A3B8',
    maxWidth: 200,
  },
});
