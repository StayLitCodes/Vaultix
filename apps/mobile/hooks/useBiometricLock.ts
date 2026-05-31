import { useState, useEffect } from 'react';
import * as LocalAuthentication from 'expo-local-authentication';
import { getSecureItem, saveSecureItem } from '../utils/secureStore';

const BIOMETRIC_ENABLED_KEY = 'biometric_enabled';

export const useBiometricLock = () => {
  const [isSupported, setIsSupported] = useState(false);
  const [isEnrolled, setIsEnrolled] = useState(false);
  const [isEnabled, setIsEnabled] = useState(false);
  const [isUnlocked, setIsUnlocked] = useState(true);

  useEffect(() => {
    checkBiometricSupport();
    loadBiometricPreference();
  }, []);

  const checkBiometricSupport = async () => {
    const compatible = await LocalAuthentication.hasHardwareAsync();
    const enrolled = await LocalAuthentication.isEnrolledAsync();
    setIsSupported(compatible);
    setIsEnrolled(enrolled);
  };

  const loadBiometricPreference = async () => {
    const preference = await getSecureItem(BIOMETRIC_ENABLED_KEY);
    if (preference === 'true') {
      setIsEnabled(true);
      setIsUnlocked(false); // Lock by default on startup if enabled
    }
  };

  const enableBiometric = async () => {
    if (!isSupported || !isEnrolled) return false;
    
    const result = await LocalAuthentication.authenticateAsync({
      promptMessage: 'Authenticate to enable biometric lock',
      fallbackLabel: 'Use Passcode',
    });

    if (result.success) {
      await saveSecureItem(BIOMETRIC_ENABLED_KEY, 'true');
      setIsEnabled(true);
      return true;
    }
    return false;
  };

  const disableBiometric = async () => {
    const result = await LocalAuthentication.authenticateAsync({
      promptMessage: 'Authenticate to disable biometric lock',
      fallbackLabel: 'Use Passcode',
    });

    if (result.success) {
      await saveSecureItem(BIOMETRIC_ENABLED_KEY, 'false');
      setIsEnabled(false);
      setIsUnlocked(true);
      return true;
    }
    return false;
  };

  const authenticate = async () => {
    if (!isEnabled) {
      setIsUnlocked(true);
      return true;
    }

    const result = await LocalAuthentication.authenticateAsync({
      promptMessage: 'Unlock Vaultix',
      fallbackLabel: 'Use Passcode',
      disableDeviceFallback: false, // allow device passcode
    });

    if (result.success) {
      setIsUnlocked(true);
      return true;
    }
    return false;
  };

  const lock = () => {
    if (isEnabled) {
      setIsUnlocked(false);
    }
  };

  return {
    isSupported,
    isEnrolled,
    isEnabled,
    isUnlocked,
    enableBiometric,
    disableBiometric,
    authenticate,
    lock,
  };
};
