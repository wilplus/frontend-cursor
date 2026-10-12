import { beforeEach, describe, expect, it } from "vitest";

import {
  beginSetupDraft,
  listSetupDrafts,
  readActiveSetupDraft,
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

  it("is scoped per account, so a switch never shows another person's draft", () => {
    beginSetupDraft("u1");
    saveSetupDraft("u1", activeId("u1"), { ...BLANK, topic: "mine" });
    expect(listSetupDrafts("u2")).toEqual([]);
    expect(listSetupDrafts(null)).toEqual([]);
  });
});
