/**
 * Toast – lightweight snackbar notification for copy/share feedback.
 * Auto-dismisses after `durationMs`. Uses the app's dark theme palette.
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  AccessibilityInfo,
  Animated,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

export interface ToastConfig {
  message: string;
  type?: 'success' | 'error' | 'info';
  durationMs?: number;
}

const TYPE_COLORS: Record<string, { bg: string; text: string; icon: string }> = {
  success: { bg: colors.successBright, text: colors.textInverse, icon: '✓' },
  error: { bg: colors.danger, text: colors.onAccent, icon: '✕' },
  info: { bg: colors.accent, text: colors.onAccent, icon: 'ℹ' },
};

interface ToastState extends ToastConfig {
  visible: boolean;
}

let _showToast: (config: ToastConfig) => void;

export function showToast(config: ToastConfig) {
  _showToast(config);
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toast, setToast] = useState<ToastState | null>(null);
  const opacity = useRef(new Animated.Value(0)).current;
  const timerRef = useRef<ReturnType<typeof setTimeout>>();

  _showToast = useCallback((config: ToastConfig) => {
    if (timerRef.current) clearTimeout(timerRef.current);
    setToast({ ...config, visible: true });
    // iOS has no live regions, so announce explicitly. Android is covered by
    // `accessibilityLiveRegion` below — announcing there too would double-speak.
    if (Platform.OS === 'ios') {
      AccessibilityInfo.announceForAccessibility(config.message);
    }
    Animated.sequence([
      Animated.timing(opacity, { toValue: 1, duration: 200, useNativeDriver: true }),
    ]).start();
  }, [opacity]);

  const dismiss = useCallback(() => {
    Animated.timing(opacity, { toValue: 0, duration: 200, useNativeDriver: true }).start(() => {
      setToast(null);
    });
  }, [opacity]);

  useEffect(() => {
    if (!toast?.visible) return;
    const duration = toast.durationMs ?? 2500;
    timerRef.current = setTimeout(dismiss, duration);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [toast, dismiss]);

  const type = toast?.type ?? 'success';
  const palette = TYPE_COLORS[type];

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
      {children}
      {toast?.visible && (
        <Animated.View
          style={[styles.wrapper, { opacity }]}
          pointerEvents="box-none"
          accessibilityLiveRegion="polite"
          accessibilityRole="alert"
        >
          <TouchableOpacity
            style={[styles.toast, { backgroundColor: palette.bg }]}
            onPress={dismiss}
            activeOpacity={0.85}
            accessibilityRole="button"
            accessibilityLabel={toast.message}
            accessibilityHint="Dismisses this message"
          >
            <Text
              style={[styles.icon, { color: colors.text }]}
              importantForAccessibility="no"
              accessibilityElementsHidden
            >
              {colors.icon}
            </Text>
            <Text style={[styles.message, { color: colors.text }]}>{toast.message}</Text>
          </TouchableOpacity>
        </Animated.View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    position: 'absolute',
    bottom: 40,
    left: 16,
    right: 16,
    alignItems: 'center',
  },
  toast: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 8,
    elevation: 6,
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    maxWidth: '100%',
  },
  icon: { fontSize: 16, fontWeight: '700' },
  message: { fontSize: 14, fontWeight: '600', flexShrink: 1 },
});
