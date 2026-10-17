# Smoothness optimization evidence

## Scope and method

Baseline application source: `90a8fda`. Compared with the performance working
tree on 2026-10-17, using Node 26.2.0 on Windows and installed headless Chromium.
The comparison loader reads baseline source with `git show`; it does not reset
or overwrite the working tree. Existing uncommitted attention-queue changes
were not part of this optimization or its browser fixture.

Reproduce from the repository root after `npm ci`:

```sh
node --test tests/performance.test.cjs
node tests/performance/browser.cjs --baseline 90a8fda
node tests/performance/browser.cjs
node tests/performance/contour-benchmark.cjs
```

The browser fixture uses real React, Framer Motion, components, and Tailwind
styles, with **synthetic data and mocked network/router boundaries**. It serves
only on loopback, uses a temporary browser profile, and cleans up afterwards.
It does not use account cookies, modify Supabase data, or add a production test
route. The fixture is a production-mode standalone component bundle, not the
full Next.js server or an authenticated end-to-end benchmark.

Workload: 120 notes, 120 tasks, 120 job applications, 30 track summaries, one
20-step track, and a hub with 24 note previews. Viewports are 1440×900 and
375×900, DPR 1. Inspect initial DOM 700ms after mount. Repeat 20 editor keystrokes
and one calendar-day selection three times, remounting between runs. Render
counters are injected only by the test loader, never shipped in the app.

## Deterministic render-work results

All three interaction samples returned the same before/after counts.

| Workload / metric | Before | After | Difference |
| --- | ---: | ---: | --- |
| 20 note-editor keystrokes: grid-tile renders | 2,400 | 0 | 2,400 unnecessary renders removed |
| Select a calendar day: day-cell renders | 42 | 2 | 95.2% fewer |
| Task edit controls mounted, either viewport | 240 | 120 | 50% fewer; no hidden duplicate list |
| Track-step checkboxes mounted, either viewport | 40 | 20 | 50% fewer; no hidden duplicate plan |
| Calendar agendas mounted | 2 | 1 | No hidden duplicate agenda |
| Applications total DOM nodes, desktop | 3,301 | 2,220 | 32.7% fewer |
| Applications total DOM nodes, mobile | 3,301 | 1,225 | 62.9% fewer |
| Tasks total DOM nodes, desktop | 3,424 | 1,723 | 49.7% fewer |
| Tasks total DOM nodes, mobile | 3,424 | 1,729 | 49.5% fewer |
| Last note tile opacity at 700ms, either viewport | 0 | 1 | Collection no longer waits for a six-second stagger |

Entrances now cap the 50ms stagger at 250ms; including the 250ms animation,
every list item is scheduled to settle within 500ms. This is a timing budget,
not a guarantee that an overloaded device meets that deadline.

## Frame pacing: no universal 60 FPS claim

Each section was warm-mounted for 700ms, then scrolled through a fixed sinusoidal
path for three 1.2-second samples using `requestAnimationFrame` timestamps.
These are browser callback intervals, **not compositor presentation telemetry**.

Early matched runs on this host had roughly 16.7ms median intervals and no
intervals over 20ms for both revisions. The final matched run below instead
scheduled at roughly 33.3ms for both. This host/browser variability means the
test does **not** establish a frame-rate improvement or prove the 60 FPS target.

Final run, individual median intervals in milliseconds:

| Section | Before, runs 1 / 2 / 3 | After, runs 1 / 2 / 3 |
| --- | --- | --- |
| Notes | 33.3 / 33.3 / 33.3 | 33.3 / 33.3 / 33.3 |
| Tasks | 33.3 / 33.4 / 33.3 | 33.4 / 33.4 / 33.3 |
| Applications | 33.3 / 33.3 / 33.3 | 33.3 / 33.4 / 33.3 |
| Track summaries | 33.4 / 33.3 / 33.3 | 33.3 / 33.3 / 33.3 |
| Track detail | 33.4 / 33.3 / 33.3 | 33.4 / 33.3 / 33.3 |
| Login contours | 33.3 / 33.3 / 33.3 | 33.3 / 33.3 / 33.3 |
| Hub panels | 33.4 / 33.3 / 33.3 | 33.3 / 33.3 / 33.3 |

The reliable improvement is **less DOM, less render work, and bounded animation
latency**. Verify actual 60/90/120Hz presentation using a production deployment
and browser performance traces on target phones and laptops, including large
real-world lists and slow network conditions. No hardware-independent FPS
guarantee is possible.

## Login math and shared animation work

The login canvas caches angular terms and uses angle-addition identities. Its
per-frame trigonometric calls fall from **5,733 to 24**. An offline regression
compares every vertex and each ring's opacity at three viewport sizes and four
timestamps against the original formula, with a coordinate tolerance of 1e-8.
Reduced motion now responds to preference changes and repaints a static frame
after resize; hidden tabs do not run a continuous drawing loop.

An isolated CPU microbenchmark draws 600 frames at 1440×900 into a no-op drawing
sink, with both formulas in the same JavaScript realm. After one 600-frame
warmup per version, five alternating-order samples produced:

| Sample | Original math, ms | Cached math, ms |
| --- | ---: | ---: |
| 1 | 190.454 | 26.330 |
| 2 | 186.148 | 27.150 |
| 3 | 152.217 | 18.116 |
| 4 | 137.649 | 17.314 |
| 5 | 139.349 | 17.988 |
| Median | 152.217 | 18.116 |

The median math/sink cost is 88.1% lower in this run; noticeable host variation
is retained above. This excludes real Canvas rasterization, GPU work, and the
one-time angular-cache construction, so it is **not an 88% whole-page speedup**.

Other focused changes:

- Track progress uses left-origin `scaleX`, not per-frame width/layout changes.
- Mobile accordions mount natural-height content with blur/opacity and position
  transitions instead of repeatedly laying out every row during height tweens.
- Resting shared entrance filters settle to `none`, releasing filter surfaces.
- Navigation blur covers the visible viewport slice, not a full long document;
  scroll/resize reads are coalesced to one per animation frame and cancelled on
  cleanup. Unchanged geometry does not cause repeated state updates.
- Application/task forms are code-split and loaded on demand with accessible
  loading feedback, rather than included in the initial section bundle.
- Shared reduced-motion handling covers JS blur/delays and pre-hydration CSS
  effects. CSS control transitions target named properties, not `all`.

## Checks and remaining gaps

The isolated Chromium regressions passed for both viewports, with no horizontal
overflow or uncaught browser exceptions. They also exercised lazy form loading,
Escape dismissal, note privacy success/failure rollback, mobile accordions,
viewport-bounded navigation blur, and static reduced-motion canvas resizing.

The offline suite has four tests: frame-event coalescing/cancellation, bounded
list timing, contour geometry/brightness equivalence, and contour trig-call
budget. The existing separate attention-strip suite has 13 passing tests and
was left untouched. ESLint, strict TypeScript checking, and the Next.js
production build were also run during this change.

Tradeoffs and follow-up:

- Responsive content now mounts one active tree. Crossing the `md` breakpoint
  remounts that content and can reset an unsaved inline application-notes draft.
  View-owned modal drafts remain outside the responsive branches.
- SSR still uses a stable desktop snapshot; the mobile branch appears on
  hydration. `useSyncExternalStore` avoids an extra effect-based delay on later
  client-only mounts, without introducing a hydration mismatch.
- Lists are not virtualized. The measured workload is 120 rows; thousands of
  records need a separate measured windowing/pagination decision that preserves
  masonry layout, keyboard access, and in-page search.
- Real OAuth, database writes, deployment/network latency, and target-device
  frame presentation were not tested by the synthetic browser fixture.
- Node is pinned, and setup/Docker instructions are in `README.md`. The Docker
  daemon query timed out on this host; the Linux image build was **not verified**.
