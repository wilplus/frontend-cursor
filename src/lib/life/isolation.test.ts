import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { pickerQuery } from "./hashtags";
import { mapChatCard } from "./mappers";

/* -------------------------------------------------------------------------- */
/*  ISOLATION TEST — the price of admission for the whole Life Panel           */
/*                                                                            */
/*  The panel is founder-directed scaffolding. It passes the decision filter   */
/*  ONLY because it is fenced off the live loop, and this file is the fence.   */
/*  Same discipline as the Journal isolation test that PR #254 shipped under.  */
/*                                                                            */
/*  What it asserts:                                                          */
/*    1. Exactly TWO product modules may touch the panel: the app header (for  */
/*       the menu entries) and the Lounge (for the # layer). Any third import  */
/*       fails the build. That list is the spec's "single permitted contact    */
/*       point" plus the hamburger FE-1 explicitly asks for.                   */
/*    2. The Lounge's # layer is gated on `lifeTags.enabled`, which is false   */
/*       for every user who has not consented and finished setup.              */
/*    3. The chat send path is unchanged: no life field is added to the        */
/*       /v2/chat/query request. Routing is the backend's job.                 */
/*    4. The panel's BFF proxy can only ever reach `/v2/life/*`.                */
/*                                                                            */
/*  If this test is not green, the branch does not merge.                      */
/* -------------------------------------------------------------------------- */

const SRC = join(fileURLToPath(new URL("../../", import.meta.url)));

/** Everything the panel owns. Files under these paths may import each other
 *  freely; the rule is about what the REST of the product may reach for. */
const LIFE_OWNED = [
  join("lib", "life"),
  join("components", "life"),
  join("app", "panel"),
  join("app", "api", "v2", "life"),
  join("services", "api", "life.ts"),
];

/** The only product modules allowed to import the panel.
 *
 *  FE-3 (2026-07-27) moved the hamburger out of DashboardHeader into AppMenu +
 *  useAppMenuData, so the panel's menu entries are read there now. Recorded
 *  deliberately, because it is a real widening and not just a rename: the same
 *  menu is mounted on the BLOG as well, so a signed-in visitor to a marketing
 *  page can now see their panel entries.
 *
 *  That is intended — the story asks for the lab's menu on the blog, one
 *  component with two mounts, and the lab's menu contains Principles. The
 *  isolation that actually matters is unchanged: entries still come only from
 *  `GET /v2/life/state`, which 404s unless the feature is on AND this user
 *  passes the gate, so a visitor the payload does not list sees nothing. And
 *  the panel reads stay signed-in only, which is why a signed-out blog reader
 *  makes no panel request at all.
 *
 *  SiteHeader is deliberately NOT on this list: it mounts AppMenu and never
 *  touches the panel itself, so the dependency stays contained to these two. */
const PERMITTED_IMPORTERS = [
  join("components", "AppMenu.tsx"),
  join("hooks", "useAppMenuData.ts"),
  join("components", "willab", "Lounge.tsx"),
];

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      walk(full, out);
    } else if (/\.(ts|tsx)$/.test(entry)) {
      out.push(full);
    }
  }
  return out;
}

function isLifeOwned(relPath: string): boolean {
  return LIFE_OWNED.some(
    (owned) => relPath === owned || relPath.startsWith(`${owned}${sep}`)
  );
}

const LIFE_IMPORT = /from\s+["']@\/(lib\/life|components\/life|services\/api\/life)/;

describe("life panel isolation", () => {
  it("is imported by exactly the two permitted product modules", () => {
    const importers: string[] = [];
    for (const file of walk(SRC)) {
      const rel = relative(SRC, file);
      if (isLifeOwned(rel)) continue;
      if (LIFE_IMPORT.test(readFileSync(file, "utf8"))) importers.push(rel);
    }
    // A new name in this list means something outside the panel started
    // depending on it. That is the drift this test exists to stop: decide
    // deliberately, do not just add the file here.
    expect(importers.sort()).toEqual(PERMITTED_IMPORTERS.sort());
  });

  it("gates the composer's tag picker on the participation flag", () => {
    const lounge = readFileSync(
      join(SRC, "components", "willab", "Lounge.tsx"),
      "utf8"
    );
    // The picker must be rendered under the gate, never unconditionally.
    expect(lounge).toMatch(/lifeTags\.enabled\s*&&\s*\(\s*<LifeTagPicker/);
    const unguarded = lounge.match(/<LifeTagPicker/g) ?? [];
    expect(unguarded).toHaveLength(1);
  });

  it("does not change what the chat sends to /v2/chat/query", () => {
    const lounge = readFileSync(
      join(SRC, "components", "willab", "Lounge.tsx"),
      "utf8"
    );
    const call = /postChatQuery\(\{([\s\S]*?)\n\s*\}\)/.exec(lounge);
    expect(call).not.toBeNull();
    // Routing is by hashtag ON THE BACKEND. The FE declares nothing extra, so
    // a non-participating user's request body is byte-identical to today's.
    expect(call![1]).not.toMatch(/life|hashtag|tag:/i);
  });

  it("keeps the chat client free of any life field", () => {
    const client = readFileSync(
      join(SRC, "services", "api", "chatQuery.ts"),
      "utf8"
    );
    expect(client).not.toMatch(/life/i);
  });

  it("confines the panel's BFF proxy to the /v2/life prefix", () => {
    const route = readFileSync(
      join(SRC, "app", "api", "v2", "life", "[...path]", "route.ts"),
      "utf8"
    );
    const targets = route.match(/\$\{backend\}[^`]*/g) ?? [];
    expect(targets).toHaveLength(1);
    expect(targets[0]).toContain("/v2/life/");
    // Path traversal out of the prefix is refused, not sanitised away quietly.
    expect(route).toContain('seg === ".."');
    // The corpus is confession-shaped. Nothing on this path may log a body.
    expect(route).not.toMatch(/console\.(log|error|warn)\([^)]*\b(body|text|data|json)\b/);
  });
});

describe("the # layer is inert for a user who is not on the panel", () => {
  it("renders no card when a turn carried no life metadata", () => {
    // Every bot turn for every other user takes this branch, so the bubble is
    // exactly the bubble that shipped before the panel existed.
    expect(mapChatCard(undefined)).toBeNull();
  });

  it("opens no picker for ordinary chat text", () => {
    expect(pickerQuery("how do I stop my voice shaking?")).toBeNull();
  });
});
