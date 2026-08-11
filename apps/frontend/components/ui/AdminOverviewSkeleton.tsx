import { Skeleton } from "./Skeleton";

export function AdminOverviewSkeleton() {
  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="space-y-2">
        <Skeleton className="h-8 w-48 bg-white/10" />
        <Skeleton className="h-4 w-72 bg-white/10" />
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="bg-[#12121a] border border-white/5 rounded-xl p-5 space-y-4">
            <div className="flex items-start justify-between">
              <Skeleton className="h-10 w-10 rounded-lg bg-white/10" />
              <Skeleton className="h-6 w-14 rounded-full bg-white/10" />
            </div>
            <Skeleton className="h-8 w-24 bg-white/10" />
            <Skeleton className="h-3 w-32 bg-white/10" />
          </div>
        ))}
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 bg-[#12121a] border border-white/5 rounded-xl p-6 space-y-4">
          <Skeleton className="h-5 w-48 bg-white/10" />
          <Skeleton className="h-4 w-64 bg-white/10" />
          <div className="flex items-end gap-2 h-40">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="flex-1 flex flex-col items-center gap-2">
                <div style={{ height: `${40 + i * 10}%` }} className="w-full">
                  <Skeleton className="w-full h-full bg-white/10" />
                </div>
                <Skeleton className="h-2 w-6 bg-white/10" />
              </div>
            ))}
          </div>
        </div>
        <div className="bg-[#12121a] border border-white/5 rounded-xl p-6 space-y-4">
          <Skeleton className="h-5 w-36 bg-white/10" />
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="space-y-2">
              <div className="flex justify-between">
                <Skeleton className="h-3 w-16 bg-white/10" />
                <Skeleton className="h-3 w-20 bg-white/10" />
              </div>
              <Skeleton className="h-1.5 w-full rounded-full bg-white/10" />
            </div>
          ))}
        </div>
      </div>

      {/* Activity row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {Array.from({ length: 2 }).map((_, i) => (
          <div key={i} className="bg-[#12121a] border border-white/5 rounded-xl p-6 space-y-4">
            <Skeleton className="h-5 w-32 bg-white/10" />
            {Array.from({ length: 4 }).map((_, j) => (
              <div key={j} className="flex items-center gap-3">
                <Skeleton className="h-8 w-8 rounded-lg bg-white/10 shrink-0" />
                <div className="flex-1 space-y-1.5">
                  <Skeleton className="h-3 w-48 bg-white/10" />
                  <Skeleton className="h-2 w-16 bg-white/10" />
                </div>
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
