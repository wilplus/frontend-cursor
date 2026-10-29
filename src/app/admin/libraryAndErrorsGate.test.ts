/*
 * STORY    As the founder, I want the exercise library, speaking-errors and
 *          corpus admin pages to answer only me, and coaches' old addresses
 *          to land there, so that coaches keep only what they need.
 * OUTCOME
 *   O1  A coach (any non-founder) gets Not Found on all three pages.
 *   O2  The founder gets the page itself.
 *   O3  Signed out, each page sends you to sign in and back to itself.
 *   O4  /coach/exercises and /coach/errors redirect to the admin pages.
 * PROVES   O1 -> "is Not Found for anyone but the founder, a coach included"
 *          O2 -> "renders the page for the founder"
 *          O3 -> "sends a signed-out visitor to sign in"
 *          O4 -> "the coach's old addresses redirect to the admin pages"
 * WHY      CP3 A (founder 2026-10-06, decisions log N56.3).
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import { FOUNDER_EMAIL } from "@/lib/founder";
import type { NextConfig } from "next";
// @ts-expect-error -- next.config.mjs is plain JS with no type declarations.
import rawNextConfig from "../../../next.config.mjs";

const nextConfig = rawNextConfig as NextConfig;

const auth = vi.hoisted(() => ({ user: null as { email: string } | null }));

vi.mock("next/navigation", () => ({
  redirect: (to: string) => {
    throw new Error(`REDIRECT ${to}`);
  },
  notFound: () => {
    throw new Error("NOT_FOUND");
  },
}));
vi.mock("@/lib/supabase/server", () => ({
  createServerSupabaseClient: () => ({
    auth: { getUser: async () => ({ data: { user: auth.user } }) },
  }),
}));
vi.mock("./corpus/page.client", () => ({ default: function CorpusPanel() { return null; } }));
vi.mock("./library/LibraryPanel", () => ({ default: function LibraryPanel() { return null; } }));
vi.mock("./errors/SpeakingErrorsPanel", () => ({ default: function SpeakingErrorsPanel() { return null; } }));

import AdminLibraryPage from "./library/page";
import AdminErrorsPage from "./errors/page";
import AdminCorpusPage from "./corpus/page";
import CorpusPanel from "./corpus/page.client";
import LibraryPanel from "./library/LibraryPanel";
import SpeakingErrorsPanel from "./errors/SpeakingErrorsPanel";

const PAGES = [
  ["/admin/library", AdminLibraryPage, LibraryPanel],
  ["/admin/errors", AdminErrorsPage, SpeakingErrorsPanel],
  // Q-B15 A (2026-10-07): corpus hide/delete/restore moved to admin too.
  ["/admin/corpus", AdminCorpusPage, CorpusPanel],
] as const;

beforeEach(() => {
  auth.user = null;
});

describe("the library, speaking errors and corpus pages, founder only", () => {
  it.each(PAGES)("%s is Not Found for anyone but the founder, a coach included", async (_path, Page) => {
    auth.user = { email: "coach@willonski.com" };
    await expect(Page()).rejects.toThrow("NOT_FOUND");
  });

  it.each(PAGES)("%s renders the page for the founder", async (_path, Page, Panel) => {
    auth.user = { email: FOUNDER_EMAIL };
    const el = (await Page()) as { type: unknown };
    expect(el.type).toBe(Panel);
  });

  it.each(PAGES)("%s sends a signed-out visitor to sign in", async (path, Page) => {
    await expect(Page()).rejects.toThrow(`REDIRECT /login?redirectTo=${path}`);
  });

  it("the coach's old addresses redirect to the admin pages", async () => {
    const rules = await nextConfig.redirects!();
    const to = (source: string) => rules.find((r) => r.source === source)?.destination;
    expect(to("/coach/exercises")).toBe("/admin/library");
    expect(to("/coach/errors")).toBe("/admin/errors");
  });
});
