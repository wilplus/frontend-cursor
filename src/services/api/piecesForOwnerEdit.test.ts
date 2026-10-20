/*
STORY    As a speaker, I want my slides to stay intact whether or not I have
         edited my Ideal Text, and the app to refuse to guess when I added or
         removed paragraphs, so that a paragraph never lands on the wrong slide
         and the deck never collapses into one block.
OUTCOME
  O1  No edit yet (owner_edit {text: null, parts: []}): the core read keeps
      the server's Paragraph -> Slide mapping and the server's part ids.
  O2  An edit with the same paragraph count: each slide keeps its paragraph,
      now under the edit's part id, so the zip matches the parts served.
  O3  An edit that added or removed a paragraph: no mapping is guessed
      (pieces is null, the deck shows unlinked).
PROVES   O1 -> "keeps the server's slide mapping when there is no edit yet"
         O2 -> "re-keys each slide's paragraph to the edit's part id"
         O3 -> "refuses to guess when a paragraph was added or removed"
WHY      Production 2026-09-19: an empty owner edit was read as an edit (a
         truthiness check) and the deck lost its slides.
*/
import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchIdealTextCore, type IdealPiece } from "./idealText";

vi.mock("@/lib/api/auth-client", () => ({ getAuthToken: async () => "tok" }));

afterEach(() => vi.unstubAllGlobals());

const A = "11111111-1111-4111-8111-111111111111";
const B = "22222222-2222-4222-8222-222222222222";
const EA = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const EB = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";

const NO_EDIT = {
  text: null,
  source_document_version: null,
  user_text_revision: null,
  user_text_sha256: null,
  parts: [],
  current_bundle_text_update_binding: null,
};

function edit(texts: [string, string][]) {
  return {
    text: texts.map(([, text]) => text).join("\n\n"),
    source_document_version: 3,
    user_text_revision: "7",
    user_text_sha256: "b".repeat(64),
    parts: texts.map(([id, text], ord) => ({
      id, ord, text, locked: false, current_part_revision_id: null,
    })),
    current_bundle_text_update_binding: null,
  };
}

async function readCore(ownerEdit: unknown) {
  const body = {
    status: "unverified",
    text: "We start here.\n\nThen we go.",
    version: 3,
    pieces: [
      { piece_key: 0, part_id: A, text: "We start here.", slide_index: 0 },
      { piece_key: 1, part_id: B, text: "Then we go.", slide_index: 1 },
    ],
    parts: [
      { id: A, text: "We start here.", locked: false },
      { id: B, text: "Then we go.", locked: false },
    ],
    owner_edit: ownerEdit,
  };
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => ({ ok: true, status: 200, json: async () => body })),
  );
  const result = await fetchIdealTextCore("arc-1");
  if (result.kind !== "single") throw new Error("expected the core document");
  return result;
}

const slides = (pieces: IdealPiece[] | null) =>
  pieces?.map((p) => [p.partId, p.slideIndex]) ?? null;

describe("the slide zip follows the parts it is served with", () => {
  it("keeps the server's slide mapping when there is no edit yet", async () => {
    const core = await readCore(NO_EDIT);
    expect(slides(core.pieces)).toEqual([[A, 0], [B, 1]]);
    expect(core.parts?.map((p) => p.id)).toEqual([A, B]);
  });

  it("re-keys each slide's paragraph to the edit's part id", async () => {
    const core = await readCore(edit([[EA, "We begin here."], [EB, "Then we go."]]));
    expect(slides(core.pieces)).toEqual([[EA, 0], [EB, 1]]);
    expect(core.parts?.map((p) => p.id)).toEqual([EA, EB]);
    expect(core.ideal.text).toBe("We begin here.\n\nThen we go.");
  });

  it("refuses to guess when a paragraph was added or removed", async () => {
    const core = await readCore(edit([[EA, "All of it in one paragraph."]]));
    expect(core.pieces).toBeNull();
    expect(core.parts?.map((p) => p.id)).toEqual([EA]);
  });
});
