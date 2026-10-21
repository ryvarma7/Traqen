import Link from "next/link";
import { GraduationCap } from "lucide-react";
import { CountdownPill } from "@/components/shared/countdown-pill";

export type HubTrackRow = {
  id: string;
  title: string;
  /** Steps finished and steps in total. */
  done: number;
  total: number;
  /** The step the learner should do next in this track. */
  nextTitle: string | null;
  /** Its due date, if it has one. */
  nextDate: string | null;
};

const MAX_ROWS = 5;

/**
 * The hub's track list: every other track the learner has in flight, with
 * how far along it is and what is next.
 *
 * Read-only by design, like the other hub panels — a row links through to
 * the track, where the plan can be worked on properly. The one control on
 * the dashboard is the hero card's "mark done", because finishing the thing
 * you are about to do is the single action the dashboard is good at.
 */
export function TracksPanel({ tracks }: { tracks: HubTrackRow[] }) {
  const rows = tracks.slice(0, MAX_ROWS);

  return (
    <section className="panel mb-4 px-4 pt-4 md:px-5" aria-label="Learning tracks">
      <header className="mb-2 flex items-center justify-between gap-3">
        <h2 className="text-base font-medium tracking-tight text-foreground">
          Learning
          {tracks.length > 0 && (
            <span className="ml-2 text-2xs font-normal text-muted-foreground/70">
              {tracks.length}
            </span>
          )}
        </h2>
        <Link
          href="/tracks"
          className="text-2xs font-medium text-muted-foreground transition-colors hover:text-foreground"
        >
          All tracks
        </Link>
      </header>

      {rows.length === 0 ? (
        <p className="py-6 text-center text-sm text-muted-foreground/70">
          No tracks in flight. Plan one to get started.
        </p>
      ) : (
        <ul>
          {rows.map((row) => {
            const pct = row.total > 0 ? Math.round((row.done / row.total) * 100) : 0;
            return (
              <li
                key={row.id}
                className="flex items-start gap-3 border-b border-white/[0.06] py-2.5 last:border-b-0"
              >
                <GraduationCap
                  className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground/70"
                  strokeWidth={1.75}
                />
                <div className="min-w-0 flex-1">
                  <Link
                    href={`/tracks/${row.id}`}
                    className="block truncate text-sm text-foreground transition-opacity hover:opacity-70"
                  >
                    {row.title}
                  </Link>
                  {row.nextTitle && (
                    <p className="mt-0.5 truncate text-2xs text-muted-foreground/80">
                      {row.nextTitle}
                    </p>
                  )}
                  <div className="mt-1 flex items-center gap-2">
                    <span className="h-1 w-16 overflow-hidden rounded-full bg-white/10">
                      <span
                        className="block h-full rounded-full bg-white/70"
                        style={{ width: `${pct}%` }}
                      />
                    </span>
                    <span className="font-mono text-2xs tabular-nums text-muted-foreground">
                      {row.done}/{row.total}
                    </span>
                  </div>
                </div>
                {row.nextDate && (
                  <CountdownPill date={row.nextDate} className="shrink-0" />
                )}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
