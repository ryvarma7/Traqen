/** Skeleton shown while the track, its phases and its steps are fetched. The
 *  shapes mirror TrackDetailView so nothing jumps when the real page lands. */
export default function TrackDetailLoading() {
  return (
    <div className="space-y-5" aria-busy="true" aria-label="Loading track">
      {/* Header */}
      <div className="rounded-card glass-section p-4 md:p-6">
        <div className="skeleton h-4 w-24" />
        <div className="skeleton mt-3 h-7 w-3/4 md:h-8" />
        <div className="skeleton mt-2 h-4 w-full" />
        <div className="skeleton mt-1.5 h-4 w-2/3" />
        <div className="mt-6 flex items-center justify-between gap-3">
          <div className="skeleton h-4 w-28" />
          <div className="skeleton h-5 w-20 rounded-full" />
        </div>
        <div className="skeleton mt-2.5 h-1.5 w-full rounded-full" />
      </div>

      {/* Stepper */}
      <div className="flex gap-2">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="flex w-[104px] shrink-0 flex-col items-center gap-2">
            <div className="skeleton h-8 w-8 rounded-full" />
            <div className="skeleton h-3 w-20" />
            <div className="skeleton h-2.5 w-8" />
          </div>
        ))}
      </div>

      {/* Up next + steps */}
      <div className="grid gap-6 md:grid-cols-[260px_minmax(0,1fr)] md:gap-7">
        <div className="hidden md:block">
          <div className="skeleton h-3 w-16" />
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="skeleton mt-3 h-11 w-full rounded-field" />
          ))}
        </div>

        <div className="space-y-5">
          <div className="rounded-card glass-section p-4 md:p-5">
            <div className="skeleton h-3 w-16" />
            <div className="skeleton mt-3 h-6 w-3/4" />
            <div className="skeleton mt-2 h-4 w-full" />
            <div className="skeleton mt-1.5 h-4 w-5/6" />
            <div className="skeleton mt-4 h-11 w-full rounded-field" />
          </div>
          <div className="hidden md:block">
            <div className="skeleton h-6 w-48" />
            {[0, 1, 2].map((i) => (
              <div key={i} className="skeleton mt-3 h-16 w-full rounded-field" />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}