import { Briefcase, StickyNote, Trophy } from "lucide-react";

const FEATURES = [
  { Icon: Briefcase, text: "Every job application, from saved to offer" },
  { Icon: Trophy,    text: "Hackathons with rounds, results and deadlines" },
  { Icon: StickyNote, text: "Tasks and notes right beside each listing" },
];

export function AuthCard({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen items-center justify-center px-4 py-10">
      {/* Outer container */}
      <div className="w-full max-w-4xl">
        <div className="overflow-hidden rounded-[14px] shadow-modal md:grid md:grid-cols-[1.1fr_minmax(0,26rem)]">

          {/* ── Brand panel — desktop only ─────────────────────────────────── */}
          <div
            className="relative hidden flex-col justify-between gap-10 p-10 md:flex"
            style={{
              background: "linear-gradient(150deg, #3A4228 0%, #262B1A 55%, #1A1F10 100%)",
            }}
          >
            {/* Grain texture overlay on brand panel */}
            <div
              aria-hidden
              className="pointer-events-none absolute inset-0"
              style={{
                backgroundImage:
                  "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='180' height='180'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.70' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.5'/%3E%3C/svg%3E\")",
                backgroundRepeat: "repeat",
                opacity: 0.5,
                mixBlendMode: "overlay",
              }}
            />

            {/* Decorative glow orb */}
            <div
              aria-hidden
              className="pointer-events-none absolute -bottom-16 -right-16 h-64 w-64 rounded-full"
              style={{
                background: "radial-gradient(circle, rgba(217,123,10,0.20) 0%, transparent 70%)",
              }}
            />
            <div
              aria-hidden
              className="pointer-events-none absolute -top-12 -left-12 h-48 w-48 rounded-full"
              style={{
                background: "radial-gradient(circle, rgba(107,116,76,0.18) 0%, transparent 70%)",
              }}
            />

            {/* Decorative giant letter */}
            <div
              aria-hidden
              className="pointer-events-none absolute -bottom-8 right-4 select-none font-bold leading-none text-white/[0.03]"
              style={{ fontSize: "18rem", fontStyle: "italic" }}
            >
              T
            </div>

            {/* Logo */}
            <div className="relative flex items-center gap-2.5">
              <span
                className="flex h-9 w-9 items-center justify-center rounded-[10px] text-sm font-bold text-white"
                style={{
                  background: "rgba(217, 123, 10, 0.25)",
                  border: "1px solid rgba(217, 123, 10, 0.40)",
                  boxShadow: "inset 0 1px 0 rgba(255,210,140,0.20)",
                }}
              >
                T
              </span>
              <span className="text-lg font-semibold tracking-tight text-white/90">
                Traqen
              </span>
            </div>

            {/* Tagline + features */}
            <div className="relative">
              <h2 className="text-2xl font-semibold italic leading-snug tracking-tight text-white">
                Every application, hackathon and task — tracked in one place.
              </h2>
              <ul className="mt-8 space-y-3.5">
                {FEATURES.map(({ Icon, text }) => (
                  <li
                    key={text}
                    className="flex items-center gap-3 text-sm"
                    style={{ color: "rgba(255,255,255,0.72)" }}
                  >
                    <span
                      className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg"
                      style={{
                        background: "rgba(217, 123, 10, 0.18)",
                        border: "1px solid rgba(217, 123, 10, 0.28)",
                      }}
                    >
                      <Icon className="h-3.5 w-3.5" style={{ color: "#F0A030" }} />
                    </span>
                    {text}
                  </li>
                ))}
              </ul>
            </div>

            {/* Progress widget */}
            <div
              className="relative rounded-[10px] p-4"
              style={{
                background: "rgba(255,255,255,0.05)",
                border: "1px solid rgba(255,255,255,0.10)",
              }}
            >
              <div className="flex items-center justify-between text-2xs font-medium uppercase tracking-wide" style={{ color: "rgba(255,255,255,0.55)" }}>
                <span>This week</span>
                <span style={{ color: "#F0A030" }}>4 of 6 done</span>
              </div>
              <div className="mt-2.5 h-1.5 overflow-hidden rounded-full" style={{ background: "rgba(255,255,255,0.10)" }}>
                <div
                  className="h-full rounded-full"
                  style={{
                    width: "66.7%",
                    background: "linear-gradient(90deg, #D97B0A, #F0A030)",
                  }}
                />
              </div>
            </div>
          </div>

          {/* ── Form panel ───────────────────────────────────────────────────── */}
          <div
            className="relative bg-surface px-7 py-10"
            style={{
              boxShadow: "inset 4px 0 24px rgba(38, 43, 26, 0.04)",
            }}
          >
            {/* Mobile logo */}
            <div className="mb-7 flex items-center gap-2.5 md:hidden">
              <span
                className="flex h-8 w-8 items-center justify-center rounded-[9px] text-sm font-bold"
                style={{
                  background: "linear-gradient(135deg, #F5E4C0 0%, #FDF0DC 100%)",
                  border: "1px solid #D97B0A",
                  color: "#D97B0A",
                }}
              >
                T
              </span>
              <span className="text-lg font-semibold tracking-tight text-foreground">
                Traqen
              </span>
            </div>

            {/* Title block */}
            <div className="mb-8">
              <h1 className="text-xl font-semibold italic tracking-tight text-foreground">
                {title}
              </h1>
              <p className="mt-1.5 text-sm text-muted-foreground">{subtitle}</p>
              {/* Accent underline */}
              <div
                className="mt-3 h-0.5 w-10 rounded-full"
                style={{ background: "linear-gradient(90deg, #D97B0A, #F0A030)" }}
              />
            </div>

            {children}
          </div>
        </div>
      </div>
    </div>
  );
}