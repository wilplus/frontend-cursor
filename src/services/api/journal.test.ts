import { describe, expect, it } from "vitest";
import {
  categoryLabel,
  filterJournalPosts,
  formatDuration,
  formatJournalDate,
  isSafeBodyUrl,
  JOURNAL_CATEGORIES,
  mapJournalPost,
  mapJournalSummary,
  parseBodyBlocks,
  slugify,
  sortJournalPosts,
  splitParagraphs,
  type JournalPostSummary,
} from "./journal";
import {
  mapCommunityPost,
  sortCommunityByCadence,
} from "./journalAdmin";

function row(over: Record<string, unknown> = {}) {
  return {
    slug: "a-post",
    title: "A post",
    excerpt: "An excerpt",
    category: "voice",
    read_time_min: 4,
    cover_kind: "image",
    cover_image_url: "https://cdn.test/a.jpg",
    cover_alt: "alt",
    media_duration_sec: null,
    published_at: "2026-07-18T00:00:00Z",
    sort_order: 2,
    ...over,
  };
}

function summary(over: Partial<JournalPostSummary> = {}): JournalPostSummary {
  return {
    slug: "s",
    title: "T",
    excerpt: "",
    category: "voice",
    readTimeMin: null,
    coverKind: "image",
    coverImageUrl: null,
    coverAlt: null,
    mediaDurationSec: null,
    publishedAt: null,
    sortOrder: 0,
    ...over,
  };
}

describe("mapJournalSummary", () => {
  it("maps the snake_case card payload", () => {
    expect(mapJournalSummary(row())).toEqual({
      slug: "a-post",
      title: "A post",
      excerpt: "An excerpt",
      category: "voice",
      readTimeMin: 4,
      coverKind: "image",
      coverImageUrl: "https://cdn.test/a.jpg",
      coverAlt: "alt",
      mediaDurationSec: null,
      publishedAt: "2026-07-18T00:00:00Z",
      sortOrder: 2,
    });
  });

  it("drops a row with no slug (nothing to link to)", () => {
    expect(mapJournalSummary(row({ slug: "" }))).toBeNull();
    expect(mapJournalSummary(null)).toBeNull();
  });

  it("falls back to safe enum values", () => {
    const m = mapJournalSummary(row({ category: "nope", cover_kind: "gif" }));
    expect(m?.category).toBe("others");
    expect(m?.coverKind).toBe("image");
  });
});

describe("mapJournalPost", () => {
  it("adds the body and defaults the author", () => {
    const m = mapJournalPost(row({ body: "one\n\ntwo", author_name: "" }));
    expect(m?.body).toBe("one\n\ntwo");
    expect(m?.authorName).toBe("Willpower Lab");
  });
});

describe("splitParagraphs", () => {
  it("splits on blank lines and trims", () => {
    expect(splitParagraphs("one\n\n  two  \n\n\nthree")).toEqual([
      "one",
      "two",
      "three",
    ]);
  });

  // A body written with ONE Enter between paragraphs used to collapse into a
  // single <p>, because HTML turns lone newlines into spaces — the published
  // post came out as an unreadable wall of text.
  it("treats single newlines as paragraph breaks when there are no blank lines", () => {
    expect(splitParagraphs("para one\npara two\npara three")).toEqual([
      "para one",
      "para two",
      "para three",
    ]);
  });

  it("keeps single newlines INSIDE a paragraph once blank lines are in use", () => {
    expect(splitParagraphs("line one\nline two\n\nnext para")).toEqual([
      "line one\nline two",
      "next para",
    ]);
  });

  it("normalizes CRLF so pasted text still splits", () => {
    expect(splitParagraphs("one\r\n\r\ntwo")).toEqual(["one", "two"]);
    expect(splitParagraphs("one\r\ntwo")).toEqual(["one", "two"]);
  });

  it("returns [] for empty or whitespace-only bodies", () => {
    expect(splitParagraphs("")).toEqual([]);
    expect(splitParagraphs("\n\n  \n")).toEqual([]);
  });
});

describe("formatDuration", () => {
  it("formats mm:ss with a padded seconds field", () => {
    expect(formatDuration(192)).toBe("3:12");
    expect(formatDuration(65)).toBe("1:05");
    expect(formatDuration(9)).toBe("0:09");
  });

  it("returns null when absent or negative", () => {
    expect(formatDuration(null)).toBeNull();
    expect(formatDuration(-5)).toBeNull();
  });
});

describe("formatJournalDate", () => {
  it("renders an uppercase long date", () => {
    expect(formatJournalDate("2026-07-18T00:00:00Z")).toBe("18 JULY 2026");
  });

  it("returns null for absent or unparseable input", () => {
    expect(formatJournalDate(null)).toBeNull();
    expect(formatJournalDate("not-a-date")).toBeNull();
  });
});

describe("sortJournalPosts", () => {
  const a = summary({ slug: "a", publishedAt: "2026-01-01", sortOrder: 3 });
  const b = summary({ slug: "b", publishedAt: "2026-06-01", sortOrder: 1 });
  const c = summary({ slug: "c", publishedAt: "2026-03-01", sortOrder: 2 });

  it("newest first by default", () => {
    expect(sortJournalPosts([a, b, c], "newest").map((p) => p.slug)).toEqual([
      "b",
      "c",
      "a",
    ]);
  });

  it("oldest first", () => {
    expect(sortJournalPosts([a, b, c], "oldest").map((p) => p.slug)).toEqual([
      "a",
      "c",
      "b",
    ]);
  });

  it("curated uses sort_order", () => {
    expect(sortJournalPosts([a, b, c], "curated").map((p) => p.slug)).toEqual([
      "b",
      "c",
      "a",
    ]);
  });

  it("does not mutate the input array", () => {
    const input = [a, b, c];
    sortJournalPosts(input, "oldest");
    expect(input.map((p) => p.slug)).toEqual(["a", "b", "c"]);
  });
});

describe("filterJournalPosts", () => {
  const posts = [
    summary({ slug: "a", title: "Breathing under pressure", category: "physiology" }),
    summary({ slug: "b", title: "On silence", category: "philosophy", excerpt: "pressure valve" }),
  ];

  it("filters by category", () => {
    expect(
      filterJournalPosts(posts, { category: "philosophy" }).map((p) => p.slug)
    ).toEqual(["b"]);
  });

  it("searches title and excerpt, case-insensitively", () => {
    expect(filterJournalPosts(posts, { query: "PRESSURE" }).map((p) => p.slug)).toEqual([
      "a",
      "b",
    ]);
  });

  it("returns everything with no filters", () => {
    expect(filterJournalPosts(posts, {})).toHaveLength(2);
  });
});

describe("slugify", () => {
  it("makes a url-safe slug", () => {
    expect(slugify("Breathing Under Pressure!")).toBe("breathing-under-pressure");
  });

  it("strips accents and collapses separators", () => {
    expect(slugify("Café  —  naïve")).toBe("cafe-naive");
  });

  it("trims leading and trailing dashes", () => {
    expect(slugify("  ...hello...  ")).toBe("hello");
  });
});

describe("categoryLabel", () => {
  it("labels known keys and falls back to Others", () => {
    expect(categoryLabel("physical_exercise")).toBe("Physical Exercise");
    expect(categoryLabel("bogus")).toBe("Others");
  });

  it("knows the science category (the /science consolidation)", () => {
    expect(categoryLabel("science")).toBe("Science");
    expect(JOURNAL_CATEGORIES.map((c) => c.key)).toContain("science");
    // Posts seeded/saved as science must survive mapping, not fall to others.
    expect(mapJournalSummary(row({ category: "science" }))?.category).toBe(
      "science"
    );
  });
});

/* -------------------------------------------------------------------------- */
/*  Body token parsing — the BODY TOKEN SPEC in journal.ts                     */
/* -------------------------------------------------------------------------- */

describe("isSafeBodyUrl", () => {
  it("allows http(s) and site-relative URLs", () => {
    expect(isSafeBodyUrl("https://cdn.test/a.webp")).toBe(true);
    expect(isSafeBodyUrl("http://cdn.test/a.webp")).toBe(true);
    expect(isSafeBodyUrl("/papers/EBCP.pdf")).toBe(true);
  });

  it("rejects script schemes and protocol-relative URLs", () => {
    expect(isSafeBodyUrl("javascript:alert(1)")).toBe(false);
    expect(isSafeBodyUrl("data:text/html,x")).toBe(false);
    expect(isSafeBodyUrl("vbscript:x")).toBe(false);
    expect(isSafeBodyUrl("//evil.test/a.png")).toBe(false);
    expect(isSafeBodyUrl("ftp://x/y")).toBe(false);
  });
});

describe("parseBodyBlocks", () => {
  it("renders a plain body as p blocks (paragraph semantics unchanged)", () => {
    expect(parseBodyBlocks("one\n\ntwo")).toEqual([
      { type: "p", text: "one" },
      { type: "p", text: "two" },
    ]);
  });

  it("parses an image token line into an image block", () => {
    expect(
      parseBodyBlocks("intro\n\n[image: https://cdn.test/a.webp | A drill]\n\noutro")
    ).toEqual([
      { type: "p", text: "intro" },
      { type: "image", url: "https://cdn.test/a.webp", alt: "A drill" },
      { type: "p", text: "outro" },
    ]);
  });

  it("parses a file token line into a file block", () => {
    expect(parseBodyBlocks("[file: /papers/EBCP.pdf | Read the paper (PDF)]")).toEqual([
      { type: "file", url: "/papers/EBCP.pdf", label: "Read the paper (PDF)" },
    ]);
  });

  it("splits a token out of the middle of a paragraph", () => {
    expect(
      parseBodyBlocks("line one\n[image: https://x.test/i.png | pic]\nline two")
    ).toEqual([
      { type: "p", text: "line one" },
      { type: "image", url: "https://x.test/i.png", alt: "pic" },
      { type: "p", text: "line two" },
    ]);
  });

  it("allows an empty alt and falls back to the url for an empty file label", () => {
    expect(parseBodyBlocks("[image: https://x.test/i.png |]")).toEqual([
      { type: "image", url: "https://x.test/i.png", alt: "" },
    ]);
    expect(parseBodyBlocks("[file: https://x.test/d.pdf | ]")).toEqual([
      { type: "file", url: "https://x.test/d.pdf", label: "https://x.test/d.pdf" },
    ]);
  });

  it("escape hatch: malformed tokens render as plain text", () => {
    // No closing bracket / not the whole line / unknown token name.
    expect(parseBodyBlocks("[image: https://x.test/i.png | pic")).toEqual([
      { type: "p", text: "[image: https://x.test/i.png | pic" },
    ]);
    expect(parseBodyBlocks("see [image: https://x.test/i.png | pic] here")).toEqual([
      { type: "p", text: "see [image: https://x.test/i.png | pic] here" },
    ]);
    expect(parseBodyBlocks("[video: https://x.test/v.mp4 | clip]")).toEqual([
      { type: "p", text: "[video: https://x.test/v.mp4 | clip]" },
    ]);
    // No pipe at all.
    expect(parseBodyBlocks("[image: https://x.test/i.png]")).toEqual([
      { type: "p", text: "[image: https://x.test/i.png]" },
    ]);
  });

  it("refuses unsafe URLs and renders the line as text instead", () => {
    expect(parseBodyBlocks("[image: javascript:alert(1) | x]")).toEqual([
      { type: "p", text: "[image: javascript:alert(1) | x]" },
    ]);
    expect(parseBodyBlocks("[file: //evil.test/x.pdf | x]")).toEqual([
      { type: "p", text: "[file: //evil.test/x.pdf | x]" },
    ]);
  });

  it("tolerates surrounding whitespace around a token line", () => {
    expect(parseBodyBlocks("  [image: https://x.test/i.png | pic]  ")).toEqual([
      { type: "image", url: "https://x.test/i.png", alt: "pic" },
    ]);
  });

  it("returns [] for an empty body", () => {
    expect(parseBodyBlocks("")).toEqual([]);
  });
});

/* -------------------------------------------------------------------------- */
/*  Community Content Studio                                                   */
/*                                                                            */
/*  These drafts are never journal posts, so the data layer is where the       */
/*  invariants live: an unusable row is dropped rather than half-rendered, and  */
/*  a flag always survives mapping so the warning can be shown.                 */
/* -------------------------------------------------------------------------- */

function communityRow(over: Record<string, unknown> = {}) {
  return {
    id: "c1",
    journal_post_id: "p1",
    kind: "fear",
    label: "Fear",
    day: "Tue",
    title: "The freeze",
    body: "one\n\ntwo",
    char_count: 8,
    flags: [],
    pillar_id: 6,
    pillar_name: "Focus & attention",
    theme: "The Re-Entry Note",
    soft_cta_line: "",
    app_proof_line: "proof",
    generated_at: "2026-07-25T00:00:00Z",
    updated_at: null,
    ...over,
  };
}

describe("sortCommunityByCadence", () => {
  it("orders by posting day, not by the order the API returned", () => {
    const items = [
      { kind: "win" as const },
      { kind: "myth_bust" as const },
      { kind: "fear" as const },
    ];
    expect(sortCommunityByCadence(items).map((i) => i.kind)).toEqual([
      "fear", // Tue
      "myth_bust", // Thu
      "win", // Sat
    ]);
  });

  it("does not mutate the input", () => {
    const items = [{ kind: "win" as const }, { kind: "fear" as const }];
    sortCommunityByCadence(items);
    expect(items.map((i) => i.kind)).toEqual(["win", "fear"]);
  });
});

describe("mapCommunityPost", () => {
  it("maps a row and keeps the batch-level fields", () => {
    const p = mapCommunityPost(communityRow());
    expect(p?.kind).toBe("fear");
    expect(p?.label).toBe("Fear");
    expect(p?.pillarName).toBe("Focus & attention");
    expect(p?.theme).toBe("The Re-Entry Note");
    expect(p?.appProofLine).toBe("proof");
  });

  it("keeps a verify flag so the warning can be rendered", () => {
    expect(mapCommunityPost(communityRow({ flags: ["verify"] }))?.flags).toEqual(
      ["verify"]
    );
    expect(
      mapCommunityPost(communityRow({ flags: ["construct", "verify"] }))?.flags
    ).toEqual(["construct", "verify"]);
  });

  it("drops flags it does not understand rather than rendering them raw", () => {
    expect(
      mapCommunityPost(communityRow({ flags: ["verify", "nonsense"] }))?.flags
    ).toEqual(["verify"]);
  });

  it("returns null without an id or with an unknown kind", () => {
    // No id: nothing to update or delete against.
    expect(mapCommunityPost(communityRow({ id: "" }))).toBeNull();
    // Unknown kind: cannot be placed in the cadence.
    expect(mapCommunityPost(communityRow({ kind: "rant" }))).toBeNull();
  });

  it("falls back to the body length when char_count is missing", () => {
    const p = mapCommunityPost(
      communityRow({ char_count: null, body: "12345" })
    );
    expect(p?.charCount).toBe(5);
  });

  it("treats an absent soft CTA as empty, so it is simply not rendered", () => {
    expect(mapCommunityPost(communityRow())?.softCtaLine).toBe("");
  });
});
