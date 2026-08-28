import { Skeleton } from "./Skeleton";

export function AdminTableSkeleton({ rows = 8 }: { rows?: number }) {
  return (
    <div className="space-y-5">
      {/* Filter pills */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-9 w-20 rounded-lg bg-white/10 shrink-0" />
        ))}
      </div>

      {/* Desktop table */}
      <div className="hidden sm:block bg-[#12121a] border border-white/5 rounded-xl overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-white/5">
              {Array.from({ length: 6 }).map((_, i) => (
                <th key={i} className="px-5 py-3">
                  <Skeleton className="h-3 w-16 bg-white/10" />
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: rows }).map((_, i) => (
              <tr key={i} className="border-b border-white/[0.03]">
                <td className="px-5 py-4 space-y-1">
                  <Skeleton className="h-4 w-36 bg-white/10" />
                  <Skeleton className="h-2 w-24 bg-white/10" />
                </td>
                <td className="px-5 py-4">
                  <Skeleton className="h-4 w-24 bg-white/10" />
                </td>
                <td className="px-5 py-4">
                  <Skeleton className="h-6 w-20 rounded-full bg-white/10" />
                </td>
                <td className="px-5 py-4">
                  <Skeleton className="h-3 w-16 bg-white/10" />
                </td>
                <td className="px-5 py-4">
                  <Skeleton className="h-3 w-20 bg-white/10" />
                </td>
                <td className="px-5 py-4 text-right">
                  <Skeleton className="h-4 w-12 ml-auto bg-white/10" />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile cards */}
      <div className="sm:hidden space-y-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="bg-white/[0.02] border border-white/5 rounded-xl p-4 space-y-3">
            <div className="flex items-start justify-between gap-2">
              <div className="space-y-1.5 flex-1">
                <Skeleton className="h-4 w-40 bg-white/10" />
                <Skeleton className="h-2 w-24 bg-white/10" />
              </div>
              <Skeleton className="h-6 w-20 rounded-full bg-white/10 shrink-0" />
            </div>
            <div className="flex items-center justify-between">
              <Skeleton className="h-4 w-28 bg-white/10" />
              <Skeleton className="h-9 w-16 rounded-lg bg-white/10" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
