/**
 * Haptic feedback for mobile — progressive enhancement over the Vibration API.
 *
 * Android Chrome supports `navigator.vibrate`; iOS Safari silently ignores it,
 * so every call is a safe no-op there and nothing in the app depends on the
 * feedback landing. There is no web API for amplitude, so **intensity is fixed
 * at a single 13ms pulse** and never varies — perceived weight comes from
 * rhythm, which is what the multi-pulse patterns below are for.
 */

type Pattern = number | number[];

/** Every pulse fires at the same strength — the Vibration API has no amplitude
 *  control, so intensity = duration. One shared pulse keeps the feel identical
 *  across the whole app; multi-pulse patterns differ only in rhythm. */
const PULSE = 13;

/** Consecutive identical calls inside this window collapse into one. Real
 *  devices fire a `whileTap` and a child's `onClick` for the same gesture, and
 *  a fast scroll triggers a burst — without this guard the phone buzzes twice
 *  for one tap, which is the single biggest thing that reads as cheap.
 *  Kept short (70ms) so two deliberate taps in a row still both register. */
const REPEAT_GUARD_MS = 70;

let lastPattern: Pattern | null = null;
let lastAt = 0;

function vibrate(pattern: Pattern) {
  if (typeof navigator === "undefined" || typeof navigator.vibrate !== "function") return;

  const now = Date.now();
  if (lastPattern === pattern && now - lastAt < REPEAT_GUARD_MS) return;
  lastPattern = pattern;
  lastAt = now;

  try {
    navigator.vibrate(pattern);
  } catch {
    // Haptics must never break an interaction.
  }
}

export const haptics = {
  /** Crisp tick — selection changes: tabs, dropdown picks, accordions. */
  selection: () => vibrate(PULSE),
  /** Light tap — small controls: color dots, checkboxes, icon toggles. */
  tapLight: () => vibrate(PULSE),
  /** Standard tap — cards, tiles, list rows, secondary buttons. */
  tap: () => vibrate(PULSE),
  /** Press — FABs and primary actions. */
  impact: () => vibrate(PULSE),
  /** Sheet/modal sliding in. */
  open: () => vibrate(PULSE),
  /** Sheet/modal dismissing. */
  close: () => vibrate(PULSE),

  /* ── Rhythms ─────────────────────────────────────────────────────────────
   * The gaps below are what separate the outcomes. Each one used to sit within
   * 40–50ms of the others, so success, warning and error all felt like the same
   * buzz; the spacing is now distinct enough to identify without looking at
   * the screen, while the pulse itself stays 13ms throughout. */

  /** Switch-like toggle (pin, privacy): a tight double going on, single off. */
  toggle: (on: boolean) => vibrate(on ? [PULSE, 24, PULSE] : PULSE),

  /** Positive confirmation — saved, added, completed. Short, closed gap. */
  success: () => vibrate([PULSE, 52, PULSE]),

  /** Caution before something destructive. Wider and more hesitant. */
  warning: () => vibrate([PULSE, 95, PULSE]),

  /** Destructive commit — delete confirmed. One long beat, then out. */
  delete: () => vibrate([PULSE, 140, PULSE]),

  /** Negative result — validation failure, failed request. Three pulses,
   *  the last one landing late so it reads as "stop", not "again". */
  error: () => vibrate([PULSE, 45, PULSE, 120, PULSE]),
};