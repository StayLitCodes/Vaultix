import React, { useState } from 'react';
import { Modal, View, Text, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator, ScrollView, Alert } from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import { disputeApi } from '../services/api';
import { Upload, X, FileText, Image as ImageIcon, RefreshCw, AlertTriangle } from 'lucide-react-native';
import { colors } from '../theme';

interface RaiseDisputeModalProps {
  visible: boolean;
  onClose: () => void;
  onSubmit: (reason: string, description: string, evidence?: string[]) => Promise<void>;
  isSubmitting: boolean;
  escrowId: string;
}

interface UploadedFile {
  id: string;
  name: string;
  uri: string;
  size: number;
  type: string;
  progress: number;
  cid?: string;
  error?: string;
  isRetrying?: boolean;
}

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB
const MAX_FILES = 10;
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf', 'text/plain', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];

export const RaiseDisputeModal: React.FC<RaiseDisputeModalProps> = ({ visible, onClose, onSubmit, isSubmitting, escrowId }) => {
  const [reason, setReason] = useState('');
  const [description, setDescription] = useState('');
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);

  /**
   * Uploads are started fire-and-forget right after a file is picked, so they can
   * still be in flight when the user taps Submit. Filing the dispute then would
   * silently drop every file that had not finished yet — and there is no way to
   * attach evidence afterwards — so Submit stays disabled until every file has
   * either produced a CID or failed (#765).
   */
  const pendingUploads = uploadedFiles.filter(
    (f) => !f.cid && !f.error && f.progress < 100,
  ).length;
  const failedUploads = uploadedFiles.filter((f) => Boolean(f.error)).length;
  const uploadsSettled = pendingUploads === 0 && failedUploads === 0;
  const isSubmitDisabled = !reason || !description || isSubmitting || !uploadsSettled;

  const submitBlockedReason = (() => {
    if (pendingUploads > 0) {
      return `Waiting for ${pendingUploads} file${pendingUploads === 1 ? '' : 's'} to finish uploading`;
    }
    if (failedUploads > 0) {
      return `${failedUploads} file${failedUploads === 1 ? '' : 's'} failed to upload — retry or remove ${failedUploads === 1 ? 'it' : 'them'}`;
    }
    return null;
  })();

  const handleSubmit = async () => {
    // Guard against a tap that lands while an upload is still settling: do not
    // file a dispute with partial (or zero) evidence.
    if (!reason || !description || !uploadsSettled) return;
    const evidenceCids = uploadedFiles.filter(f => f.cid).map(f => f.cid!);
    await onSubmit(reason, description, evidenceCids.length > 0 ? evidenceCids : undefined);
  };

  const handlePickFile = async () => {
    if (uploadedFiles.length >= MAX_FILES) {
      Alert.alert('Limit Reached', `You can only upload up to ${MAX_FILES} files.`);
      return;
    }

    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ALLOWED_TYPES,
        multiple: true,
        copyToCacheDirectory: true,
      });

      if (result.canceled) return;

      const remaining = MAX_FILES - uploadedFiles.length;
      const filesToAdd = result.assets.slice(0, remaining);

      const newFiles: UploadedFile[] = filesToAdd.map(file => {
        if (file.size && file.size > MAX_FILE_SIZE) {
          return {
            id: Math.random().toString(36).substring(7),
            name: file.name,
            uri: file.uri,
            size: file.size || 0,
            type: file.mimeType || 'application/octet-stream',
            progress: 0,
            error: 'File exceeds 10 MB limit',
          };
        }
        if (file.mimeType && !ALLOWED_TYPES.includes(file.mimeType)) {
          return {
            id: Math.random().toString(36).substring(7),
            name: file.name,
            uri: file.uri,
            size: file.size || 0,
            type: file.mimeType,
            progress: 0,
            error: 'Unsupported file type',
          };
        }
        return {
          id: Math.random().toString(36).substring(7),
          name: file.name,
          uri: file.uri,
          size: file.size || 0,
          type: file.mimeType || 'application/octet-stream',
          progress: 0,
        };
      });

      setUploadedFiles([...uploadedFiles, ...newFiles]);

      newFiles.filter(f => !f.error).forEach(file => {
        uploadFile(file);
      });
    } catch (error) {
      Alert.alert('Error', 'Failed to pick file');
    }
  };

  const uploadFile = async (file: UploadedFile) => {
    try {
      const result = await disputeApi.uploadEvidence(
        escrowId,
        file.uri,
        file.name,
        file.type,
        (percent) => {
          setUploadedFiles(prev =>
            prev.map(f =>
              f.id === file.id ? { ...f, progress: percent, error: undefined } : f,
            ),
          );
        },
      );
      setUploadedFiles(prev =>
        prev.map(f =>
          f.id === file.id
            ? { ...f, progress: 100, cid: result.cid }
            : f,
        ),
      );
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Upload failed';
      setUploadedFiles(prev =>
        prev.map(f =>
          f.id === file.id
            ? { ...f, progress: 0, error: message, isRetrying: false }
            : f,
        ),
      );
    }
  };

  const removeFile = (id: string) => {
    setUploadedFiles(prev => prev.filter(f => f.id !== id));
  };

  const retryUpload = (file: UploadedFile) => {
    setUploadedFiles(prev =>
      prev.map(f =>
        f.id === file.id ? { ...f, isRetrying: true, error: undefined } : f
      )
    );
    uploadFile(file);
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const getTotalSize = () => {
    return uploadedFiles.reduce((total, f) => total + f.size, 0);
  };

  const isImage = (type: string) => type.startsWith('image/');

  return (
    <Modal visible={visible} transparent animationType="slide">
      <View style={styles.overlay}>
        <ScrollView style={styles.scrollView}>
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
              placeholderTextColor={colors.textTertiary}
              value={reason}
              onChangeText={setReason}
            />

            <Text style={styles.label}>Description</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              placeholder="Provide details..."
              placeholderTextColor={colors.textTertiary}
              multiline
              numberOfLines={4}
              value={description}
              onChangeText={setDescription}
            />

            {/* Evidence File Upload */}
            <Text style={styles.label}>Evidence Files (Optional)</Text>
            <Text style={styles.helperText}>
              Images, PDFs, text files · max 10 MB · up to {MAX_FILES} files
            </Text>
            
            {uploadedFiles.length > 0 && (
              <Text style={styles.sizeText}>
                Total size: {formatFileSize(getTotalSize())} ({uploadedFiles.length}/{MAX_FILES} files)
              </Text>
            )}

            <TouchableOpacity 
              style={[styles.uploadButton, uploadedFiles.length >= MAX_FILES && styles.disabledUploadButton]}
              onPress={handlePickFile}
              disabled={uploadedFiles.length >= MAX_FILES || isSubmitting}
            >
              <Upload size={20} color={colors.textSecondary} />
              <Text style={styles.uploadButtonText}>
                {uploadedFiles.length >= MAX_FILES ? 'Max files reached' : 'Tap to upload files'}
              </Text>
            </TouchableOpacity>

            {/* File List */}
            {uploadedFiles.length > 0 && (
              <View style={styles.fileList}>
                {uploadedFiles.map(file => (
                  <View key={file.id} style={styles.fileItem}>
                    <View style={styles.fileIcon}>
                      {isImage(file.type) ? (
                        <ImageIcon size={20} color={colors.info} />
                      ) : (
                        <FileText size={20} color={colors.textSecondary} />
                      )}
                    </View>
                    <View style={styles.fileInfo}>
                      <Text style={styles.fileName} numberOfLines={1}>{file.name}</Text>
                      {file.error ? (
                        <View style={styles.errorRow}>
                          <Text style={styles.errorText}>{file.error}</Text>
                          <TouchableOpacity onPress={() => retryUpload(file)} disabled={file.isRetrying}>
                            {file.isRetrying ? (
                              <ActivityIndicator size="small" color={colors.info} />
                            ) : (
                              <RefreshCw size={14} color={colors.info} />
                            )}
                          </TouchableOpacity>
                        </View>
                      ) : file.progress < 100 ? (
                        <View style={styles.progressRow}>
                          <View style={styles.progressBar}>
                            <View style={[styles.progressFill, { width: `${file.progress}%` }]} />
                          </View>
                          <ActivityIndicator size="small" color={colors.info} />
                        </View>
                      ) : (
                        <Text style={styles.successText}>Uploaded</Text>
                      )}
                    </View>
                    <TouchableOpacity
                      onPress={() => removeFile(file.id)}
                      style={styles.removeButton}
                      accessibilityRole="button"
                      accessibilityLabel={`Remove ${file.name}`}
                    >
                      <X size={16} color="#94A3B8" />
                    </TouchableOpacity>
                  </View>
                ))}
              </View>
            )}

            <View style={styles.actions}>
              <TouchableOpacity style={styles.cancelButton} onPress={onClose} disabled={isSubmitting}>
                <Text style={styles.cancelText}>Cancel</Text>
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={[styles.submitButton, isSubmitDisabled && styles.disabledButton]} 
                onPress={handleSubmit}
                disabled={isSubmitDisabled}
                accessibilityRole="button"
                accessibilityLabel="Submit dispute"
                accessibilityState={{ disabled: isSubmitDisabled }}
              >
                {isSubmitting ? <ActivityIndicator color={colors.onAccent} /> : <Text style={styles.submitText}>Submit</Text>}
              </TouchableOpacity>
            </View>

            {submitBlockedReason && (
              <View style={styles.submitHintRow}>
                {pendingUploads > 0 ? (
                  <ActivityIndicator size="small" color="#F59E0B" />
                ) : (
                  <AlertTriangle size={14} color="#F59E0B" />
                )}
                <Text style={styles.submitHintText}>{submitBlockedReason}</Text>
              </View>
            )}
          </View>
        </ScrollView>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: colors.overlay,
    justifyContent: 'flex-end',
  },
  scrollView: {
    maxHeight: '90%',
  },
  modalContent: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    padding: 24,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: colors.text,
    marginBottom: 16,
  },
  warningBox: {
    backgroundColor: colors.warningSurface,
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
  },
  warningText: {
    color: colors.warningSoft,
    fontSize: 14,
  },
  label: {
    color: colors.textSecondary,
    marginBottom: 8,
    fontWeight: '600',
  },
  helperText: {
    color: colors.textTertiary,
    fontSize: 12,
    marginBottom: 8,
  },
  sizeText: {
    color: colors.textTertiary,
    fontSize: 12,
    marginBottom: 8,
  },
  input: {
    backgroundColor: colors.background,
    color: colors.text,
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
  },
  textArea: {
    height: 100,
    textAlignVertical: 'top',
  },
  uploadButton: {
    backgroundColor: colors.background,
    borderWidth: 2,
    borderColor: colors.border,
    borderStyle: 'dashed',
    borderRadius: 8,
    padding: 16,
    alignItems: 'center',
    marginBottom: 16,
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
  },
  disabledUploadButton: {
    opacity: 0.5,
  },
  uploadButtonText: {
    color: colors.textSecondary,
    fontSize: 14,
    fontWeight: '500',
  },
  fileList: {
    marginBottom: 16,
  },
  fileItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.background,
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
  },
  fileIcon: {
    width: 40,
    height: 40,
    borderRadius: 8,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  fileInfo: {
    flex: 1,
  },
  fileName: {
    color: colors.text,
    fontSize: 14,
    marginBottom: 4,
  },
  errorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  errorText: {
    color: colors.danger,
    fontSize: 12,
  },
  progressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  progressBar: {
    flex: 1,
    height: 4,
    backgroundColor: colors.border,
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: colors.info,
  },
  successText: {
    color: colors.success,
    fontSize: 12,
  },
  removeButton: {
    padding: 8,
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
    color: colors.textSecondary,
    fontWeight: '600',
  },
  submitButton: {
    backgroundColor: colors.danger,
    padding: 12,
    borderRadius: 8,
    minWidth: 100,
    alignItems: 'center',
  },
  disabledButton: {
    opacity: 0.5,
  },
  submitText: {
    color: colors.onAccent,
    fontWeight: 'bold',
  },
  submitHintRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 12,
    justifyContent: 'flex-end',
  },
  submitHintText: {
    color: '#F59E0B',
    fontSize: 12,
    flexShrink: 1,
  },
});
