import { afterEach, describe, expect, it, vi } from "vitest";
import {
  fetchIdealTextCore,
  fetchIdealTextEnrichment,
  mergeIdealTextEnrichment,
} from "./idealText";

vi.mock("@/lib/api/auth-client", () => ({ getAuthToken: async () => "tok" }));

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

const response = (body: Record<string, unknown>, status = 200) => ({
  ok: status >= 200 && status < 300,
  status,
  json: async () => body,
});

describe("Ideal Text core-first transport", () => {
  it("maps the immutable core without waiting for optional feedback", async () => {
    const fetchMock = vi.fn(async (..._args: unknown[]) =>
      response({
        status: "unverified",
        text: "Core document.",
        version: 2,
        document_snapshot_id: "snapshot-2",
        document_snapshot_sha256: "a".repeat(64),
        presentation_ref: "deck.pdf",
        slide_titles: ["Opening"],
        pieces: [{ piece_key: 0, text: "Core document.", slide_index: 0 }],
        parts: null,
        can_record_take: true,
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const result = await fetchIdealTextCore("arc-1");
    expect(fetchMock.mock.calls[0]?.[0]).toContain("/ideal-text/core");
    expect(result.kind).toBe("single");
    if (result.kind !== "single") throw new Error("expected core");
    expect(result.ideal.text).toBe("Core document.");
    expect(result.documentSnapshotId).toBe("snapshot-2");
    expect(result.presentationRef).toBe("deck.pdf");
    expect(result.pieces?.[0]?.slideIndex).toBe(0);
    expect(result.suggestions).toBeNull();
    expect(result.learningExposures).toEqual([]);
  });

  it("merges only ready enrichment bound to the exact snapshot", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValueOnce(
          response({
            status: "verified",
            text: "Core document.",
            document_snapshot_id: "snapshot-1",
            slide_titles: [],
            pieces: [],
            parts: null,
          }),
        )
        .mockResolvedValueOnce(
          response({
            document_snapshot_id: "snapshot-1",
            sections: {
              feedback: {
                status: "ready",
                data: {
                  key_moments: [
                    {
                      anchor: "Core",
                      snippet_id: "snippet-1",
                      take_session_id: "take-1",
                    },
                  ],
                  explanations_available: true,
                },
              },
              document_layers: { status: "pending", retryable: true },
              entitlement: {
                status: "ready",
                data: { moments_unlocked: true },
              },
            },
          }),
        ),
    );

    const core = await fetchIdealTextCore("arc-1");
    if (core.kind !== "single") throw new Error("expected core");
    const enrichment = await fetchIdealTextEnrichment(
      "arc-1",
      "snapshot-1",
    );
    if (enrichment.kind !== "ready") throw new Error("expected enrichment");
    const merged = mergeIdealTextEnrichment(core, enrichment);
    expect(merged.ideal.text).toBe("Core document.");
    expect(merged.ideal.keyMoments).toHaveLength(1);
    expect(merged.explanationsAvailable).toBe(true);
    expect(merged.momentsUnlocked).toBe(true);
    expect(merged.suggestions).toBeNull();
    expect(merged.enrichmentSections?.document_layers).toBe("pending");
  });

  it("reports stale enrichment without returning mixed data", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        response(
          {
            code: "SNAPSHOT_STALE",
            current_document_snapshot_id: "snapshot-new",
          },
          409,
        ),
      ),
    );
    expect(
      await fetchIdealTextEnrichment("arc-1", "snapshot-old"),
    ).toEqual({
      kind: "stale",
      currentDocumentSnapshotId: "snapshot-new",
    });
  });

  it("requests only named unfinished sections on retry", async () => {
    const fetchMock = vi.fn(async (..._args: unknown[]) =>
      response({ document_snapshot_id: "snapshot-1", sections: {} }),
    );
    vi.stubGlobal("fetch", fetchMock);
    await fetchIdealTextEnrichment("arc-1", "snapshot-1", [
      "feedback",
      "learning",
    ]);
    const url = String(fetchMock.mock.calls[0]?.[0]);
    expect(url).toContain("sections=feedback%2Clearning");
  });
});

