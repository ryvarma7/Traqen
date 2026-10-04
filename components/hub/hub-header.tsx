import Link from "next/link";
import { Briefcase, ClipboardList, StickyNote } from "lucide-react";

const QUICK_ACTIONS = [
  {
    href: "/applications?create=1",
    label: "New application",
    short: "Application",
    icon: Briefcase,
  },
  { href: "/tasks?create=1", label: "New task", short: "Task", icon: ClipboardList },
  { href: "/notes?create=1", label: "New note", short: "Note", icon: StickyNote },
];

/**
 * Greeting + date on the left, pill-shaped quick actions on the right.
 *
 * The pills link to the owning page with `?create=1` rather than holding any
 * form state here — the destination view sees the param and opens its own
 * create sheet (see `usePendingCreate`). Labels collapse to just the noun
 * once the row gets tight.
 */
export function HubHeader({ greeting, name }: { greeting: string; name?: string }) {
  return (
    <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
      <div className="min-w-0">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          {greeting}
          {name && <span className="text-foreground/60"> {name}</span>}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          <span suppressHydrationWarning>{formatToday()}</span>
        </p>
      </div>

      <div className="flex shrink-0 flex-wrap items-center gap-2">
        {QUICK_ACTIONS.map(({ href, label, short, icon: Icon }) => (
          <Link key={href} href={href} className="pill-btn">
            <Icon className="h-3.5 w-3.5 shrink-0 text-muted-foreground" strokeWidth={1.75} />
            <span className="hidden sm:inline">{label}</span>
            <span className="sm:hidden">{short}</span>
          </Link>
        ))}
      </div>
    </div>
  );
}

/** "Saturday, October 4". Rendered on the client only — the server and browser
 *  can disagree on the day across a midnight boundary, and this line is
 *  decoration rather than data, so the mismatch is suppressed instead. */
function formatToday() {
  return new Date().toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  });
}