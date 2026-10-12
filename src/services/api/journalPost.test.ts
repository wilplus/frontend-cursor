import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchPublishedJournalPost } from "./journalPost";

/* The post "More about self-modeling theory" opens (D-FW-18; JP1 A, published
   by the founder under this exact slug, Navigation Panel HO-10c). */
describe("fetchPublishedJournalPost", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("is null for anything but a post with a title and words: no broken screen", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("{}", { status: 404 })));
    expect(await fetchPublishedJournalPost("x")).toBeNull();
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ slug: "x", title: "", body: "Words." }))));
    expect(await fetchPublishedJournalPost("x")).toBeNull();
    vi.stubGlobal("fetch", vi.fn(async () => Promise.reject(new Error("offline"))));
    expect(await fetchPublishedJournalPost("x")).toBeNull();
  });
});
