# Attention strip regressions

From the repository root, with the existing dependencies installed:

```sh
npm test
```

No new dependencies, generated files, env files, or services are needed. The
test command works offline after dependency installation. The helper transpiles the real TSX and its local
imports in memory with the installed TypeScript, resolves `@/` from the repository
root, and renders with ReactDOMServer. Next Link, Framer Motion, icons, and shared
pills are real, rather than replacement card implementations.

## Desktop selector contract

- Only populated lanes expose `aria-label="<Group> items"`.
- Group names are `Now`, `Coming up`, and `Needs a next step`.
- Arrow names are `Previous <Group> items` and `Next <Group> items`.
- Both arrows' `aria-controls` resolve to the same unique element within that
  lane (or the labelled lane itself), containing that group's cards.
- Empty groups retain desktop status labels, without labelled item lanes,
  empty lists, or arrow controls. Their label markup/wording is otherwise free.

Assertions use rendered elements, names, hrefs, and mobile/md display visibility;
they do not match application source or specific layout/appearance classes.

## Verification boundaries

The initial red run, before the desktop implementation, rendered only 3 of the
7 Coming up hrefs. The complete baseline suite had 9 passes (mobile and all-empty)
and 4 expected desktop failures.

Mobile callback checks capture the real buttons' `onClick` props, replay the
component's state hooks, and re-render through ReactDOMServer. This verifies
selection, independent expansion/collapse, and callback wiring; it does not mount
React in a DOM or verify scheduling, effects, hydration, focus, or browser events.

Visibility checks interpret `hidden` and `md:` display utilities only (the
project's 768px boundary). Cards available inside horizontal overflow count as
desktop-available. A browser check is still needed for vertical lane stacking,
side-by-side card geometry, arrow scrolling/enabled states, compact empty-label
height, and pixel-level mobile appearance/animation. Mobile card text and basic
markup structure are covered without freezing its CSS implementation.

## Local browser verification

The implementation was also checked in a real Chromium browser with synthetic
items and the project's actual component, Tailwind theme, and built font assets.
These were component smoke checks, not an authenticated dashboard E2E run:

- 15 before/after mobile comparisons at 320, 375, 430, 667, and 767px across
  mixed, Coming-up-only, and all-empty states. Geometry, text, and computed
  styling matched; screenshot channels differed by at most one RGB level.
- Desktop lanes at 768, 1024, 1366, 1440, and 1920px: horizontal geometry,
  compact empty labels, no document overflow, both scroll directions, disabled
  endpoints, manual scroll synchronization, and independent group scrolling.
- Mobile expansion/collapse, long text with enlarged fonts, resize handling,
  keyboard Enter on arrows, and reduced-motion navigation.

The browser scenarios and the full offline regression suite are supplemental
local evidence; `npm test` covers the SSR/callback boundaries described above,
not browser geometry or screenshot assertions.
