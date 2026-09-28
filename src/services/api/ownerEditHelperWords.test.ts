/* -------------------------------------------------------------------------- */
/*  HELPER WORDS SURVIVE AN OWNER EDIT (audit B3, 2026-09-28; L1)             */
/*                                                                            */
/*  Once the speaker has edited their Ideal Text, the core read serves the     */
/*  edit's live parts ({id, text, locked}) instead of the snapshot's. Those    */
/*  rows carry no helper words, so the deck lost the locked orange phrase the  */
/*  speaker had chosen: L1 says it persists until they pick new ones.          */
/*                                                                            */
/*  The snapshot's parts are the same `ideal_text_part` rows, republished      */
/*  whenever a root is chosen, so they are merged in by id. The edit still     */
/*  decides the text and the lock. A span that no longer slices to the phrase  */
/*  is carried as is and paints nothing (`partRootTint`).                      */
/* -------------------------------------------------------------------------- */
import { afterEach, describe, expect, it, vi } from "vitest";
import { partRootTint } from "@/lib/willab/documentParts";
import { fetchIdealTextCore } from "./idealText";

vi.mock("@/lib/api/auth-client", () => ({ getAuthToken: async () => "tok" }));

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

const A = "11111111-1111-4111-8111-111111111111";
const B = "22222222-2222-4222-8222-222222222222";

function coreBody(ownerParts: unknown[], snapshotParts: unknown[] | null) {
  return {
    status: "unverified",
    text: "We start here.\n\nThen we go.",
    version: 3,
    document_snapshot_id: "snapshot-3",
    document_snapshot_sha256: "a".repeat(64),
    pieces: [
      { piece_key: 0, part_id: A, text: "We start here.", slide_index: 0 },
      { piece_key: 1, part_id: B, text: "Then we go.", slide_index: 1 },
    ],
    parts: snapshotParts,
    owner_edit: {
      text: ownerParts.map((p) => (p as { text: string }).text).join("\n\n"),
      source_document_version: 3,
      user_text_revision: "7",
      user_text_sha256: "b".repeat(64),
      parts: ownerParts,
      current_bundle_text_update_binding: null,
    },
  };
}

const ownerPart = (id: string, ord: number, text: string, locked: boolean) => ({
  id, ord, text, locked, current_part_revision_id: null,
});

async function readParts(body: Record<string, unknown>) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => ({ ok: true, status: 200, json: async () => body })),
  );
  const result = await fetchIdealTextCore("arc-1");
  if (result.kind !== "single") throw new Error("expected the core document");
  return result.parts ?? [];
}

describe("an owner edit keeps the speaker's helper words", () => {
  it("merges the snapshot's root phrase, span and iteration by part id", async () => {
    const parts = await readParts(coreBody(
      [
        ownerPart(A, 0, "We start here.", true),
        ownerPart(B, 1, "Then we go.", false),
      ],
      [
        {
          id: A, text: "We start here.", locked: true, iteration: 2,
          edited: false, root_phrase: "start here", root_start: 3, root_end: 13,
        },
        { id: B, text: "Then we go.", locked: false },
      ],
    ));

    expect(parts[0]).toMatchObject({
      id: A, text: "We start here.", locked: true, iteration: 2,
      rootPhrase: "start here", rootStart: 3, rootEnd: 13, edited: false,
    });
    expect(partRootTint(parts[0]!)).toEqual([[3, 13]]);
    expect(parts[1]?.rootPhrase ?? null).toBeNull();
  });

  it("lets the edit decide the text and the lock", async () => {
    const parts = await readParts(coreBody(
      [ownerPart(A, 0, "We begin here.", false)],
      [{
        id: A, text: "We start here.", locked: true, iteration: 2,
        edited: false, root_phrase: "start here", root_start: 3, root_end: 13,
      }],
    ));

    expect(parts[0]).toMatchObject({
      id: A, text: "We begin here.", locked: false, rootPhrase: "start here",
    });
    // The server compared other words; it said nothing about these.
    expect(parts[0]?.edited).toBeUndefined();
    // A span that no longer proves the phrase paints nothing.
    expect(partRootTint({ ...parts[0]!, locked: true })).toBeUndefined();
  });

  it("adds nothing when the snapshot has no row for that part", async () => {
    const parts = await readParts(coreBody(
      [ownerPart(A, 0, "We start here.", true)],
      null,
    ));

    expect(parts).toEqual([{ id: A, text: "We start here.", locked: true }]);
  });
});
