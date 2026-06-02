import { Skeleton } from './Skeleton';

export function AdminAnalyticsSkeleton() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <Skeleton className="h-8 w-32 mb-2" />
          <Skeleton className="h-4 w-48" />
        </div>
        <div className="flex gap-1 bg-white/5 rounded-lg p-1">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-8 w-20" />
          ))}
        </div>
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {Array.from({ length: 2 }).map((_, i) => (
          <div key={i} className="bg-[#12121a] border border-white/5 rounded-xl p-6">
            <Skeleton className="h-6 w-40 mb-6" />
            <div className="flex items-end gap-2 h-36">
              {Array.from({ length: 4 }).map((_, j) => (
                <Skeleton key={j} className="flex-1 rounded-t-md h-24" />
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Metrics row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {Array.from({ length: 2 }).map((_, i) => (
          <div key={i} className="bg-[#12121a] border border-white/5 rounded-xl p-6">
            <Skeleton className="h-6 w-40 mb-4" />
            <div className="grid grid-cols-2 gap-4">
              {Array.from({ length: 4 }).map((_, j) => (
                <div key={j} className="bg-white/[0.02] rounded-lg p-4">
                  <Skeleton className="h-8 w-16 mb-2" />
                  <Skeleton className="h-3 w-20" />
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
