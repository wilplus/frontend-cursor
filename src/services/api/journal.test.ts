import { describe, expect, it } from "vitest";
import {
  categoryLabel,
  filterJournalPosts,
  formatDuration,
  formatJournalDate,
  mapJournalPost,
  mapJournalSummary,
  slugify,
  sortJournalPosts,
  splitParagraphs,
  type JournalPostSummary,
} from "./journal";

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
});
