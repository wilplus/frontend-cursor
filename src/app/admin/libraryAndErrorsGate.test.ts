/* -------------------------------------------------------------------------- */
/*  CP3 A (founder 2026-10-06, decisions log N56.3): "The exercise library and */
/*  the speaking errors page leave the coach's app and sit next to the pace    */
/*  panel in your admin area. Coaches keep everything they need inside the     */
/*  moment."                                                                   */
/*                                                                            */
/*  The two pages answer the founder only, by the check /admin/pace uses, and  */
/*  the coach's old addresses land on them.                                    */
/* -------------------------------------------------------------------------- */
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import type { NextConfig } from "next";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { FOUNDER_EMAIL } from "@/lib/founder";

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
vi.mock("./library/page.client", () => ({ default: () => null }));
vi.mock("./errors/page.client", () => ({ default: () => null }));
vi.mock("./corpus/page.client", () => ({ default: () => null }));
vi.mock("./library/LibraryPanel", () => ({ default: () => null }));
vi.mock("./errors/SpeakingErrorsPanel", () => ({ default: () => null }));

import AdminLibraryPage from "./library/page";
import AdminErrorsPage from "./errors/page";
import AdminCorpusPage from "./corpus/page";
import LibraryToday from "./library/page.client";
import ErrorsToday from "./errors/page.client";
import LibraryPanel from "./library/LibraryPanel";
import SpeakingErrorsPanel from "./errors/SpeakingErrorsPanel";

/** The repo's own redirects, read from the config Next serves. */
async function configRedirects(): Promise<unknown[]> {
  const url = pathToFileURL(resolve("next.config.mjs")).href;
  const config = (await import(/* @vite-ignore */ url)) as { default: NextConfig };
  return (await config.default.redirects?.()) ?? [];
}

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
  it.each(PAGES)("%s sends no session to login and back", async (path, Page) => {
    await expect(Page({})).rejects.toThrow(`REDIRECT /login?redirectTo=${path}`);
  });

  it.each(PAGES)("%s is Not Found for anyone but the founder, a coach included", async (_path, Page) => {
    auth.user = { email: "coach@willonski.com" };
    await expect(Page({})).rejects.toThrow("NOT_FOUND");
  });

  it.each(PAGES)("%s renders for the founder", async (_path, Page) => {
    auth.user = { email: FOUNDER_EMAIL };
    vi.stubEnv("NEXT_PUBLIC_COACH_PANEL_V2", "on");
    try {
      await expect(Page({})).resolves.toBeTruthy();
    } finally {
      vi.unstubAllEnvs();
    }
  });

  it("/admin/corpus opens for the founder whatever the coach panel's switch says (N66.1)", async () => {
    auth.user = { email: FOUNDER_EMAIL };
    vi.stubEnv("NEXT_PUBLIC_COACH_PANEL_V2", "");
    vi.stubEnv("NODE_ENV", "production");
    try {
      await expect(AdminCorpusPage({})).resolves.toBeTruthy();
      vi.stubEnv("NEXT_PUBLIC_COACH_PANEL_V2", "on");
      await expect(AdminCorpusPage({})).resolves.toBeTruthy();
    } finally {
      vi.unstubAllEnvs();
    }
  });

  it("today's pages stand until the coach panel's switch is on (Q-CP645 A)", async () => {
    auth.user = { email: FOUNDER_EMAIL };
    vi.stubEnv("NEXT_PUBLIC_COACH_PANEL_V2", "");
    try {
      expect(((await AdminLibraryPage({})) as { type: unknown }).type).toBe(LibraryToday);
      expect(((await AdminErrorsPage({})) as { type: unknown }).type).toBe(ErrorsToday);
      vi.stubEnv("NODE_ENV", "production");
      // Production never reads the address.
      expect(((await AdminLibraryPage({ searchParams: { coach2: "1" } })) as { type: unknown }).type).toBe(LibraryToday);
      vi.stubEnv("NODE_ENV", "development");
      expect(((await AdminLibraryPage({ searchParams: { coach2: "1" } })) as { type: unknown }).type).toBe(LibraryPanel);
      expect(((await AdminErrorsPage({ searchParams: { coach2: "1" } })) as { type: unknown }).type).toBe(SpeakingErrorsPanel);
      vi.stubEnv("NODE_ENV", "production");
      vi.stubEnv("NEXT_PUBLIC_COACH_PANEL_V2", "on");
      expect(((await AdminLibraryPage({})) as { type: unknown }).type).toBe(LibraryPanel);
      expect(((await AdminErrorsPage({})) as { type: unknown }).type).toBe(SpeakingErrorsPanel);
    } finally {
      vi.unstubAllEnvs();
    }
  });

  it("the gate is the pace panel's, line for line", () => {
    const pace = readFileSync("src/app/admin/pace/page.tsx", "utf8");
    const gate = "if (!isFounderEmail(user.email)) notFound();";
    expect(pace).toContain(gate);
    for (const [path] of PAGES) {
      expect(readFileSync(`src/app${path}/page.tsx`, "utf8"), path).toContain(gate);
    }
  });
});

describe("the coach's old addresses", () => {
  it.each([
    ["/coach/exercises", "/admin/library"],
    ["/coach/errors", "/admin/errors"],
  ])("%s redirects to %s", async (source, destination) => {
    const redirects = await configRedirects();
    expect(redirects).toContainEqual({ source, destination, permanent: false });
  });

  it("no page is left at the old addresses to shadow the redirect", () => {
    for (const old of ["src/app/coach/exercises", "src/app/coach/errors"]) {
      expect(existsSync(old), old).toBe(false);
    }
  });
});
