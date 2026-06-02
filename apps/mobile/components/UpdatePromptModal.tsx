import React from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Linking,
} from 'react-native';

interface UpdatePromptModalProps {
  visible: boolean;
  forceUpdate: boolean;
  latestVersion: string;
  updateUrl: string;
  onDismiss: () => void;
}

export const UpdatePromptModal: React.FC<UpdatePromptModalProps> = ({
  visible,
  forceUpdate,
  latestVersion,
  updateUrl,
  onDismiss,
}) => {
  const handleUpdate = () => {
    Linking.openURL(updateUrl);
  };

  return (
    <Modal
      visible={visible}
      transparent={false}
      animationType="fade"
      onRequestClose={forceUpdate ? () => {} : onDismiss}
    >
      <View style={styles.container}>
        <Text style={styles.icon}>🛡️</Text>

        <Text style={styles.title}>
          {forceUpdate ? 'Update Required' : 'Update Available'}
        </Text>

        <Text style={styles.subtitle}>
          {forceUpdate
            ? `Version ${latestVersion} is required to continue using Vaultix. Please update the app.`
            : `Version ${latestVersion} of Vaultix is now available. Update for the latest features and security fixes.`}
        </Text>

        <TouchableOpacity style={styles.updateButton} onPress={handleUpdate}>
          <Text style={styles.updateButtonText}>Update Now</Text>
        </TouchableOpacity>

        {!forceUpdate && (
          <TouchableOpacity style={styles.laterButton} onPress={onDismiss}>
            <Text style={styles.laterButtonText}>Later</Text>
          </TouchableOpacity>
        )}
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#0F172A',
    padding: 24,
  },
  icon: {
    fontSize: 64,
    marginBottom: 24,
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
    lineHeight: 24,
  },
  updateButton: {
    backgroundColor: '#3B82F6',
    paddingVertical: 14,
    paddingHorizontal: 32,
    borderRadius: 8,
    width: '100%',
    alignItems: 'center',
    marginBottom: 16,
  },
  updateButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  laterButton: {
    paddingVertical: 14,
    paddingHorizontal: 32,
    width: '100%',
    alignItems: 'center',
  },
  laterButtonText: {
    color: '#94A3B8',
    fontSize: 16,
  },
});
