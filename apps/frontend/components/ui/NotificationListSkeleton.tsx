import { Skeleton } from "./Skeleton";

export function NotificationListSkeleton() {
  return (
    <div className="bg-[#12121a] border border-white/5 rounded-xl overflow-hidden shadow-xl">
      <div className="divide-y divide-white/5">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="flex items-start gap-4 p-5">
            <Skeleton className="h-8 w-8 rounded-full shrink-0 mt-0.5 bg-white/10" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-3 w-40 bg-white/10" />
              <Skeleton className="h-3 w-64 bg-white/10" />
              <Skeleton className="h-2 w-24 bg-white/10" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
