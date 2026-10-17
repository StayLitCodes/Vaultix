import { useEffect, useRef, useState } from "react";

import {
  cacheDashboardData,
  getCachedDashboardData,
} from "../services/cache/dashboardCache";

import { isOnline } from "../utils/network";

export function useDashboardCache(
  fetcher: () => Promise<unknown>
) {

  const [data, setData] =
    useState<unknown>(null);

  const [loading, setLoading] =
    useState(true);

  const [offline, setOffline] =
    useState(false);

  const [updatedAt, setUpdatedAt] =
    useState<number>();

  const [stale, setStale] =
    useState(false);

  const [error, setError] =
    useState<Error | null>(null);

  // Monotonic token: only the most recent load() may write state.
  const requestIdRef = useRef(0);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    load();

    return () => {
      // Invalidate the in-flight request on unmount / dependency change.
      requestIdRef.current += 1;
      mountedRef.current = false;
    };
  }, []);

  async function load() {
    const requestId = ++requestIdRef.current;
    const isCurrent = () =>
      mountedRef.current &&
      requestId === requestIdRef.current;

    setLoading(true);
    setError(null);

    const online = await isOnline();

    if (!isCurrent()) return;

    if (!online) {
      setOffline(true);

      const cached =
        await getCachedDashboardData();

      if (!isCurrent()) return;

      if (cached) {
        setData(cached.data);
        setUpdatedAt(cached.updatedAt);
        setStale(cached.stale);
      } else {
        setData(null);
        setUpdatedAt(undefined);
        setStale(false);
      }

      setLoading(false);
      return;
    }

    try {
      const fresh = await fetcher();

      if (!isCurrent()) return;

      await cacheDashboardData(fresh);

      if (!isCurrent()) return;

      setData(fresh);
      setOffline(false);
      setUpdatedAt(Date.now());
      setStale(false);
    } catch (err) {
      const error =
        err instanceof Error
          ? err
          : new Error(String(err));

      if (!isCurrent()) return;

      setError(error);
      setOffline(true);

      const cached =
        await getCachedDashboardData();

      if (!isCurrent()) return;

      if (cached) {
        setData(cached.data);
        setUpdatedAt(cached.updatedAt);

        const age =
          Date.now() - cached.updatedAt;

        setStale(age > 1000 * 60 * 30);
      }
    } finally {
      if (isCurrent()) {
        setLoading(false);
      }
    }
  }

  return {
    data,
    loading,
    offline,
    error,
    updatedAt,
    stale,
    refresh: load,
  };
}
