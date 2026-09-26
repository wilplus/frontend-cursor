import { beforeEach, describe, expect, it } from "vitest";

import {
  beginSetupDraft,
  clearActiveSetupDraft,
  deleteSetupDraft,
  finishActiveSetupDraft,
  isDraftWorthKeeping,
  listSetupDrafts,
  readActiveSetupDraft,
  resumeSetupDraft,
  saveSetupDraft,
  type SetupDraftFields,
} from "./setupDraft";

/* The vitest environment is node — a Map-backed localStorage stands in. */
const mem = new Map<string, string>();
(globalThis as unknown as { localStorage: Storage }).localStorage = {
  getItem: (k: string) => mem.get(k) ?? null,
  setItem: (k: string, v: string) => void mem.set(k, v),
  removeItem: (k: string) => void mem.delete(k),
  clear: () => mem.clear(),
  key: () => null,
  length: 0,
} as Storage;

const BLANK: SetupDraftFields = {
  step: 0,
  topic: "",
  audience: "",
  desiredCallToAction: "",
  lengthSec: null,
  slides: [{ title: "", body: "" }],
  presentationRef: null,
  strategicContext: "",
};

function activeId(owner: string | null): string {
  const a = readActiveSetupDraft(owner);
  if (!a) throw new Error("no active draft");
  return a.id;
}

describe("setup drafts", () => {
  beforeEach(() => mem.clear());

  it("stores nothing until at least one question is answered", () => {
    beginSetupDraft("u1");
    saveSetupDraft("u1", activeId("u1"), BLANK);
    expect(listSetupDrafts("u1")).toEqual([]);
    expect(isDraftWorthKeeping(BLANK)).toBe(false);
    expect(isDraftWorthKeeping({ ...BLANK, lengthSec: 120 })).toBe(true);
  });

  it("keeps an interrupted setup and resumes it with its answers and step", () => {
    beginSetupDraft("u1");
    const id = activeId("u1");
    saveSetupDraft("u1", id, { ...BLANK, topic: "Q3 pitch", step: 2 });
    clearActiveSetupDraft("u1"); // the overlay closed
    const [d] = listSetupDrafts("u1");
    expect(d).toMatchObject({ id, topic: "Q3 pitch", step: 2 });

    resumeSetupDraft("u1", id);
    expect(readActiveSetupDraft("u1")?.draft?.topic).toBe("Q3 pitch");
  });

  it("an emptied setup leaves the list instead of lingering as a blank draft", () => {
    beginSetupDraft("u1");
    const id = activeId("u1");
    saveSetupDraft("u1", id, { ...BLANK, audience: "board" });
    saveSetupDraft("u1", id, BLANK);
    expect(listSetupDrafts("u1")).toEqual([]);
  });

  it("never writes once another entry took over (continuing a project)", () => {
    beginSetupDraft("u1");
    const id = activeId("u1");
    clearActiveSetupDraft("u1");
    saveSetupDraft("u1", id, { ...BLANK, topic: "late write" });
    expect(listSetupDrafts("u1")).toEqual([]);
  });

  it("delete removes the draft and releases it as the active slot", () => {
    beginSetupDraft("u1");
    const id = activeId("u1");
    saveSetupDraft("u1", id, { ...BLANK, topic: "x" });
    deleteSetupDraft("u1", id);
    expect(listSetupDrafts("u1")).toEqual([]);
    expect(readActiveSetupDraft("u1")).toBeNull();
  });

  it("is scoped per account, so a switch never shows another person's draft", () => {
    beginSetupDraft("u1");
    saveSetupDraft("u1", activeId("u1"), { ...BLANK, topic: "mine" });
    expect(listSetupDrafts("u2")).toEqual([]);
    expect(listSetupDrafts(null)).toEqual([]);
  });

  it("finishing removes only the active draft, once Take 1 is accepted", () => {
    beginSetupDraft("u1");
    saveSetupDraft("u1", activeId("u1"), { ...BLANK, topic: "older" });
    beginSetupDraft("u1");
    saveSetupDraft("u1", activeId("u1"), { ...BLANK, topic: "recorded" });
    finishActiveSetupDraft("u1");
    expect(listSetupDrafts("u1").map((d) => d.topic)).toEqual(["older"]);
    expect(readActiveSetupDraft("u1")).toBeNull();
  });

  it("finishing with no active draft (a continued take) keeps every draft", () => {
    beginSetupDraft("u1");
    saveSetupDraft("u1", activeId("u1"), { ...BLANK, topic: "kept" });
    clearActiveSetupDraft("u1");
    finishActiveSetupDraft("u1");
    expect(listSetupDrafts("u1").map((d) => d.topic)).toEqual(["kept"]);
  });
});
