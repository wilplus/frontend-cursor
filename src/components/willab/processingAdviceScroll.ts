const ADVICE_SCROLL_KEY = "willab:processing-advice-scroll";

type AdviceStorage = Pick<Storage, "getItem" | "setItem">;

/** Browser storage is an enhancement, never part of the upload contract.
 * iOS/PWA webviews may expose sessionStorage while throwing SecurityError on
 * access. Nothing on the waiting screen may throw before LabOverlay's parent
 * effect has sent the recording. */
export function availableAdviceStorage(): AdviceStorage | null {
  try {
    return typeof window === "undefined" ? null : window.sessionStorage;
  } catch {
    return null;
  }
}

export function readAdviceScroll(
  storage: AdviceStorage | null | undefined
): number {
  try {
    const saved = Number(storage?.getItem(ADVICE_SCROLL_KEY) ?? 0);
    return Number.isFinite(saved) && saved >= 0 ? saved : 0;
  } catch {
    return 0;
  }
}

export function writeAdviceScroll(
  storage: AdviceStorage | null | undefined,
  scrollTop: number
): void {
  try {
    storage?.setItem(ADVICE_SCROLL_KEY, String(Math.max(0, scrollTop)));
  } catch {
    // Storage is optional. Losing a reading position must never lose a take.
  }
}
