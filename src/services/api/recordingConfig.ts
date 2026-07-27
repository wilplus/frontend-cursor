import { getAuthToken } from "@/lib/api/auth-client";

/* -------------------------------------------------------------------------- */
/*  recordingConfig — the recording product constants (FE-5)                   */
/*                                                                            */
/*  GET /api/v2/config/recording → { long_take_caution_sec }. Read ONCE at     */
/*  boot and shared, because it is a product constant rather than a per-       */
/*  project field (the arc's /setup payload deliberately does not echo it).    */
/*                                                                            */
/*  NEVER HARDCODE THE THRESHOLD. It is 600 today; the point of serving it is  */
/*  that the founder can move it without a deploy, and a literal 600 anywhere  */
/*  in the FE silently pins it. Unreachable → null, and the caution simply     */
/*  does not fire: advice that fails closed is better than advice fired at a   */
/*  guessed threshold.                                                        */
/* -------------------------------------------------------------------------- */

export interface RecordingConfig {
  /** Offer the long-take caution at a chosen length >= this many seconds.
   *  null when the field is absent (older BE) — no caution. */
  longTakeCautionSec: number | null;
}

export function mapRecordingConfig(raw: unknown): RecordingConfig {
  const r = (raw ?? {}) as Record<string, unknown>;
  const n = r.long_take_caution_sec;
  return {
    longTakeCautionSec:
      typeof n === "number" && Number.isFinite(n) && n > 0 ? n : null,
  };
}

/** Cached for the page's lifetime: the constants do not move mid-session, and
 *  the setup flow can mount several times. */
let cached: Promise<RecordingConfig> | null = null;

export function fetchRecordingConfig(): Promise<RecordingConfig> {
  cached ??= (async () => {
    const token = await getAuthToken();
    if (!token) return { longTakeCautionSec: null };
    try {
      const res = await fetch("/api/v2/config/recording", {
        headers: { Authorization: `Bearer ${token}` },
        cache: "no-store",
      });
      if (!res.ok) return { longTakeCautionSec: null };
      return mapRecordingConfig(await res.json());
    } catch {
      return { longTakeCautionSec: null };
    }
  })();
  return cached;
}

/** Tests only — drop the memoised read. */
export function resetRecordingConfigCache(): void {
  cached = null;
}
