import { afterEach, describe, expect, it, vi } from "vitest";
import {
  SETTLE_MAX_ATTEMPTS,
  feedbackStillComing,
} from "@/lib/willab/enrichmentSettle";
import {
  fetchIdealTextCore,
  fetchIdealTextEnrichment,
  mergeIdealTextEnrichment,
  settleIdealTextEnrichment,
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
        pieces: [
          {
            piece_key: 0,
            part_id: "part-1",
            text: "Core document.",
            slide_index: 0,
          },
        ],
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
    expect(result.pieces?.[0]?.partId).toBe("part-1");
    expect(result.suggestions).toBeNull();
    expect(result.learningExposures).toEqual([]);
  });

  it("a missing snapshot is not a coach gate: 404 falls back to the composing read", async () => {
    // Founder 2026-09-26: "why is my ideal text gated behind this?" A 404
    // here means no prepared snapshot yet, not an unapproved document.
    const fetchMock = vi.fn(async (url: string) =>
      url.includes("/ideal-text/core")
        ? new Response(JSON.stringify({ code: "IDEAL_TEXT_DOCUMENT_PENDING" }), { status: 404 })
        : response({ status: "unverified", text: "Machine document.", pieces: [], parts: null }),
    );
    vi.stubGlobal("fetch", fetchMock);
    const result = await fetchIdealTextCore("arc-no-snapshot");
    expect(fetchMock.mock.calls.map((c) => String(c[0]))).toEqual([
      "/api/v2/explore/arc/arc-no-snapshot/ideal-text/core",
      "/api/v2/explore/arc/arc-no-snapshot/ideal-text",
    ]);
    expect(result.kind).toBe("single");
    if (result.kind !== "single") return;
    expect(result.ideal.text).toBe("Machine document.");
  });

  it("preserves the canonical valid-empty owner edit state", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => response({
      status: "unverified",
      text: "Machine document.",
      pieces: [],
      parts: null,
      owner_edit: {
        text: null,
        source_document_version: null,
        user_text_revision: null,
        user_text_sha256: null,
        parts: [],
        current_bundle_text_update_binding: null,
      },
    })));
    const result = await fetchIdealTextCore("arc-empty-owner");
    expect(result.kind).toBe("single");
    if (result.kind !== "single") return;
    expect(result.ideal.text).toBe("Machine document.");
    expect(result.confidentMomentOwnerEdit).toEqual({
      text: null,
      sourceDocumentVersion: null,
      userTextRevision: null,
      userTextSha256: null,
      parts: [],
      currentBundleTextUpdateBinding: null,
    });
  });

  it("retains only an exact current Bundle text-update binding", async () => {
    const partId = "00000000-0000-4000-8000-000000000031";
    const binding = {
      binding_id: "00000000-0000-4000-8000-000000000032",
      bundle_id: "00000000-0000-4000-8000-000000000033",
      attachment_id: "00000000-0000-4000-8000-000000000034",
      source_document_version: 4,
      result_user_text_revision: "8",
      result_user_text_sha256: "b".repeat(64),
      result_part_revision_id: "9",
    };
    vi.stubGlobal("fetch", vi.fn(async () => response({
      status: "verified", text: "Owner text.", pieces: [], parts: null,
      owner_edit: {
        text: "Owner text.", source_document_version: 4,
        user_text_revision: "8", user_text_sha256: "b".repeat(64),
        parts: [{ id: partId, ord: 0, text: "Owner text.", locked: false, current_part_revision_id: "9" }],
        current_bundle_text_update_binding: binding,
      },
    })));
    const result = await fetchIdealTextCore("arc-owner-binding");
    expect(result.kind).toBe("single");
    if (result.kind !== "single") return;
    expect(result.confidentMomentOwnerEdit?.currentBundleTextUpdateBinding).toMatchObject({
      bindingId: binding.binding_id,
      bundleId: binding.bundle_id,
      attachmentId: binding.attachment_id,
      resultPartRevisionId: "9",
    });
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

  it("keeps retrying the exact snapshot until Manager feedback is ready", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        response({
          document_snapshot_id: "snapshot-1",
          sections: {
            document_layers: { status: "pending", retryable: true },
          },
        }),
      )
      .mockResolvedValueOnce(
        response({
          document_snapshot_id: "snapshot-1",
          sections: {
            document_layers: { status: "failed", retryable: true },
          },
        }),
      )
      .mockResolvedValueOnce(
        response({
          document_snapshot_id: "snapshot-1",
          sections: {
            document_layers: {
              status: "ready",
              data: { changes: [{ id: "feedback-1" }] },
            },
          },
        }),
      );
    vi.stubGlobal("fetch", fetchMock);
    const initial = await fetchIdealTextEnrichment("arc-1", "snapshot-1");
    if (initial.kind !== "ready") throw new Error("expected enrichment");
    const settled = await settleIdealTextEnrichment(
      "arc-1",
      "snapshot-1",
      initial,
      { wait: async () => undefined },
    );
    expect(settled.kind).toBe("ready");
    if (settled.kind !== "ready") return;
    expect(settled.sections.document_layers.status).toBe("ready");
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(String(fetchMock.mock.calls[1]?.[0])).toContain(
      "document_snapshot_id=snapshot-1",
    );
    expect(String(fetchMock.mock.calls[2]?.[0])).toContain(
      "sections=document_layers",
    );
  });

  /* THE LOADING BUG (founder 2026-09-20). Three attempts, 1.7 seconds apart,
     against Manager work that can take tens of seconds. The fourth answer was
     the one carrying the marks and nothing ever asked for it — nothing
     re-reads the document after the first paint, so those bookmarks were gone
     until an unrelated refetch ran the whole dance again. */
  it("keeps asking past the fourth try when the Manager is still working", async () => {
    const pending = () =>
      response({
        document_snapshot_id: "snapshot-1",
        sections: { document_layers: { status: "pending", retryable: true } },
      });
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(pending()) // the first read
      .mockResolvedValueOnce(pending()) // retry 1
      .mockResolvedValueOnce(pending()) // retry 2
      .mockResolvedValueOnce(pending()) // retry 3 — the old budget ended here
      .mockResolvedValueOnce(
        response({
          document_snapshot_id: "snapshot-1",
          sections: {
            document_layers: {
              status: "ready",
              data: { changes: [{ id: "feedback-1" }] },
            },
          },
        }),
      );
    vi.stubGlobal("fetch", fetchMock);
    const initial = await fetchIdealTextEnrichment("arc-1", "snapshot-1");
    if (initial.kind !== "ready") throw new Error("expected enrichment");
    const settled = await settleIdealTextEnrichment(
      "arc-1",
      "snapshot-1",
      initial,
      { wait: async () => undefined },
    );
    if (settled.kind !== "ready") throw new Error("expected enrichment");
    expect(settled.sections.document_layers.status).toBe("ready");
    expect(settled.sections.document_layers.retryable).toBeFalsy();
    expect(fetchMock).toHaveBeenCalledTimes(5);
  });

  it("hands back the retryable sections when the budget runs out", async () => {
    /* "READY" IS THE ENVELOPE, NOT THE ANSWER. A settle that spent its budget
       returns the same `kind` as one that finished, so the caller must be able
       to read which happened — that is the difference between reserving the
       marks' places and painting a finished-looking talk without them. */
    const fetchMock = vi.fn(async (..._args: unknown[]) =>
      response({
        document_snapshot_id: "snapshot-1",
        sections: { document_layers: { status: "pending", retryable: true } },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);
    const initial = await fetchIdealTextEnrichment("arc-1", "snapshot-1");
    if (initial.kind !== "ready") throw new Error("expected enrichment");
    let clock = 0;
    const settled = await settleIdealTextEnrichment(
      "arc-1",
      "snapshot-1",
      initial,
      {
        ceilingMs: 5_000,
        now: () => clock,
        // Charge the clock the server's focused-retry budget too, the way a
        // real attempt spends it.
        wait: async (delayMs: number) => {
          clock += delayMs + 8_000;
        },
      },
    );
    if (settled.kind !== "ready") throw new Error("expected enrichment");
    expect(settled.sections.document_layers.retryable).toBe(true);
    expect(feedbackStillComing(settled.sections)).toBe(true);
    // It stopped: bounded, not a poll that runs until the tab closes.
    expect(fetchMock.mock.calls.length).toBeLessThanOrEqual(3);
  });

  it("never asks more times than the request budget allows", async () => {
    // An instant server that keeps saying retryable must not spin: the wall
    // clock never advances, so only the attempt cap can end this.
    const fetchMock = vi.fn(async (..._args: unknown[]) =>
      response({
        document_snapshot_id: "snapshot-1",
        sections: { document_layers: { status: "pending", retryable: true } },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);
    const initial = await fetchIdealTextEnrichment("arc-1", "snapshot-1");
    if (initial.kind !== "ready") throw new Error("expected enrichment");
    await settleIdealTextEnrichment("arc-1", "snapshot-1", initial, {
      wait: async () => undefined,
      now: () => 0,
    });
    // one first read + at most SETTLE_MAX_ATTEMPTS retries
    expect(fetchMock.mock.calls.length).toBe(SETTLE_MAX_ATTEMPTS + 1);
  });

  it("stops retries when the immutable snapshot becomes stale", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValueOnce(
          response({
            document_snapshot_id: "snapshot-1",
            sections: {
              document_layers: { status: "pending", retryable: true },
            },
          }),
        )
        .mockResolvedValueOnce(
          response(
            {
              code: "SNAPSHOT_STALE",
              current_document_snapshot_id: "snapshot-2",
            },
            409,
          ),
        ),
    );
    const initial = await fetchIdealTextEnrichment("arc-1", "snapshot-1");
    if (initial.kind !== "ready") throw new Error("expected enrichment");
    expect(
      await settleIdealTextEnrichment("arc-1", "snapshot-1", initial, {
        wait: async () => undefined,
      }),
    ).toEqual({
      kind: "stale",
      currentDocumentSnapshotId: "snapshot-2",
    });
  });
});
