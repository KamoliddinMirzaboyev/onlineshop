export function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse bg-slate-200 rounded ${className}`} />;
}

export function ErrorRetry({
  onRetry,
  message = "Ma'lumotni yuklab bo'lmadi",
}: { onRetry: () => void; message?: string }) {
  return (
    <div className="card p-8 text-center space-y-3">
      <p className="text-sm text-slate-500">{message}</p>
      <button className="btn-ghost mx-auto" onClick={onRetry}>Qayta urinish</button>
    </div>
  );
}

export function TableSkeleton({ cols = 5, rows = 6 }: { cols?: number; rows?: number }) {
  return (
    <div className="card overflow-hidden">
      <div className="flex gap-4 px-4 py-3 bg-slate-50">
        {Array.from({ length: cols }).map((_, i) => (
          <Skeleton key={i} className="h-3 flex-1" />
        ))}
      </div>
      {Array.from({ length: rows }).map((_, r) => (
        <div key={r} className="flex gap-4 px-4 py-4 border-t border-slate-100">
          {Array.from({ length: cols }).map((_, i) => (
            <Skeleton key={i} className="h-4 flex-1" />
          ))}
        </div>
      ))}
    </div>
  );
}

export function OrderListSkeleton({ rows = 4 }: { rows?: number }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="card p-4 space-y-3">
          <div className="flex justify-between">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-4 w-24" />
          </div>
          <Skeleton className="h-3 w-2/3" />
          <Skeleton className="h-8 w-40" />
        </div>
      ))}
    </div>
  );
}

export function StatCardsSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="card p-5 flex items-start justify-between">
          <div className="flex-1 space-y-2">
            <Skeleton className="h-3 w-24" />
            <Skeleton className="h-7 w-20" />
          </div>
          <Skeleton className="h-10 w-10 rounded-lg" />
        </div>
      ))}
    </div>
  );
}
