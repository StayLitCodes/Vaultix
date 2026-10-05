import React from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Linking,
} from 'react-native';
import { colors } from '../theme';

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
      <View style={styles.container} accessibilityViewIsModal>
        <Text style={styles.icon} importantForAccessibility="no" accessibilityElementsHidden>🛡️</Text>

        <Text style={styles.title} accessibilityRole="header">
          {forceUpdate ? 'Update Required' : 'Update Available'}
        </Text>

        <Text style={styles.subtitle}>
          {forceUpdate
            ? `Version ${latestVersion} is required to continue using Vaultix. Please update the app.`
            : `Version ${latestVersion} of Vaultix is now available. Update for the latest features and security fixes.`}
        </Text>

        <TouchableOpacity
          style={styles.updateButton}
          onPress={handleUpdate}
          accessibilityRole="button"
          accessibilityLabel={`Update Vaultix to version ${latestVersion}`}
          accessibilityHint={
            forceUpdate
              ? 'Opens the app store. This update is required to keep using Vaultix'
              : 'Opens the app store to install the update'
          }
        >
          <Text style={styles.updateButtonText}>Update Now</Text>
        </TouchableOpacity>

        {!forceUpdate && (
          <TouchableOpacity
            style={styles.laterButton}
            onPress={onDismiss}
            accessibilityRole="button"
            accessibilityLabel="Update later"
            accessibilityHint="Dismisses this prompt and continues to Vaultix"
          >
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
    backgroundColor: colors.background,
    padding: 24,
  },
  icon: {
    fontSize: 64,
    marginBottom: 24,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: colors.text,
    marginBottom: 12,
  },
  subtitle: {
    fontSize: 16,
    color: colors.textSecondary,
    textAlign: 'center',
    marginBottom: 48,
    lineHeight: 24,
  },
  updateButton: {
    backgroundColor: colors.infoStrong,
    paddingVertical: 14,
    paddingHorizontal: 32,
    borderRadius: 8,
    width: '100%',
    alignItems: 'center',
    marginBottom: 16,
  },
  updateButtonText: {
    color: colors.text,
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
    color: colors.textSecondary,
    fontSize: 16,
  },
});
