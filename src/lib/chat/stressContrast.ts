/**
 * Stress-Contrast helpers — pure functions for parsing and formatting
 * the `contrast: {...}` block returned by BE-3 on
 * `/v2/user/results/<session_id>?include_contrast=true`.
 *
 * Backend shape (see services/db.py::compute_stress_contrast):
 *
 *   {
 *     samples: { official: N, casual: M },     // sample counts per side
 *     deltas:  { wpm_delta?, pause_ms_delta?, dynamic_db_delta? },
 *     sign_convention: "positive_delta_means_official_greater_than_casual"
 *   }
 *
 * Backend returns `contrast: null` (or omits the field) when either
 * side has fewer than 3 samples, OR when both sides exist but no
 * shared metric has a numeric reading. Per matrix C7 the FE renders
 * NOTHING in that case — not a placeholder, the card is fully absent.
 *
 * Sign convention is locked: positive delta = official > casual =
 * the metric increases in high-stakes vs casual context. We trust
 * the string the backend emits and log loud if it ever flips.
 */

const EXPECTED_SIGN_CONVENTION =
  "positive_delta_means_official_greater_than_casual";

export interface StressContrastData {
  samples: { official: number; casual: number };
  /**
   * Parsed delta rows. Each is `{ metric_key, value, copy }` where
   * metric_key is the backend's column name (`wpm`, `pause_ms`,
   * `dynamic_db`), value is the signed delta, and copy is the
   * pre-formatted human label respecting the sign convention.
   */
  rows: StressContrastRow[];
}

export interface StressContrastRow {
  /** Backend metric key without the `_delta` suffix. */
  metric: "wpm" | "pause_ms" | "dynamic_db";
  /** Signed delta (official - casual). */
  delta: number;
  /** Display string with unit and sign, e.g. "+12 WPM" / "-50 ms". */
  valueLabel: string;
  /** Short interpretation respecting the sign convention. */
  interpretation: string;
}

/**
 * Type-narrow + validate the raw backend block. Returns null when the
 * card MUST NOT render (missing block, empty deltas, broken sign
 * convention with no recoverable rows). Logs a console.warn on a
 * known but tolerable shape mismatch so the BE→FE coupling stays
 * loud.
 */
export function parseStressContrast(
  raw: unknown
): StressContrastData | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as {
    samples?: { official?: number; casual?: number } | null;
    deltas?: Record<string, unknown> | null;
    sign_convention?: string;
  };

  const sign = r.sign_convention;
  if (typeof sign === "string" && sign !== EXPECTED_SIGN_CONVENTION) {
    // Loud signal — the card's copy is hard-coded to the
    // "positive = under-pressure greater" reading. If backend
    // flips the convention without coordinating the matrix doc,
    // every interpretation here would read backward.
    console.warn(
      `stress-contrast: unexpected sign_convention="${sign}" ` +
        `(expected "${EXPECTED_SIGN_CONVENTION}"). Card copy may be ` +
        `inverted; update parseStressContrast + matrix pin.`
    );
  }

  const samples = r.samples;
  if (
    !samples ||
    typeof samples.official !== "number" ||
    typeof samples.casual !== "number"
  ) {
    return null;
  }

  const deltas = r.deltas;
  if (!deltas || typeof deltas !== "object") return null;

  const rows: StressContrastRow[] = [];
  for (const metric of ["wpm", "pause_ms", "dynamic_db"] as const) {
    const key = `${metric}_delta`;
    const value = (deltas as Record<string, unknown>)[key];
    if (typeof value !== "number" || !Number.isFinite(value)) continue;
    rows.push(formatStressContrastRow(metric, value));
  }
  if (rows.length === 0) return null;

  return { samples: { official: samples.official, casual: samples.casual }, rows };
}

/**
 * Compose one display row. Exposed for tests + so the card component
 * can re-use the same wording rules if a future row arrives outside
 * the parse path.
 */
export function formatStressContrastRow(
  metric: "wpm" | "pause_ms" | "dynamic_db",
  delta: number
): StressContrastRow {
  const rounded = Math.round(delta * 10) / 10;
  const sign = rounded > 0 ? "+" : rounded < 0 ? "−" : "±";
  const abs = Math.abs(rounded);

  let unit: string;
  switch (metric) {
    case "wpm":
      unit = "WPM";
      break;
    case "pause_ms":
      unit = "ms";
      break;
    case "dynamic_db":
      unit = "dB";
      break;
  }

  // Pretty-print: drop ".0" tail on integer values so "+12.0 WPM"
  // reads as "+12 WPM".
  const valuePart = Number.isInteger(abs) ? `${abs}` : abs.toFixed(1);
  const valueLabel = `${sign}${valuePart} ${unit}`;

  // Interpretation respects the sign convention: positive = the
  // metric is HIGHER in high-stakes than casual. The copy below is
  // intentionally short — designed to land as a single bullet under
  // each row, not a paragraph.
  let interpretation: string;
  if (rounded === 0) {
    interpretation = "No change between casual and pressure.";
  } else if (rounded > 0) {
    switch (metric) {
      case "wpm":
        interpretation = "Speaks faster under pressure.";
        break;
      case "pause_ms":
        interpretation = "Pauses longer under pressure.";
        break;
      case "dynamic_db":
        interpretation = "Louder under pressure.";
        break;
    }
  } else {
    switch (metric) {
      case "wpm":
        interpretation = "Slows down under pressure.";
        break;
      case "pause_ms":
        interpretation = "Pauses less under pressure.";
        break;
      case "dynamic_db":
        interpretation = "Quieter under pressure.";
        break;
    }
  }

  return { metric, delta: rounded, valueLabel, interpretation };
}

/** Human-readable metric label for the card. */
export function stressContrastMetricLabel(
  metric: StressContrastRow["metric"]
): string {
  switch (metric) {
    case "wpm":
      return "Pace";
    case "pause_ms":
      return "Pausing";
    case "dynamic_db":
      return "Volume";
  }
}
