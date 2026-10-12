import { afterEach, describe, expect, it, vi } from "vitest";
import {
  fetchIdealTextCore,
  fetchIdealTextEnrichment,
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
});
