function SkeletonCard() {
  return (
    <div
      className="border-r min-h-[260px] p-5 flex flex-col gap-3"
      style={{ borderColor: "var(--border)" }}
    >
      <div className="h-2 w-16 skeleton rounded-full" />
      <div className="h-5 w-full skeleton rounded" />
      <div className="h-5 w-4/5 skeleton rounded" />
      <div className="h-3 w-full skeleton rounded mt-1" />
      <div className="h-3 w-2/3 skeleton rounded" />
    </div>
  );
}

export default function SkeletonGrid({ count = 8 }: { count?: number }) {
  return (
    <div>
      {/* Hero skeleton */}
      <div
        className="grid grid-cols-1 lg:grid-cols-[1fr_360px] border-b"
        style={{ borderColor: "var(--border)" }}
      >
        <div
          className="h-[480px] skeleton border-r"
          style={{ borderColor: "var(--border)" }}
        />
        <div className="flex flex-col divide-y" style={{ borderColor: "var(--border)" }}>
          <div className="flex-1 p-5 flex flex-col gap-3">
            <div className="h-2 w-16 skeleton rounded-full" />
            <div className="h-6 w-full skeleton rounded" />
            <div className="h-6 w-4/5 skeleton rounded" />
          </div>
          <div className="flex-1 p-5 flex flex-col gap-3">
            <div className="h-2 w-16 skeleton rounded-full" />
            <div className="h-6 w-full skeleton rounded" />
            <div className="h-6 w-3/4 skeleton rounded" />
          </div>
        </div>
      </div>
      {/* Feed skeletons */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {Array.from({ length: Math.max(0, count - 3) }).map((_, i) => (
          <SkeletonCard key={i} />
        ))}
      </div>
    </div>
  );
}