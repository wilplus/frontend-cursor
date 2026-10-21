/*
STORY    As the founder, I want every part of the code to have one home doc
         and no new doc without my yes, so that the docs never pile up again
         (423 files by 21 October 2026; backend N107 and N111).
OUTCOME
  O1  Code no row of README.md's table covers is named; a flow page's files
      need no row; tests, docs and dot-folders are not code.
  O2  The most exact pattern wins; an equal claim by two homes, a pattern
      that matches nothing and a missing, History or Archive home are refused.
  O3  Every doc is listed in README.md.
  O4  A doc the base doesn't have needs Founder-Approved on its README.md line.
PROVES   O1 -> "names code no row covers, and nothing else"
         O2 -> "lets the most exact pattern win", "refuses an equal claim, a stale row and a bad home"
         O3 -> "names a doc README.md doesn't list"
         O4 -> "refuses a new doc without the founder's OK and passes it with one"
WHY      Backend N107: a new doc is not started; the area's page is edited.
*/
import { execFileSync } from "node:child_process";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { END, START, checkHomes, checkListed, homeOf, parseHomes, run } from "./check-docs.mjs";

const GIT_ENV = {
  ...process.env,
  GIT_AUTHOR_NAME: "t", GIT_AUTHOR_EMAIL: "t@t.co",
  GIT_COMMITTER_NAME: "t", GIT_COMMITTER_EMAIL: "t@t.co",
  GIT_CONFIG_GLOBAL: "/dev/null", GIT_CONFIG_SYSTEM: "/dev/null",
};

function table(...rows: string[]) {
  return `# Repo\n\n${START}\n| Part of the code | Files | Home doc |\n|---|---|---|\n${rows.join("\n")}\n${END}\n`;
}

let dir: string;
beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "docs-guard-"));
});
afterEach(() => rmSync(dir, { recursive: true, force: true }));

function write(path: string, text: string) {
  mkdirSync(dirname(join(dir, path)), { recursive: true });
  writeFileSync(join(dir, path), text);
}

describe("home docs", () => {
  it("names code no row covers, and nothing else", () => {
    write("docs/lounge.md", "# Lounge\n");
    const rows = parseHomes(table("| Lounge | `src/components/Lounge*`, `src/app/api/v2/lounge/` | [`docs/lounge.md`](docs/lounge.md) |"));
    const flows = [{ page: "docs/flows/walk.md", files: ["src/walk/"] }];
    const files = [
      "src/components/LoungeThread.tsx", "src/app/api/v2/lounge/route.ts", "src/walk/Stage.tsx",
      "src/components/Brand.tsx", "src/components/Brand.test.tsx", "docs/lounge.md", ".claude/x.json",
    ];
    expect(checkHomes(files, rows, flows, dir)).toEqual([
      "src/components/Brand.tsx has no home doc. Add it to a row of the table in README.md, or add a row.",
    ]);
  });

  it("lets the most exact pattern win", () => {
    const rows = parseHomes(table(
      "| Willab | `src/components/willab/Idea*` | No page |",
      "| Ideal Text | `src/components/willab/IdealText*` | [`docs/flows/ideal-text.md`](docs/flows/ideal-text.md) |",
    ));
    expect(homeOf("src/components/willab/IdealTextCard.tsx", rows).map((w) => w.row.part)).toEqual(["Ideal Text"]);
    expect(homeOf("src/components/willab/IdeaBox.tsx", rows).map((w) => w.row.home)).toEqual([null]);
  });

  it("refuses an equal claim, a stale row and a bad home", () => {
    write("docs/old.md", "# Old\n\n> **Label: History** · kept as written.\n");
    const rows = parseHomes(table(
      "| A | `src/x/` | No page |",
      "| B | `src/x/` | [`docs/old.md`](docs/old.md) |",
      "| Gone | `src/gone.ts` | [`docs/nope.md`](docs/nope.md) |",
    ));
    expect(checkHomes(["src/x/a.ts"], rows, [], dir)).toEqual([
      "src/x/a.ts is claimed equally by src/x/, src/x/, with different home docs.",
      "the home doc docs/old.md (B) is History or Archive, which is not edited. Pick a doc that is.",
      "the pattern src/gone.ts (Gone) matches no file. Remove it, or fix it after a rename.",
      "the home doc docs/nope.md (Gone) does not exist.",
    ]);
  });
});

describe("the docs themselves", () => {
  it("names a doc README.md doesn't list", () => {
    const readme = "- [Walk](docs/flows/walk.md)\n- [Old](docs/history/old.md#top)\n";
    const files = ["README.md", "docs/flows/walk.md", "docs/history/old.md", "docs/new.md", ".taskmaster/docs/README.md"];
    expect(checkListed(files, readme)).toEqual([
      "docs/new.md is not listed in README.md. Every doc has a line there (backend N106).",
    ]);
  });

  it("refuses a new doc without the founder's OK and passes it with one", () => {
    const git = (...args: string[]) => execFileSync("git", args, { cwd: dir, encoding: "utf8", env: GIT_ENV });
    const flows = join(dir, "flow-pages.txt");
    write("flow-pages.txt", "");
    write("src/a.ts", "export {};\n");
    write("README.md", table("| A | `src/a.ts`, `flow-pages.txt` | No page |"));
    git("init", "-q", "-b", "main");
    git("add", "-A");
    git("commit", "-q", "-m", "base");
    git("branch", "base");
    write("docs/new.md", "# New\n");
    write("README.md", `${table("| A | `src/a.ts`, `flow-pages.txt` | No page |")}\n- [New](docs/new.md)\n`);
    git("add", "-A");
    git("commit", "-q", "-m", "a new doc");
    const refused = run({ cwd: dir, base: "base", flows });
    expect(refused.code).toBe(1);
    expect(refused.lines.join("\n")).toContain("docs/new.md is a new doc.");
    write("README.md", `${table("| A | `src/a.ts`, `flow-pages.txt` | No page |")}\n- [New](docs/new.md) · Founder-Approved: decision page, 2026-10-21\n`);
    git("commit", "-q", "-am", "the founder said yes");
    expect(run({ cwd: dir, base: "base", flows }).code).toBe(0);
  });
});
