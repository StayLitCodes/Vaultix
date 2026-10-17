// Closes #473: hook to replace the admin dashboard's hardcoded volume
// chart / activity data with the real backend analytics API. Starter
// hook; swapping the dashboard components to consume this (with loading
// skeletons + error/retry states) is a follow-up.
"use client";

import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";

export interface VolumePoint {
  date: string;
  volume: number;
}

async function fetchVolume(
  from?: string,
  to?: string,
  signal?: AbortSignal,
): Promise<VolumePoint[]> {
  const params = new URLSearchParams();
  if (from) params.set("from", from);
  if (to) params.set("to", to);
  const query = params.toString();
  const response = await apiClient.get<{ charts: VolumePoint[] }>(
    `/admin/analytics/volume${query ? `?${query}` : ""}`,
    { signal },
  );
  return response.charts;
}

export function useAdminAnalyticsVolume(from?: string, to?: string) {
  return useQuery({
    queryKey: ["admin-analytics-volume", from, to],
    queryFn: ({ signal }) => fetchVolume(from, to, signal),
    staleTime: 60_000,
  });
}
