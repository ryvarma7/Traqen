import Link from "next/link";
import { Briefcase, Trophy } from "lucide-react";
import { CountdownPill } from "@/components/shared/countdown-pill";
import { StatusPill } from "@/components/shared/status-pill";

export type HubApplication = {
  id: string;
  title: string;
  status: string;
  /** Nearest upcoming date, already resolved by the hub. */
  date: string | null;
};

const MAX_ROWS = 5;

/**
 * The hub's second column: what's currently in flight across Applications.
 *
 * Read-only by design — the row links through to /applications where the row
 * can be edited, so the dashboard stays a briefing rather than a second editor.
 */
export function ApplicationsPanel({
  jobs,
  hackathons,
}: {
  jobs: HubApplication[];
  hackathons: HubApplication[];
}) {
  const rows = [
    ...jobs.map((j) => ({ ...j, kind: "job" as const })),
    ...hackathons.map((h) => ({ ...h, kind: "hackathon" as const })),
  ]
    .filter((r) => r.date !== null)
    .sort((a, b) => (a.date! < b.date! ? -1 : 1))
    .slice(0, MAX_ROWS);

  return (
    <section className="panel mb-4 px-4 pt-4 md:px-5" aria-label="Applications">
      <header className="mb-2 flex items-center justify-between gap-3">
        <h2 className="text-base font-medium tracking-tight text-foreground">
          In flight
          <span className="ml-2 text-2xs font-normal text-muted-foreground/70">
            {jobs.length + hackathons.length}
          </span>
        </h2>
        <Link
          href="/applications"
          className="text-2xs font-medium text-muted-foreground transition-colors hover:text-foreground"
        >
          All applications
        </Link>
      </header>

      {rows.length === 0 ? (
        <p className="py-6 text-center text-sm text-muted-foreground/70">
          Nothing active right now.
        </p>
      ) : (
        <ul>
          {rows.map((row) => {
            const Icon = row.kind === "job" ? Briefcase : Trophy;
            return (
              <li
                key={`${row.kind}-${row.id}`}
                className="flex items-center gap-3 border-b border-white/[0.06] py-2.5 last:border-b-0"
              >
                <Icon
                  className="h-3.5 w-3.5 shrink-0 text-muted-foreground/70"
                  strokeWidth={1.75}
                />
                <Link
                  href="/applications"
                  className="min-w-0 flex-1 truncate text-sm text-foreground transition-opacity hover:opacity-70"
                >
                  {row.title}
                </Link>
                <StatusPill status={row.status} />
                {row.date && <CountdownPill date={row.date} />}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}