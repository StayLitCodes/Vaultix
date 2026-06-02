import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Animated,
  TouchableOpacity,
  SafeAreaView,
} from 'react-native';
import ToastContext, { Toast, ToastType } from './ToastContext';

const TOAST_COLORS: Record<ToastType, { bg: string; text: string; border: string }> = {
  success: { bg: '#064E3B', text: '#6EE7B7', border: '#059669' },
  error: { bg: '#7F1D1D', text: '#FCA5A5', border: '#DC2626' },
  warning: { bg: '#451A03', text: '#FDE047', border: '#D97706' },
  info: { bg: '#1E3A5F', text: '#93C5FD', border: '#3B82F6' },
};

interface ToastItemProps {
  toast: Toast;
  onRemove: (id: string) => void;
}

const ToastItem: React.FC<ToastItemProps> = ({ toast, onRemove }) => {
  const colors = TOAST_COLORS[toast.type];
  return (
    <TouchableOpacity
      onPress={() => onRemove(toast.id)}
      style={[styles.toast, { backgroundColor: colors.bg, borderColor: colors.border }]}
    >
      <Text style={[styles.toastText, { color: colors.text }]}>{toast.message}</Text>
    </TouchableOpacity>
  );
};

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const addToast = useCallback(
    (message: string, type: ToastType, duration: number = 5000) => {
      const id = Math.random().toString(36).substring(2, 9);
      setToasts((prev) => [...prev, { id, message, type, duration }]);
      if (duration > 0) {
        setTimeout(() => removeToast(id), duration);
      }
    },
    [removeToast],
  );

  return (
    <ToastContext.Provider value={{ toasts, addToast, removeToast }}>
      {children}
      {toasts.length > 0 && (
        <SafeAreaView style={styles.container} pointerEvents="box-none">
          {toasts.map((t) => (
            <ToastItem key={t.id} toast={t} onRemove={removeToast} />
          ))}
        </SafeAreaView>
      )}
    </ToastContext.Provider>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    alignItems: 'center',
    zIndex: 9999,
    paddingTop: 8,
    gap: 8,
  },
  toast: {
    marginHorizontal: 16,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    borderWidth: 1,
    width: '90%',
  },
  toastText: {
    fontSize: 14,
    fontWeight: '500',
  },
});
