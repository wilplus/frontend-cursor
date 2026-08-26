export const TIP_VISIBLE_MS = 7_000;
export const TIP_FADE_MS = 420;

export interface ProcessingTipFrame {
  readonly index: number;
  readonly visible: boolean;
  readonly nextDelayMs: number;
}

/** Derive the animation frame from an absolute job epoch, not mount time.
 *  This makes unmount/remount a pure presentation change: the same instant
 *  always resolves to the same tip and fade phase. */
export function processingTipFrame(
  now: number,
  cycleStartedAt: number,
  tipCount: number,
): ProcessingTipFrame {
  if (tipCount < 2) {
    return { index: 0, visible: true, nextDelayMs: TIP_VISIBLE_MS };
  }
  const elapsed = Math.max(0, now - cycleStartedAt);
  const boundaries = Math.floor(elapsed / TIP_VISIBLE_MS);
  const within = elapsed % TIP_VISIBLE_MS;
  if (boundaries > 0 && within < TIP_FADE_MS) {
    return {
      index: (boundaries - 1) % tipCount,
      visible: false,
      nextDelayMs: Math.max(1, TIP_FADE_MS - within),
    };
  }
  return {
    index: boundaries % tipCount,
    visible: true,
    nextDelayMs: Math.max(1, TIP_VISIBLE_MS - within),
  };
}
