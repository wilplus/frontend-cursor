import { describe, expect, it } from "vitest";
import {
  chunkLoungeMessages,
  stampLoungeMessage,
  LOUNGE_BODY_MAX,
  type LoungeMessage,
} from "./loungeMessages";

describe("stampLoungeMessage", () => {
  it("stamps a non-empty client_id and a valid ISO client_created_at", () => {
    const m = stampLoungeMessage({ role: "user", kind: "text", body: "hi" });
    expect(m.client_id.length).toBeGreaterThan(0);
    expect(Number.isFinite(new Date(m.client_created_at).getTime())).toBe(true);
    expect(m.role).toBe("user");
    expect(m.kind).toBe("text");
    expect(m.body).toBe("hi");
    expect(m.metadata).toBeNull();
  });

  it("clamps body to the BE ceiling", () => {
    const long = "x".repeat(LOUNGE_BODY_MAX + 500);
    const m = stampLoungeMessage({ role: "bot", kind: "text", body: long });
    expect(m.body.length).toBe(LOUNGE_BODY_MAX);
  });

  it("generates unique client_ids", () => {
    const a = stampLoungeMessage({ role: "user", kind: "text", body: "a" });
    const b = stampLoungeMessage({ role: "user", kind: "text", body: "b" });
    expect(a.client_id).not.toBe(b.client_id);
  });

  it("preserves provided metadata", () => {
    const m = stampLoungeMessage({
      role: "system",
      kind: "status",
      body: "",
      metadata: { session_id: "s1" },
    });
    expect(m.metadata).toEqual({ session_id: "s1" });
  });
});

describe("chunkLoungeMessages", () => {
  const mk = (n: number): LoungeMessage[] =>
    Array.from({ length: n }, (_, i) => ({
      client_id: String(i),
      role: "user",
      kind: "text",
      body: "",
      client_created_at: new Date(0).toISOString(),
    }));

  it("returns [] for empty input", () => {
    expect(chunkLoungeMessages([])).toEqual([]);
  });

  it("keeps a sub-ceiling list as one chunk", () => {
    expect(chunkLoungeMessages(mk(50)).length).toBe(1);
  });

  it("splits at the 200/POST ceiling", () => {
    expect(chunkLoungeMessages(mk(450)).map((c) => c.length)).toEqual([
      200, 200, 50,
    ]);
  });

  it("respects a custom size", () => {
    expect(chunkLoungeMessages(mk(5), 2).map((c) => c.length)).toEqual([
      2, 2, 1,
    ]);
  });
});
