import React, { useState } from 'react';
import { Modal, View, Text, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';

interface RaiseDisputeModalProps {
  visible: boolean;
  onClose: () => void;
  onSubmit: (reason: string, description: string) => Promise<void>;
  isSubmitting: boolean;
}

export const RaiseDisputeModal: React.FC<RaiseDisputeModalProps> = ({ visible, onClose, onSubmit, isSubmitting }) => {
  const [reason, setReason] = useState('');
  const [description, setDescription] = useState('');

  const handleSumbit = () => {
    if (reason && description) {
      onSubmit(reason, description);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide">
      <View style={styles.overlay}>
        <View style={styles.modalContent}>
          <Text style={styles.title}>Raise a Dispute</Text>
          
          <View style={styles.warningBox}>
            <Text style={styles.warningText}>
              Opening a dispute pauses escrow actions until resolved by an admin.
            </Text>
          </View>

          <Text style={styles.label}>Reason</Text>
          <TextInput
            style={styles.input}
            placeholder="e.g. Non-delivery, Quality issue"
            placeholderTextColor="#64748B"
            value={reason}
            onChangeText={setReason}
          />

          <Text style={styles.label}>Description</Text>
          <TextInput
            style={[styles.input, styles.textArea]}
            placeholder="Provide details..."
            placeholderTextColor="#64748B"
            multiline
            numberOfLines={4}
            value={description}
            onChangeText={setDescription}
          />

          <View style={styles.actions}>
            <TouchableOpacity style={styles.cancelButton} onPress={onClose} disabled={isSubmitting}>
              <Text style={styles.cancelText}>Cancel</Text>
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={[styles.submitButton, (!reason || !description || isSubmitting) && styles.disabledButton]} 
              onPress={handleSumbit}
              disabled={!reason || !description || isSubmitting}
            >
              {isSubmitting ? <ActivityIndicator color="#FFF" /> : <Text style={styles.submitText}>Submit</Text>}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#1E293B',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    padding: 24,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#FFF',
    marginBottom: 16,
  },
  warningBox: {
    backgroundColor: '#451A03', // Dark orange/amber
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
  },
  warningText: {
    color: '#FDE047',
    fontSize: 14,
  },
  label: {
    color: '#94A3B8',
    marginBottom: 8,
    fontWeight: '600',
  },
  input: {
    backgroundColor: '#0F172A',
    color: '#FFF',
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
  },
  textArea: {
    height: 100,
    textAlignVertical: 'top',
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: 8,
  },
  cancelButton: {
    padding: 12,
    marginRight: 16,
  },
  cancelText: {
    color: '#94A3B8',
    fontWeight: '600',
  },
  submitButton: {
    backgroundColor: '#EF4444', // Red for dispute
    padding: 12,
    borderRadius: 8,
    minWidth: 100,
    alignItems: 'center',
  },
  disabledButton: {
    opacity: 0.5,
  },
  submitText: {
    color: '#FFF',
    fontWeight: 'bold',
  },
});
