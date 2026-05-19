import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import {
  formatStressContrastRow,
  parseStressContrast,
  stressContrastMetricLabel,
} from "./stressContrast";

describe("stressContrast", () => {
  let warnSpy: ReturnType<typeof vi.spyOn>;
  beforeEach(() => {
    warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
  });
  afterEach(() => {
    warnSpy.mockRestore();
  });

  describe("parseStressContrast()", () => {
    it("returns null on null / undefined / non-object", () => {
      expect(parseStressContrast(null)).toBeNull();
      expect(parseStressContrast(undefined)).toBeNull();
      expect(parseStressContrast("nope")).toBeNull();
      expect(parseStressContrast(42)).toBeNull();
    });

    it("returns null when samples are missing", () => {
      expect(
        parseStressContrast({
          deltas: { wpm_delta: 5 },
          sign_convention: "positive_delta_means_official_greater_than_casual",
        })
      ).toBeNull();
    });

    it("returns null when deltas is empty / missing", () => {
      expect(
        parseStressContrast({
          samples: { official: 5, casual: 5 },
          deltas: {},
          sign_convention: "positive_delta_means_official_greater_than_casual",
        })
      ).toBeNull();
    });

    it("returns null when no recognized delta keys are numeric", () => {
      expect(
        parseStressContrast({
          samples: { official: 5, casual: 5 },
          deltas: { random_other_delta: 7 },
        })
      ).toBeNull();
    });

    it("parses the full BE-3 shape (wpm + pause_ms + dynamic_db)", () => {
      const result = parseStressContrast({
        samples: { official: 5, casual: 5 },
        deltas: {
          wpm_delta: 20,
          pause_ms_delta: 50,
          dynamic_db_delta: 2,
        },
        sign_convention: "positive_delta_means_official_greater_than_casual",
      });
      expect(result).not.toBeNull();
      expect(result!.samples).toEqual({ official: 5, casual: 5 });
      expect(result!.rows).toHaveLength(3);
      expect(result!.rows.map((r) => r.metric)).toEqual([
        "wpm",
        "pause_ms",
        "dynamic_db",
      ]);
      // Sign convention valid → no warn fired.
      expect(warnSpy).not.toHaveBeenCalled();
    });

    it("skips non-numeric / non-finite delta values silently", () => {
      const result = parseStressContrast({
        samples: { official: 5, casual: 5 },
        deltas: {
          wpm_delta: 20,
          pause_ms_delta: "not a number",
          dynamic_db_delta: NaN,
        },
      });
      expect(result).not.toBeNull();
      // Only wpm row survives; the other two get dropped.
      expect(result!.rows.map((r) => r.metric)).toEqual(["wpm"]);
    });

    it("warns LOUD when sign_convention flips (contract violation)", () => {
      const result = parseStressContrast({
        samples: { official: 5, casual: 5 },
        deltas: { wpm_delta: 20 },
        sign_convention: "positive_delta_means_casual_greater_than_official",
      });
      // Still returns a row — admin can read it but the warn flags the
      // contract drift for engineering.
      expect(result).not.toBeNull();
      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringMatching(/sign_convention/i)
      );
    });

    it("tolerates absent sign_convention without a warn", () => {
      // Backend may legitimately omit the key on legacy rows; we
      // don't want a noisy warn for that case.
      const result = parseStressContrast({
        samples: { official: 5, casual: 5 },
        deltas: { wpm_delta: 20 },
      });
      expect(result).not.toBeNull();
      expect(warnSpy).not.toHaveBeenCalled();
    });
  });

  describe("formatStressContrastRow()", () => {
    it("positive wpm → +N WPM + 'faster under pressure'", () => {
      const row = formatStressContrastRow("wpm", 12);
      expect(row).toEqual({
        metric: "wpm",
        delta: 12,
        valueLabel: "+12 WPM",
        interpretation: "Speaks faster under pressure.",
      });
    });

    it("negative wpm → −N WPM + 'slows down under pressure'", () => {
      const row = formatStressContrastRow("wpm", -8);
      expect(row.valueLabel).toBe("−8 WPM");
      expect(row.interpretation).toBe("Slows down under pressure.");
    });

    it("zero delta → ± + 'no change' copy", () => {
      const row = formatStressContrastRow("pause_ms", 0);
      expect(row.valueLabel).toBe("±0 ms");
      expect(row.interpretation).toMatch(/no change/i);
    });

    it("pause_ms positive → +N ms + 'pauses longer'", () => {
      const row = formatStressContrastRow("pause_ms", 50);
      expect(row.valueLabel).toBe("+50 ms");
      expect(row.interpretation).toBe("Pauses longer under pressure.");
    });

    it("dynamic_db positive → +N dB + 'louder'", () => {
      const row = formatStressContrastRow("dynamic_db", 2);
      expect(row.valueLabel).toBe("+2 dB");
      expect(row.interpretation).toBe("Louder under pressure.");
    });

    it("drops trailing .0 on integer deltas, keeps single decimal otherwise", () => {
      expect(formatStressContrastRow("wpm", 12.0).valueLabel).toBe("+12 WPM");
      expect(formatStressContrastRow("wpm", 12.34).valueLabel).toBe("+12.3 WPM");
    });
  });

  describe("stressContrastMetricLabel()", () => {
    it.each([
      ["wpm", "Pace"],
      ["pause_ms", "Pausing"],
      ["dynamic_db", "Volume"],
    ] as const)("%s → %s", (metric, label) => {
      expect(stressContrastMetricLabel(metric)).toBe(label);
    });
  });
});
