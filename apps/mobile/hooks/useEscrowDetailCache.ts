import { useEffect, useState } from "react";

import {
  cacheEscrowDetail,
  getCachedEscrowDetail,
} from "../services/cache/escrowCache";

import { isOnline } from "../utils/network";

export function useEscrowDetailCache(
  escrowId: string,
  fetcher: () => Promise<unknown>
) {

  const [data, setData] =
    useState<unknown>(null);

  const [offline, setOffline] =
    useState(false);

  const [updatedAt, setUpdatedAt] =
    useState<number>();

  const [stale, setStale] =
    useState(false);

  useEffect(() => {
    load();
  }, [escrowId]);

  async function load() {

    const online = await isOnline();

    if (!online) {
      setOffline(true);

      const cached =
        await getCachedEscrowDetail(
          escrowId
        );

      if (cached) {
        setData(cached.data);
        setUpdatedAt(cached.updatedAt);

        const age =
          Date.now() - cached.updatedAt;

        setStale(age > 1000 * 60 * 30);
      }

      return;
    }

    const fresh = await fetcher();

    await cacheEscrowDetail(
      escrowId,
      fresh
    );

    setData(fresh);

    setOffline(false);

    setUpdatedAt(Date.now());

    setStale(false);
  }

  return {
    data,
    offline,
    updatedAt,
    stale,
    refresh: load,
  };
}