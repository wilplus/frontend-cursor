import { describe, expect, it } from "vitest";
import { AUTOSAVE_DEBOUNCE_MS, shouldAutosaveDraft } from "./autosaveDrafts";

describe("shouldAutosaveDraft", () => {
  it("saves genuinely new text", () => {
    expect(shouldAutosaveDraft("this landed well", null, true)).toBe(true);
    expect(shouldAutosaveDraft("changed", "original", true)).toBe(true);
  });

  it("does not save when nothing changed", () => {
    // An unguarded autosave fires a request per keystroke and makes the last
    // write win a race it did not know it was in.
    expect(shouldAutosaveDraft("same", "same", true)).toBe(false);
    expect(shouldAutosaveDraft("  same  ", "same", true)).toBe(false);
  });

  it("does not save when the server cannot accept it yet", () => {
    // The note rides the VERDICT body: with no verdict there is nothing to
    // attach it to, and the panel says "Saved with your verdict" instead.
    expect(shouldAutosaveDraft("typed something", null, false)).toBe(false);
  });

  it("SAVES a deliberate deletion", () => {
    // Clearing real text is a real edit and must reach the server, or the
    // note the coach removed comes back on the next load.
    expect(shouldAutosaveDraft("", "had a note", true)).toBe(true);
    expect(shouldAutosaveDraft("   ", "had a note", true)).toBe(true);
  });

  it("does not save an empty box that was always empty", () => {
    expect(shouldAutosaveDraft("", null, true)).toBe(false);
    expect(shouldAutosaveDraft("   ", "", true)).toBe(false);
    expect(shouldAutosaveDraft(undefined, undefined, true)).toBe(false);
  });

  it("has a debounce that is neither instant nor lossy", () => {
    // Long enough not to fire mid-word, short enough that a closed tab
    // loses nothing worth missing. Blur flushes immediately regardless.
    expect(AUTOSAVE_DEBOUNCE_MS).toBeGreaterThanOrEqual(500);
    expect(AUTOSAVE_DEBOUNCE_MS).toBeLessThanOrEqual(3000);
  });
});
