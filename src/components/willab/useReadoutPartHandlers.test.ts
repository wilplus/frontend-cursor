// @vitest-environment jsdom
/* The landing copy of the text screen gets the main page's handlers (F1
   Repair Plan Phase 5): Delete lifts the lock, and words from an earlier
   Take save. */
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it, vi } from "vitest";
import type { DeckChunk } from "@/lib/willab/deckChunks";
import { setPartHelperWordsFromTake, setPartLock } from "@/services/api/partLock";
import { useReadoutPartHandlers } from "./useReadoutPartHandlers";

vi.mock("@/services/api/partLock", () => ({
  setPartLock: vi.fn(async () => ({ kind: "ok", rootPhraseProposal: null })),
  setPartHelperWordsFromTake: vi.fn(async () => true),
}));

const TEXT = "First paragraph.\n\nSecond paragraph.";

function setup() {
  const refs = {
    arcIdRef: { current: "arc-1" as string | null },
    textRef: { current: TEXT },
    partsRef: {
      current: [
        { id: "p-1", text: "First paragraph.", locked: true },
        { id: "p-2", text: "Second paragraph.", locked: true },
      ] as never,
    },
  };
  const setParts = vi.fn();
  const refetch = vi.fn();
  const result = { current: null as unknown as ReturnType<typeof useReadoutPartHandlers> };
  function Probe() {
    result.current = useReadoutPartHandlers({ ...refs, setParts, refetch });
    return null;
  }
  const root = createRoot(document.createElement("div"));
  act(() => root.render(createElement(Probe)));
  return { result, refs, setParts, refetch };
}

const chunk = { paragraphIndex: 1 } as DeckChunk;

describe("useReadoutPartHandlers", () => {
  it("Delete lifts the lock on the paragraph", async () => {
    const { result, refetch } = setup();
    expect(await result.current.unlockPart(chunk)).toBe(true);
    expect(setPartLock).toHaveBeenCalledWith("arc-1", "p-2", false, TEXT);
    expect(refetch).toHaveBeenCalled();
  });

  it("words from an earlier Take save on the paragraph's Slide", async () => {
    const { result, setParts } = setup();
    expect(await result.current.setHelperWordsFromTake(chunk, "second", 1)).toBe(true);
    expect(setPartHelperWordsFromTake).toHaveBeenCalledWith("arc-1", "p-2", "second", 1);
    expect(setParts).toHaveBeenCalled();
  });

  it("refuses without a project", async () => {
    const { result, refs } = setup();
    refs.arcIdRef.current = null;
    expect(await result.current.unlockPart(chunk)).toBe(false);
  });
});
