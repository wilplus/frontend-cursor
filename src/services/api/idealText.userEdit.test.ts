/*
STORY    As a speaker, I want my edit saved as the whole document against the
         version I edited, and never re-sent over a newer Take, so that a Take
         that just landed is never overwritten by my old words.
OUTCOME
  O1  Saving sends the whole text once, with the version it was edited from.
  O2  When a newer version exists, the save is reported as out of date and
      not sent again.
  O3  A moved document also counts as out of date; any other refusal is an
      error.
  O4  The server receives the current revision and paragraph lineage, and
      returns the head needed for the next edit.
  O5  Refused processing authority leaves the draft available to retry.
PROVES   O1 -> "keeps the legacy caller shape for callers without enrollment state"
         O2 -> "reports a supersede instead of RETRYING it over the new version"
         O3 -> "supersedes on a document-moved refusal and fails the save on any other"
         O4 -> "sends the current CAS enrollment state and carries the returned head forward"
         O5 -> "surfaces an authority refusal without retrying the draft"
WHY      The old retry re-sent pre-Take words over the text a just-landed Take
         built (Never-rule 5).
*/
import { afterEach, describe, expect, it, vi } from "vitest";
import type { Part } from "@/lib/willab/documentParts";
import { saveIdealUserEdit } from "./idealText";

vi.mock("@/lib/api/auth-client", () => ({ getAuthToken: async () => "tok" }));

let calls: Array<{ url: string; body: unknown }> = [];

function mockFetch(...responses: Array<{ status: number; body?: unknown }>) {
  calls = [];
  let i = 0;
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init: RequestInit) => {
      calls.push({ url, body: init?.body ? JSON.parse(init.body as string) : null });
      const r = responses[Math.min(i++, responses.length - 1)];
      return {
        ok: r.status >= 200 && r.status < 300,
        status: r.status,
        json: async () => r.body ?? null,
      };
    })
  );
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("saveIdealUserEdit", () => {
  it("keeps the legacy caller shape for callers without enrollment state", async () => {
    mockFetch({ status: 200, body: { saved: true, version: 4 } });
    const r = await saveIdealUserEdit("arc1", "the whole doc", 3);
    expect(r).toEqual({ ok: true, version: 4 });
    expect(calls).toHaveLength(1);
    expect(calls[0].url).toContain("/ideal-text/user-edit");
    expect(calls[0].body).toEqual({ text: "the whole doc", version: 3 });
  });

  it("reports a supersede instead of RETRYING it over the new version", async () => {
    mockFetch({
      status: 409,
      body: { code: "VERSION_SUPERSEDED", current_version: 7 },
    });
    const r = await saveIdealUserEdit("arc1", "pre-take words", 6);
    expect(r).toEqual({ ok: false, reason: "superseded", currentVersion: 7 });
    // The whole point: exactly ONE request. A second PUT here would be the
    // stale edit landing on top of the take that just assembled.
    expect(calls).toHaveLength(1);
  });

  it("supersedes on a document-moved refusal and fails the save on any other", async () => {
    mockFetch({ status: 409, body: { code: "IDEAL_TEXT_PARTS_REFRESH_REQUIRED" } });
    expect(await saveIdealUserEdit("arc1", "words", 6)).toEqual({
      ok: false, reason: "superseded", currentVersion: null,
    });
    mockFetch({ status: 409, body: { code: "IDEAL_TEXT_PART_REQUIRES_UNLOCK" } });
    expect(await saveIdealUserEdit("arc1", "words", 6)).toEqual({
      ok: false, reason: "error",
    });
  });

  it("sends the current CAS enrollment state and carries the returned head forward", async () => {
    mockFetch({
      status: 200,
      body: {
        ideal_text_user_edit_contract_version: "ideal-text-user-edit-cas-v2",
        saved: true,
        arc_id: "arc1",
        source_document_version: 3,
        previous_user_text_revision: null,
        result_user_text_revision: "1",
        result_user_text_sha256: "b".repeat(64),
        desired_parts_lineage_sha256: "c".repeat(64),
        part_revisions: [
          { part_id: "part-1", revision_id: "1", action: "owner_part_created" },
        ],
        dataset_eligible: false,
      },
    });
    const r = await saveIdealUserEdit("arc1", "new words", 3, {
      current: {
        ownerEdit: null,
        desiredParts: [
          { id: "part-1", text: "new words", locked: false },
        ] satisfies Part[],
      },
    });
    expect(r).toMatchObject({
      ok: true,
      version: null,
      ownerEdit: {
        userTextRevision: "1",
        userTextSha256: "b".repeat(64),
        parts: [
          { id: "part-1", position: 0, text: "new words", currentPartRevisionId: "1" },
        ],
      },
    });
    const body = calls[0].body as Record<string, unknown>;
    expect(body).toMatchObject({
      text: "new words",
      version: 3,
      expected_user_text_revision: null,
      expected_user_text_sha256: null,
      parts: {
        expected_parts: [],
        desired_parts: [{ position: 0, part_id: "part-1", text: "new words" }],
      },
    });
    expect(body.idempotency_key).toEqual(expect.any(String));
  });

  it("surfaces an authority refusal without retrying the draft", async () => {
    mockFetch({ status: 403, body: { code: "PROCESSING_AUTHORIZATION_REQUIRED" } });
    expect(await saveIdealUserEdit("arc1", "words", 3)).toEqual({
      ok: false,
      reason: "authority",
    });
    expect(calls).toHaveLength(1);
  });
});
