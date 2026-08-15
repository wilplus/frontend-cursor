import { describe, expect, it } from "vitest";

import {
  findProjectNameConflict,
  isSameProjectName,
  normalizeProjectName,
  suggestFreeProjectName,
  type NamedProject,
} from "./projectNames";

const LIB: NamedProject[] = [
  { arcId: "arc-book", topic: "Book" },
  { arcId: "arc-test", topic: "Testtttt" },
  { arcId: "arc-q3", topic: "My Q3 results pitch" },
];

describe("normalizeProjectName — must mirror the backend exactly", () => {
  // routes/v2/arcs.py: " ".join(topic.strip().lower().split()). Anything this
  // file treats as distinct that the server treats as equal is a guard that
  // lies: the UI would say the name is free while the take gets filed into
  // someone else's project.
  it("trims, lowercases and collapses internal whitespace", () => {
    expect(normalizeProjectName("  My   Talk  ")).toBe("my talk");
  });

  it("collapses tabs and newlines, not just spaces", () => {
    // Python's argless split() breaks on ANY whitespace run — a normalizer
    // that only handled " " would disagree with the server on pasted text.
    expect(normalizeProjectName("My\tTalk")).toBe("my talk");
    expect(normalizeProjectName("My\n\nTalk")).toBe("my talk");
  });

  it("treats null, undefined and blank as no name", () => {
    expect(normalizeProjectName(null)).toBe("");
    expect(normalizeProjectName(undefined)).toBe("");
    expect(normalizeProjectName("   ")).toBe("");
  });
});

describe("isSameProjectName", () => {
  it("matches across case and spacing", () => {
    expect(isSameProjectName("Book", "  book ")).toBe(true);
  });

  it("does not match two blanks — a blank is not a name", () => {
    expect(isSameProjectName("", "")).toBe(false);
    expect(isSameProjectName("  ", null)).toBe(false);
  });
});

describe("findProjectNameConflict", () => {
  it("returns the project that already owns the name", () => {
    expect(findProjectNameConflict("book", LIB)?.arcId).toBe("arc-book");
  });

  it("returns the PROJECT, not a boolean, so we can offer to open it", () => {
    // "that name is taken" is an obstacle; "you already have this" is an answer.
    const hit = findProjectNameConflict("  BOOK  ", LIB);
    expect(hit).toEqual({ arcId: "arc-book", topic: "Book" });
  });

  it("lets a genuinely new name through", () => {
    expect(findProjectNameConflict("Book club keynote", LIB)).toBeNull();
  });

  it("is not fooled by a substring", () => {
    // "Book" must not collide with "Book club keynote" in either direction —
    // the identity is the whole name, exactly as the server compares it.
    expect(findProjectNameConflict("Boo", LIB)).toBeNull();
    expect(
      findProjectNameConflict("Book", [{ arcId: "a", topic: "Book club" }])
    ).toBeNull();
  });

  it("treats an empty name as colliding with nothing", () => {
    // The step's own required-field rule owns the blank case; reporting a
    // collision here would show a confusing error before they have typed.
    expect(findProjectNameConflict("", LIB)).toBeNull();
    expect(findProjectNameConflict("   ", LIB)).toBeNull();
  });

  it("survives a missing or empty library", () => {
    expect(findProjectNameConflict("Book", null)).toBeNull();
    expect(findProjectNameConflict("Book", [])).toBeNull();
  });
});

describe("suggestFreeProjectName", () => {
  it("suffixes from 2, since the typed name is conceptually the first", () => {
    expect(suggestFreeProjectName("Book", LIB)).toBe("Book 2");
  });

  it("skips suffixes already taken, so the suggestion is never a collision", () => {
    const lib = [...LIB, { arcId: "a2", topic: "Book 2" },
                 { arcId: "a3", topic: "book 3" }];
    expect(suggestFreeProjectName("Book", lib)).toBe("Book 4");
  });

  it("returns the name unchanged when it is already free", () => {
    expect(suggestFreeProjectName("Something new", LIB)).toBe("Something new");
  });

  it("preserves the user's capitalisation — we suggest, we do not correct", () => {
    expect(suggestFreeProjectName("BOOK", LIB)).toBe("BOOK 2");
  });

  it("gives up rather than spinning on a pathological library", () => {
    const many = Array.from({ length: 200 }, (_, i) => ({
      arcId: `a${i}`, topic: i === 0 ? "X" : `X ${i + 1}`,
    }));
    expect(suggestFreeProjectName("X", many, 5)).toBe("");
  });

  it("has nothing to suggest for a blank name", () => {
    expect(suggestFreeProjectName("", LIB)).toBe("");
  });
});
