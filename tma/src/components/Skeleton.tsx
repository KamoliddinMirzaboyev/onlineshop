export function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse rounded bg-black/[0.07] ${className}`} />;
}

export function StoreListSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="space-y-3 mt-2">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="card overflow-hidden">
          <Skeleton className="h-32 w-full rounded-none" />
          <div className="p-3 space-y-2">
            <Skeleton className="h-4 w-2/3" />
            <Skeleton className="h-3 w-1/2" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function MenuSkeleton() {
  return (
    <div className="p-2.5 pt-2">
      <div className="grid grid-cols-3 gap-2">
        {Array.from({ length: 9 }).map((_, i) => (
          <div key={i} className="card overflow-hidden">
            <Skeleton className="aspect-square w-full rounded-none" />
            <div className="p-1.5 space-y-1">
              <Skeleton className="h-3 w-2/3" />
              <Skeleton className="h-3 w-full" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function OrderListSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="p-4 space-y-3">
      <Skeleton className="h-7 w-40 mb-4" />
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="card p-4 space-y-2">
          <div className="flex justify-between">
            <Skeleton className="h-4 w-28" />
            <Skeleton className="h-4 w-20" />
          </div>
          <Skeleton className="h-3 w-1/3" />
        </div>
      ))}
    </div>
  );
}

export function OrderDetailSkeleton() {
  return (
    <div className="p-4 space-y-4">
      <Skeleton className="h-5 w-32" />
      <Skeleton className="h-7 w-40" />
      <div className="flex justify-between">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-7 w-7 rounded-full" />
        ))}
      </div>
      <div className="card p-4 space-y-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-4 w-full" />
        ))}
      </div>
    </div>
  );
}
