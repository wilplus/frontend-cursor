/**
 * The design-lock guard (build plan X5): a commit that changes a file behind
 * a founder-locked screen must carry a non-empty `Founder-Approved:` trailer,
 * or `npm run check:design-lock` fails the diff. The live run is the unit
 * job's "Design-lock guard" step and scripts/local_ci.sh; these tests pin the
 * rule on a throwaway repository, and pin the list to what CLAUDE.md locks.
 */
import { execFileSync } from "node:child_process";
import { existsSync, mkdtempSync, mkdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { LIST_PATH, TRAILER, isLocked, parseList, run } from "./check-design-lock.mjs";

const GIT_ENV = {
  ...process.env,
  GIT_AUTHOR_NAME: "t", GIT_AUTHOR_EMAIL: "t@t.co",
  GIT_COMMITTER_NAME: "t", GIT_COMMITTER_EMAIL: "t@t.co",
  GIT_CONFIG_GLOBAL: "/dev/null", GIT_CONFIG_SYSTEM: "/dev/null",
};

function git(cwd: string, ...args: string[]) {
  return execFileSync("git", args, { cwd, encoding: "utf8", env: GIT_ENV }).trim();
}

const LOCKED = "src/screens/Locked.tsx";
const LOCKED_DIR_FILE = "src/screens/walk/Stage.tsx";
const LOCKED_DIR_TEST = "src/screens/walk/Stage.test.tsx";
const FREE = "src/other/Free.tsx";

let repo: string;
let list: string;

function write(path: string, text: string) {
  const full = join(repo, path);
  mkdirSync(dirname(full), { recursive: true });
  writeFileSync(full, text);
}

function commit(path: string, message: string) {
  write(path, `${message}\n${Math.random()}\n`);
  git(repo, "add", "-A");
  git(repo, "commit", "-q", "-m", message);
}

beforeEach(() => {
  repo = mkdtempSync(join(tmpdir(), "design-lock-"));
  list = join(repo, "locked.txt");
  writeFileSync(list, `# locked\n${LOCKED}\nsrc/screens/walk/\n`);
  git(repo, "init", "-q", "-b", "main");
  commit(FREE, "initial");
  git(repo, "branch", "base");
  git(repo, "checkout", "-q", "-b", "work");
});
afterEach(() => rmSync(repo, { recursive: true, force: true }));

const guard = () => run({ cwd: repo, base: "base", list });

describe("the guard on a branch", () => {
  it("passes a branch that touches nothing locked", () => {
    commit(FREE, "free change");
    const { code, lines } = guard();
    expect(code).toBe(0);
    expect(lines.join("\n")).toContain("clean");
  });

  it("fails a commit that changes a locked file without the trailer", () => {
    commit(LOCKED, "redraw the locked screen");
    const { code, lines } = guard();
    expect(code).toBe(1);
    const out = lines.join("\n");
    expect(out).toContain("redraw the locked screen");
    expect(out).toContain(LOCKED);
    expect(out).toContain(`${TRAILER}:`);
  });

  it("passes the same change with the trailer", () => {
    commit(LOCKED, `redraw the locked screen\n\n${TRAILER}: Navigation Panel GO-W1, 2026-10-07`);
    const { code, lines } = guard();
    expect(code).toBe(0);
    expect(lines.join("\n")).toContain("Navigation Panel GO-W1, 2026-10-07");
  });

  it("an empty trailer value is no approval", () => {
    commit(LOCKED, `redraw the locked screen\n\n${TRAILER}:`);
    expect(guard().code).toBe(1);
  });

  it("the trailer must be a trailer, not a sentence in the body", () => {
    commit(LOCKED, `redraw\n\nThe founder said ${TRAILER}: yes, and more words follow.\n\nSigned-off-by: t <t@t.co>`);
    expect(guard().code).toBe(1);
  });

  it("locks every file under a directory pattern, but never a test", () => {
    commit(LOCKED_DIR_TEST, "pin the stage");
    expect(guard().code).toBe(0);
    commit(LOCKED_DIR_FILE, "move the stage");
    expect(guard().code).toBe(1);
  });

  it("checks each commit on its own: one approved, one not", () => {
    commit(LOCKED, `approved\n\n${TRAILER}: GO-W1`);
    commit(LOCKED, "slipped in after");
    const { code, lines } = guard();
    expect(code).toBe(1);
    expect(lines.join("\n")).toMatch(/ok\s+\w+ approved/);
    expect(lines.join("\n")).toMatch(/FAIL\s+\w+ slipped in after/);
  });

  it("ignores commits that are on the base already", () => {
    git(repo, "checkout", "-q", "base");
    commit(LOCKED, "a locked change merged earlier, without a trailer");
    git(repo, "checkout", "-q", "work");
    git(repo, "merge", "-q", "--no-edit", "base");
    commit(FREE, "free change");
    expect(guard().code).toBe(0);
  });

  it("reports an uncommitted locked change without failing on it", () => {
    write(LOCKED, "not yet committed");
    const { code, lines } = guard();
    expect(code).toBe(0);
    expect(lines.join("\n")).toContain("uncommitted");
    expect(lines.join("\n")).toContain(LOCKED);
  });

  it("refuses to run against a base it cannot see", () => {
    const { code } = run({ cwd: repo, base: "origin/nowhere", list });
    expect(code).toBe(2);
  });
});

describe("the list", () => {
  it("parses comments and blank lines away", () => {
    expect(parseList("# c\n\n a/b.ts # trailing\nc/\n")).toEqual(["a/b.ts", "c/"]);
  });

  it("matches exact paths and trees, never tests", () => {
    const p = ["a/b.ts", "c/"];
    expect(isLocked("a/b.ts", p)).toBe(true);
    expect(isLocked("a/b.test.ts", p)).toBe(false);
    expect(isLocked("a/bb.ts", p)).toBe(false);
    expect(isLocked("c/d/e.tsx", p)).toBe(true);
    expect(isLocked("c/d/e.test.tsx", p)).toBe(false);
    expect(isLocked("cc/e.tsx", p)).toBe(false);
  });

  const real = parseList(readFileSync(LIST_PATH, "utf8"));

  it("names only files and directories that exist (a rename must update the list)", () => {
    for (const entry of real) {
      expect(existsSync(entry), `${entry} is listed but does not exist`).toBe(true);
      expect(statSync(entry).isDirectory(), `${entry}: a tree ends with "/", a file does not`).toBe(entry.endsWith("/"));
    }
  });

  it.each([
    // CLAUDE.md, "Design lock — the speaker's Ideal Text"
    "src/components/willab/DeckChunkModal.tsx",
    "src/components/willab/ParagraphSheet.tsx",
    "src/components/willab/idealEditCopy.ts",
    // "— the coach panel"
    "src/components/willab/coachpanel/",
    "src/lib/willab/coachPanelCopy.ts",
    // the Feedback walk
    "src/components/willab/walk/",
    // "— the recording screens"
    "src/components/willab/LabOverlay.tsx",
    "src/components/willab/RecordingRoadmap.tsx",
    // "— the consent screens"
    "src/components/willab/Phase1AcceptanceFlow.tsx",
    "src/components/willab/WelcomeConsent.tsx",
    "src/app/account/data-consent/page.tsx",
  ])("locks %s, which CLAUDE.md names", (entry) => {
    expect(real).toContain(entry);
  });
});
