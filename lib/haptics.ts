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

export const haptics = {
  /** Crisp micro-tick — selection changes: tabs, dropdown picks, accordions. */
  selection: () => vibrate(7),
  /** Lightest tap — small controls: color dots, checkboxes, icon toggles. */
  tapLight: () => vibrate(9),
  /** Standard tap — cards, tiles, list rows, secondary buttons. */
  tap: () => vibrate(13),
  /** Heavier press — FABs and primary actions. */
  impact: () => vibrate(22),
  /** Sheet/modal sliding in. */
  open: () => vibrate(11),
  /** Sheet/modal dismissing — slightly lighter than open. */
  close: () => vibrate(8),
  /** Switch-like toggle (pin, privacy): two-step on, single off. */
  toggle: (on: boolean) => vibrate(on ? [9, 30, 11] : 8),
  /** Positive confirmation — saved, added, completed. */
  success: () => vibrate([11, 45, 17]),
  /** Caution before something destructive. */
  warning: () => vibrate([14, 40, 14]),
  /** Negative result — validation failure, failed request. */
  error: () => vibrate([30, 50, 30, 50, 30]),
  /** Destructive commit — delete confirmed. */
  delete: () => vibrate([20, 50, 28]),
};