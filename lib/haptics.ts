/**
 * Haptic feedback for mobile — progressive enhancement over the Vibration API.
 *
 * Android Chrome supports `navigator.vibrate`; iOS Safari silently ignores it,
 * so every call is a safe no-op there. Patterns are kept short and low-power so
 * they read as premium ticks rather than phone buzzes, and each interaction
 * type gets its own distinct pattern.
 */

type Pattern = number | number[];

function vibrate(pattern: Pattern) {
  if (typeof navigator === "undefined" || typeof navigator.vibrate !== "function") return;
  try {
    navigator.vibrate(pattern);
  } catch {
    // Haptics must never break an interaction.
  }
}

/** Every pulse fires at the same strength — the Vibration API has no amplitude
 *  control, so intensity = duration. One shared pulse keeps the feel identical
 *  across the whole app; multi-pulse patterns differ only in rhythm. */
const PULSE = 13;

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
  /** Switch-like toggle (pin, privacy): two-step on, single off. */
  toggle: (on: boolean) => vibrate(on ? [PULSE, 30, PULSE] : PULSE),
  /** Positive confirmation — saved, added, completed. */
  success: () => vibrate([PULSE, 45, PULSE]),
  /** Caution before something destructive. */
  warning: () => vibrate([PULSE, 40, PULSE]),
  /** Negative result — validation failure, failed request. */
  error: () => vibrate([PULSE, 50, PULSE, 50, PULSE]),
  /** Destructive commit — delete confirmed. */
  delete: () => vibrate([PULSE, 50, PULSE]),
};