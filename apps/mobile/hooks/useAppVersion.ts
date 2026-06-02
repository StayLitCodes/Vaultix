import { useState, useEffect } from 'react';
import Constants from 'expo-constants';
import { versionApi, AppVersionResponse } from '../services/api';

const MIN_SUPPORTED_VERSION_FALLBACK = '1.0.0';
const LATEST_VERSION_FALLBACK = '1.0.0';
const UPDATE_URL_FALLBACK = 'https://apps.apple.com/app/vaultix/id0000000000';

function compareSemver(a: string, b: string): number {
  const parse = (v: string) => v.split('.').map(n => parseInt(n, 10) || 0);
  const [aMaj, aMin, aPatch] = parse(a);
  const [bMaj, bMin, bPatch] = parse(b);
  if (aMaj !== bMaj) return aMaj - bMaj;
  if (aMin !== bMin) return aMin - bMin;
  return aPatch - bPatch;
}

export interface AppVersionState {
  needsUpdate: boolean;
  forceUpdate: boolean;
  latestVersion: string;
  updateUrl: string;
  isLoading: boolean;
}

export const useAppVersion = (): AppVersionState => {
  const currentVersion = Constants.expoConfig?.version ?? '1.0.0';

  const [state, setState] = useState<AppVersionState>({
    needsUpdate: false,
    forceUpdate: false,
    latestVersion: LATEST_VERSION_FALLBACK,
    updateUrl: UPDATE_URL_FALLBACK,
    isLoading: true,
  });

  useEffect(() => {
    let cancelled = false;

    const checkVersion = async () => {
      let info: AppVersionResponse;
      try {
        info = await versionApi.check();
      } catch {
        // On network/server failure use safe fallback — never block user due to backend outage
        info = {
          minSupportedVersion: MIN_SUPPORTED_VERSION_FALLBACK,
          latestVersion: LATEST_VERSION_FALLBACK,
          updateUrl: UPDATE_URL_FALLBACK,
        };
      }

      if (cancelled) return;

      const isBelowMin = compareSemver(currentVersion, info.minSupportedVersion) < 0;
      const isBelowLatest = compareSemver(currentVersion, info.latestVersion) < 0;

      setState({
        needsUpdate: isBelowLatest,
        forceUpdate: isBelowMin,
        latestVersion: info.latestVersion,
        updateUrl: info.updateUrl,
        isLoading: false,
      });
    };

    checkVersion();
    return () => { cancelled = true; };
  }, [currentVersion]);

  return state;
};
