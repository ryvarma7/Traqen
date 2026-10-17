/** Coalesce noisy scroll/resize events into one read per animation frame.
 *  Construct inside an effect and cancel on cleanup (including Strict Mode). */
export function createFrameScheduler(
  callback: () => void,
  request: (callback: FrameRequestCallback) => number = requestAnimationFrame,
  cancel: (handle: number) => void = cancelAnimationFrame
) {
  let handle: number | null = null;
  return {
    schedule() {
      if (handle !== null) return;
      handle = request(() => {
        handle = null;
        callback();
      });
    },
    cancel() {
      if (handle === null) return;
      cancel(handle);
      handle = null;
    },
  };
}
