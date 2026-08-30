import { Skeleton } from "./Skeleton";

export function AdminDisputesSkeleton() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-2">
          <Skeleton className="h-8 w-56 bg-white/10" />
          <Skeleton className="h-4 w-80 bg-white/10" />
        </div>
        <Skeleton className="h-9 w-40 rounded-lg bg-white/10" />
      </div>

      {/* Split layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left list */}
        <div className="lg:col-span-4 space-y-3">
          <Skeleton className="h-4 w-24 bg-white/10" />
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="bg-[#12121a] border border-white/5 rounded-xl p-4 space-y-3">
              <div className="flex items-start justify-between gap-3">
                <Skeleton className="h-4 w-36 bg-white/10 flex-1" />
                <Skeleton className="h-5 w-14 rounded-full bg-white/10 shrink-0" />
              </div>
              <div className="flex justify-between">
                <Skeleton className="h-3 w-24 bg-white/10" />
                <Skeleton className="h-3 w-20 bg-white/10" />
              </div>
            </div>
          ))}
        </div>

        {/* Right detail */}
        <div className="lg:col-span-8 grid grid-cols-1 md:grid-cols-12 gap-6">
          <div className="col-span-12 md:col-span-7 space-y-6">
            <div className="bg-[#12121a] border border-white/5 rounded-xl p-5 space-y-4">
              <Skeleton className="h-6 w-48 bg-white/10" />
              <Skeleton className="h-4 w-full bg-white/10" />
              <Skeleton className="h-4 w-3/4 bg-white/10" />
              <div className="grid grid-cols-2 gap-4 bg-white/[0.02] rounded-lg p-3">
                <div className="space-y-1">
                  <Skeleton className="h-3 w-16 bg-white/10" />
                  <Skeleton className="h-6 w-24 bg-white/10" />
                </div>
                <div className="space-y-1">
                  <Skeleton className="h-3 w-20 bg-white/10" />
                  <Skeleton className="h-4 w-32 bg-white/10" />
                </div>
              </div>
              <Skeleton className="h-16 w-full rounded-lg bg-white/10" />
            </div>
            <div className="bg-[#12121a] border border-white/5 rounded-xl p-5 space-y-3">
              <Skeleton className="h-5 w-36 bg-white/10" />
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="flex gap-3">
                  <Skeleton className="h-8 w-8 rounded-full bg-white/10 shrink-0" />
                  <Skeleton className="h-14 flex-1 rounded-lg bg-white/10" />
                </div>
              ))}
            </div>
          </div>
          <div className="col-span-12 md:col-span-5">
            <div className="bg-[#12121a] border border-white/5 rounded-xl p-5 space-y-4">
              <Skeleton className="h-5 w-40 bg-white/10" />
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-12 w-full rounded-lg bg-white/10" />
              ))}
              <Skeleton className="h-24 w-full rounded-lg bg-white/10" />
              <Skeleton className="h-10 w-full rounded-lg bg-white/10" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
