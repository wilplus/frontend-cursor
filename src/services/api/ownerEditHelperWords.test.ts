/*
STORY    As a speaker, I want the helper words I chose to stay after I edit my
         Ideal Text, until I pick new ones, so that my chosen phrase isn't
         lost.
OUTCOME
  O1  After my edit, each paragraph still carries its chosen helper words
      and where they sit, and they are still highlighted.
  O2  A paragraph with no chosen helper words gets none.
PROVES   O1, O2 -> "merges the snapshot's root phrase, span and iteration by part id"
WHY      Never-rule 5: helper words stay until the speaker picks new ones (audit B3).
*/
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
});
