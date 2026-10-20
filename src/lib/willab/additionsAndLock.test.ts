/*
STORY    As a speaker, I want rewording a locked paragraph to keep it the same paragraph but need a new lock, so that a lock always protects my exact words.
OUTCOME
  O1  After a reword the paragraph keeps its identity, has the new words and is no longer locked.
PROVES   O1 -> keeps identity but reopens after a reword
*/
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
