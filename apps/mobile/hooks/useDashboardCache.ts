import { useEffect, useState } from "react";

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

  useEffect(() => {
    load();
  }, []);

  async function load() {
    setLoading(true);

    const online = await isOnline();

    if (!online) {
      setOffline(true);

      const cached =
        await getCachedDashboardData();

      if (cached) {
        setData(cached.data);
        setUpdatedAt(cached.updatedAt);

        const age =
          Date.now() - cached.updatedAt;

        setStale(age > 1000 * 60 * 30);
      }

      setLoading(false);
      return;
    }

    const fresh = await fetcher();

    await cacheDashboardData(fresh);

    setData(fresh);
    setOffline(false);
    setUpdatedAt(Date.now());
    setStale(false);

    setLoading(false);
  }

  return {
    data,
    loading,
    offline,
    updatedAt,
    stale,
    refresh: load,
  };
}