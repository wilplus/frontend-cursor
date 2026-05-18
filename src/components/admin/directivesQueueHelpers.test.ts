import { describe, expect, it } from "vitest";
import {
  canSave,
  emptyRow,
  emptyRows,
  hasBackendArc,
  isDirty,
  MAX_ARC_ROWS,
  patchRow,
  rowsForSave,
  rowsFromBackend,
  rowsFromSuggestions,
} from "./directivesQueueHelpers";

describe("directivesQueueHelpers", () => {
  describe("emptyRows()", () => {
    it("returns exactly 5 blank rows", () => {
      const rows = emptyRows();
      expect(rows).toHaveLength(MAX_ARC_ROWS);
      for (const r of rows) {
        expect(r.intent_tag).toBe("");
        expect(r.question).toBe("");
        expect(r.exhausted).toBe(false);
      }
    });
  });

  describe("rowsFromBackend()", () => {
    it("pads to 5 rows when backend returns fewer", () => {
      const rows = rowsFromBackend([
        { position: 1, intent_tag: "warm-up", question: "Hi?", exhausted: false },
      ]);
      expect(rows).toHaveLength(5);
      expect(rows[0].question).toBe("Hi?");
      expect(rows[1].question).toBe("");
    });

    it("sorts by position so out-of-order backend rows don't shuffle the UI", () => {
      const rows = rowsFromBackend([
        { position: 3, intent_tag: "challenge", question: "Q3", exhausted: false },
        { position: 1, intent_tag: "warm-up", question: "Q1", exhausted: true },
        { position: 2, intent_tag: "probe", question: "Q2", exhausted: false },
      ]);
      expect(rows[0].question).toBe("Q1");
      expect(rows[0].exhausted).toBe(true);
      expect(rows[1].question).toBe("Q2");
      expect(rows[2].question).toBe("Q3");
    });

    it("caps at MAX_ARC_ROWS — backend's row 6+ is dropped", () => {
      const rows = rowsFromBackend(
        Array.from({ length: 8 }, (_, i) => ({
          position: i + 1,
          intent_tag: `tag-${i}`,
          question: `Q${i + 1}`,
          exhausted: false,
        }))
      );
      expect(rows).toHaveLength(5);
      expect(rows[4].question).toBe("Q5");
    });

    it("handles null / empty backend input as empty form", () => {
      expect(rowsFromBackend(null)).toEqual(emptyRows());
      expect(rowsFromBackend(undefined)).toEqual(emptyRows());
      expect(rowsFromBackend([])).toEqual(emptyRows());
    });
  });

  describe("rowsFromSuggestions()", () => {
    it("seeds rows with exhausted=false regardless of input", () => {
      const rows = rowsFromSuggestions([
        { intent_tag: "warm-up", question: "Hi?" },
      ]);
      expect(rows[0]).toEqual({
        intent_tag: "warm-up",
        question: "Hi?",
        exhausted: false,
      });
      expect(rows).toHaveLength(5);
    });
  });

  describe("patchRow()", () => {
    it("immutably patches the row at idx", () => {
      const before = emptyRows();
      const after = patchRow(before, 2, { question: "Q3" });
      expect(after[2].question).toBe("Q3");
      // Original untouched
      expect(before[2].question).toBe("");
      // Other rows untouched
      expect(after[0]).toBe(before[0]);
      expect(after[1]).toBe(before[1]);
    });

    it("is a no-op on out-of-range idx (defensive — no panic)", () => {
      const before = emptyRows();
      expect(patchRow(before, -1, { question: "X" })).toBe(before);
      expect(patchRow(before, 99, { question: "X" })).toBe(before);
    });
  });

  describe("rowsForSave()", () => {
    it("drops empty rows and trims kept rows", () => {
      const rows = [
        { intent_tag: "  warm-up  ", question: "  Hi?  ", exhausted: false },
        { intent_tag: "", question: "", exhausted: false },
        { intent_tag: "probe", question: "Deeper?", exhausted: false },
        emptyRow(),
        emptyRow(),
      ];
      expect(rowsForSave(rows)).toEqual([
        { intent_tag: "warm-up", question: "Hi?" },
        { intent_tag: "probe", question: "Deeper?" },
      ]);
    });

    it("preserves empty intent_tag on kept rows — backend tolerates it", () => {
      const rows = [
        { intent_tag: "", question: "Hi?", exhausted: false },
        ...emptyRows().slice(1),
      ];
      expect(rowsForSave(rows)).toEqual([
        { intent_tag: "", question: "Hi?" },
      ]);
    });
  });

  describe("canSave()", () => {
    it("requires row 1 to have BOTH intent_tag and question", () => {
      const base = emptyRows();
      expect(canSave(base)).toBe(false);

      expect(
        canSave([
          { intent_tag: "warm-up", question: "", exhausted: false },
          ...base.slice(1),
        ])
      ).toBe(false);

      expect(
        canSave([
          { intent_tag: "", question: "Hi?", exhausted: false },
          ...base.slice(1),
        ])
      ).toBe(false);

      expect(
        canSave([
          { intent_tag: "warm-up", question: "Hi?", exhausted: false },
          ...base.slice(1),
        ])
      ).toBe(true);
    });

    it("ignores whitespace-only values", () => {
      expect(
        canSave([
          { intent_tag: "  ", question: "  ", exhausted: false },
          ...emptyRows().slice(1),
        ])
      ).toBe(false);
    });
  });

  describe("isDirty()", () => {
    it("returns false when local matches baseline", () => {
      const a = emptyRows();
      const b = emptyRows();
      expect(isDirty(a, b)).toBe(false);
    });

    it("ignores trailing whitespace", () => {
      const baseline = [
        { intent_tag: "warm-up", question: "Hi?", exhausted: false },
        ...emptyRows().slice(1),
      ];
      const local = [
        { intent_tag: "warm-up  ", question: "  Hi?", exhausted: false },
        ...emptyRows().slice(1),
      ];
      expect(isDirty(local, baseline)).toBe(false);
    });

    it("returns true on any real edit", () => {
      const baseline = emptyRows();
      const local = patchRow(baseline, 1, { question: "Q2" });
      expect(isDirty(local, baseline)).toBe(true);
    });
  });

  describe("hasBackendArc()", () => {
    it("true when any baseline row has a non-empty question", () => {
      const baseline = [
        emptyRow(),
        { intent_tag: "", question: "Q2", exhausted: false },
        ...emptyRows().slice(2),
      ];
      expect(hasBackendArc(baseline)).toBe(true);
    });

    it("false on a fully-empty baseline (admin draft against nothing)", () => {
      expect(hasBackendArc(emptyRows())).toBe(false);
    });
  });
});
