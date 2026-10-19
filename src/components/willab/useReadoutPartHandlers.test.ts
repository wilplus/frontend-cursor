// @vitest-environment jsdom
/*
STORY    As a speaker, I want Delete on the landing text to lift the
         paragraph's lock, and words from an earlier Take to save there too,
         so that the landing copy acts like the main page.
OUTCOME
  O1  Delete lifts the lock on that paragraph and the text is read again.
  O2  Never 5 (helper words stay until the speaker picks new ones): words
      picked from an earlier Take are saved on that paragraph, and its old
      in-text span is cleared only after the save succeeds.
PROVES   O1 -> "Delete lifts the lock on the paragraph"
         O2 -> "words from an earlier Take save on the paragraph"
WHY      F1 Repair Plan Phase 5: the landing copy was missing these handlers.
*/
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

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const TEXT = "First paragraph.\n\nSecond paragraph.";

function setup() {
  const refs = {
    arcIdRef: { current: "arc-1" as string | null },
    textRef: { current: TEXT },
    partsRef: {
      current: [
        { id: "p-1", text: "First paragraph.", locked: true, rootPhrase: "First", rootStart: 0, rootEnd: 5 },
        { id: "p-2", text: "Second paragraph.", locked: true, rootPhrase: "Second", rootStart: 0, rootEnd: 6 },
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

  it("words from an earlier Take save on the paragraph", async () => {
    const { result, setParts } = setup();
    vi.mocked(setPartHelperWordsFromTake).mockResolvedValueOnce(false);
    expect(await result.current.setHelperWordsFromTake(chunk, "the window", 1)).toBe(false);
    // A failed save leaves the speaker's current words untouched.
    expect(setParts).not.toHaveBeenCalled();

    expect(await result.current.setHelperWordsFromTake(chunk, "the window", 1)).toBe(true);
    expect(setPartHelperWordsFromTake).toHaveBeenLastCalledWith("arc-1", "p-2", "the window", 1);
    const saved = setParts.mock.calls[0][0] as Array<{ id: string; rootPhrase: string | null }>;
    expect(saved.find((p) => p.id === "p-2")?.rootPhrase).toBeNull();
    expect(saved.find((p) => p.id === "p-1")?.rootPhrase).toBe("First");
  });
});
