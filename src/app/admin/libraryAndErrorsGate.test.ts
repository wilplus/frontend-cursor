/* -------------------------------------------------------------------------- */
/*  CP3 A (founder 2026-10-06, decisions log N56.3): "The exercise library and */
/*  the speaking errors page leave the coach's app and sit next to the pace    */
/*  panel in your admin area. Coaches keep everything they need inside the     */
/*  moment."                                                                   */
/*                                                                            */
/*  The two pages answer the founder only, by the check /admin/pace uses, and  */
/*  the coach's old addresses land on them.                                    */
/* -------------------------------------------------------------------------- */


import { beforeEach, describe, expect, it, vi } from "vitest";

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
vi.mock("./corpus/page.client", () => ({ default: () => null }));
vi.mock("./library/LibraryPanel", () => ({ default: () => null }));
vi.mock("./errors/SpeakingErrorsPanel", () => ({ default: () => null }));

import AdminLibraryPage from "./library/page";
import AdminErrorsPage from "./errors/page";
import AdminCorpusPage from "./corpus/page";

const PAGES = [
  ["/admin/library", AdminLibraryPage],
  ["/admin/errors", AdminErrorsPage],
  // Q-B15 A (2026-10-07): corpus hide/delete/restore moved to admin too.
  ["/admin/corpus", AdminCorpusPage],
] as const;

beforeEach(() => {
  auth.user = null;
});

describe("the library and the speaking errors pages, founder only", () => {

  it.each(PAGES)("%s is Not Found for anyone but the founder, a coach included", async (_path, Page) => {
    auth.user = { email: "coach@willonski.com" };
    await expect(Page()).rejects.toThrow("NOT_FOUND");
  });
});
