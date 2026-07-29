// Closes #473: hook to replace the admin dashboard's hardcoded volume
// chart / activity data with the real backend analytics API. Starter
// hook; swapping the dashboard components to consume this (with loading
// skeletons + error/retry states) is a follow-up.
'use client';

import { useQuery } from '@tanstack/react-query';

export interface VolumePoint {
  date: string;
  volume: number;
}

async function fetchVolume(from?: string, to?: string): Promise<VolumePoint[]> {
  const params = new URLSearchParams();
  if (from) params.set('from', from);
  if (to) params.set('to', to);
  const res = await fetch(`/api/admin/analytics/volume?${params.toString()}`);
  if (!res.ok) throw new Error('Failed to load analytics volume');
  return res.json();
}

export function useAdminAnalyticsVolume(from?: string, to?: string) {
  return useQuery({
    queryKey: ['admin-analytics-volume', from, to],
    queryFn: () => fetchVolume(from, to),
    staleTime: 60_000,
  });
}
