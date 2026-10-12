import { describe, expect, it } from "vitest";
import {
  updatePart,
  type Part,
} from "./documentParts";

describe("the lock belongs to the PART, not to the words", () => {
  const locked = (id: string, text: string): Part => ({
    id,
    text,
    locked: true,
  });

  it("keeps identity but reopens after a reword", () => {
    // A commit protects exact words. Editing creates a working copy on the
    // same Paragraph identity and requires a new explicit lock.
    const out = updatePart([locked("a", "Original.")], 0, "Reworded.");
    expect(out[0]).toEqual({ id: "a", text: "Reworded.", locked: false });
  });
});
