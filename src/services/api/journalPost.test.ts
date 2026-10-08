import { afterEach, describe, expect, it, vi } from "vitest";
import { SELF_MODELING_POST_SLUG, fetchPublishedJournalPost } from "./journalPost";

/* The post "More about self-modeling theory" opens (D-FW-18; JP1 A, published
   by the founder under this exact slug, Navigation Panel HO-10c). */
describe("fetchPublishedJournalPost", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("reads the signed post at its stable slug", () => {
    expect(SELF_MODELING_POST_SLUG).toBe("why-we-ask-you-to-judge-honestly");
  });

  it("returns the published post through the same-origin route", async () => {
    const fetchMock = vi.fn(async () =>
      new Response(JSON.stringify({ slug: SELF_MODELING_POST_SLUG, title: "Why we ask you to judge honestly", body: "Words." })),
    );
    vi.stubGlobal("fetch", fetchMock);
    const post = await fetchPublishedJournalPost(SELF_MODELING_POST_SLUG);
    expect(post).toMatchObject({ title: "Why we ask you to judge honestly", body: "Words." });
    expect(String((fetchMock.mock.calls[0] as unknown as [string])[0])).toBe(
      "/api/v2/journal/posts/why-we-ask-you-to-judge-honestly",
    );
  });

  it("is null for anything but a post with a title and words: no broken screen", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("{}", { status: 404 })));
    expect(await fetchPublishedJournalPost("x")).toBeNull();
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ slug: "x", title: "", body: "Words." }))));
    expect(await fetchPublishedJournalPost("x")).toBeNull();
    vi.stubGlobal("fetch", vi.fn(async () => Promise.reject(new Error("offline"))));
    expect(await fetchPublishedJournalPost("x")).toBeNull();
  });
});
