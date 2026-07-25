/* -------------------------------------------------------------------------- */
/*  journal — shared types, mappers and pure helpers for the Journal (blog)     */
/*                                                                            */
/*  ISOMORPHIC ON PURPOSE: the index's filter/sort UI is a client component, so */
/*  this module must stay importable from the browser. The network reads live   */
/*  in `journalServer.ts`, which pulls `getBackendUrl` (a "server-only"          */
/*  module) — importing that here would break the client bundle.                */
/*                                                                            */
/*  The post body is PLAIN TEXT with blank-line-separated paragraphs — never    */
/*  HTML, never Markdown. `splitParagraphs` is the only renderer; nothing here  */
/*  is ever passed to dangerouslySetInnerHTML.                                  */
/* -------------------------------------------------------------------------- */

export type JournalCategory =
  | "physiology"
  | "physical_exercise"
  | "philosophy"
  | "voice"
  | "language"
  | "others";

export type JournalCoverKind = "image" | "video" | "audio";

export type JournalSort = "newest" | "oldest" | "curated";

/** Category keys in display order, with their labels. "All" is UI-only. */
export const JOURNAL_CATEGORIES: ReadonlyArray<{
  key: JournalCategory;
  label: string;
}> = [
  { key: "physiology", label: "Physiology" },
  { key: "physical_exercise", label: "Physical Exercise" },
  { key: "philosophy", label: "Philosophy" },
  { key: "voice", label: "Voice" },
  { key: "language", label: "Language" },
  { key: "others", label: "Others" },
];

const CATEGORY_KEYS = new Set<string>(JOURNAL_CATEGORIES.map((c) => c.key));

export function categoryLabel(key: string): string {
  return JOURNAL_CATEGORIES.find((c) => c.key === key)?.label ?? "Others";
}

/** Card-level fields — what the index list returns. */
export interface JournalPostSummary {
  slug: string;
  title: string;
  excerpt: string;
  category: JournalCategory;
  readTimeMin: number | null;
  coverKind: JournalCoverKind;
  coverImageUrl: string | null;
  coverAlt: string | null;
  mediaDurationSec: number | null;
  publishedAt: string | null;
  sortOrder: number;
}

/** A full post — the card fields plus the body and SEO overrides. */
export interface JournalPost extends JournalPostSummary {
  body: string;
  mediaUrl: string | null;
  authorName: string;
  authorAvatarUrl: string | null;
  metaTitle: string | null;
  metaDescription: string | null;
  ogImageUrl: string | null;
}

/* ------------------------------- mapping --------------------------------- */

const str = (v: unknown): string => (typeof v === "string" ? v : "");
const strOrNull = (v: unknown): string | null =>
  typeof v === "string" && v.trim() !== "" ? v : null;
const numOrNull = (v: unknown): number | null =>
  typeof v === "number" && Number.isFinite(v) ? v : null;

function coerceCategory(v: unknown): JournalCategory {
  return typeof v === "string" && CATEGORY_KEYS.has(v)
    ? (v as JournalCategory)
    : "others";
}

function coerceCoverKind(v: unknown): JournalCoverKind {
  return v === "video" || v === "audio" ? v : "image";
}

/** Map one card row. Returns null when the row can't identify a post. */
export function mapJournalSummary(raw: unknown): JournalPostSummary | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const slug = str(r.slug).trim();
  if (!slug) return null; // a post without a slug has nowhere to link
  return {
    slug,
    title: str(r.title),
    excerpt: str(r.excerpt),
    category: coerceCategory(r.category),
    readTimeMin: numOrNull(r.read_time_min),
    coverKind: coerceCoverKind(r.cover_kind),
    coverImageUrl: strOrNull(r.cover_image_url),
    coverAlt: strOrNull(r.cover_alt),
    mediaDurationSec: numOrNull(r.media_duration_sec),
    publishedAt: strOrNull(r.published_at),
    sortOrder: numOrNull(r.sort_order) ?? 0,
  };
}

export function mapJournalPost(raw: unknown): JournalPost | null {
  const summary = mapJournalSummary(raw);
  if (!summary) return null;
  const r = raw as Record<string, unknown>;
  return {
    ...summary,
    body: str(r.body),
    mediaUrl: strOrNull(r.media_url),
    authorName: strOrNull(r.author_name) ?? "Willpower Lab",
    authorAvatarUrl: strOrNull(r.author_avatar_url),
    metaTitle: strOrNull(r.meta_title),
    metaDescription: strOrNull(r.meta_description),
    ogImageUrl: strOrNull(r.og_image_url),
  };
}

/* ------------------------------- helpers --------------------------------- */

/** The body is plain text: paragraphs are separated by blank lines. This is
 *  the ONLY body renderer — the result is rendered as <p> elements, so no
 *  HTML ever reaches the DOM. */
export function splitParagraphs(body: string): string[] {
  return body
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter((p) => p.length > 0);
}

/** 192 -> "3:12". Null/negative -> null (the badge is then omitted). */
export function formatDuration(sec: number | null): string | null {
  if (sec == null || !Number.isFinite(sec) || sec < 0) return null;
  const total = Math.round(sec);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

/** "2026-07-18" -> "18 JULY 2026". Invalid/absent -> null. */
export function formatJournalDate(iso: string | null): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d
    .toLocaleDateString("en-GB", {
      day: "numeric",
      month: "long",
      year: "numeric",
      timeZone: "UTC",
    })
    .toUpperCase();
}

/** Sort a list in place-safe fashion for the three UI sorts. */
export function sortJournalPosts<T extends JournalPostSummary>(
  posts: T[],
  sort: JournalSort
): T[] {
  const time = (p: T) => (p.publishedAt ? new Date(p.publishedAt).getTime() : 0);
  const copy = [...posts];
  if (sort === "oldest") return copy.sort((a, b) => time(a) - time(b));
  if (sort === "curated") {
    return copy.sort(
      (a, b) => a.sortOrder - b.sortOrder || time(b) - time(a)
    );
  }
  return copy.sort((a, b) => time(b) - time(a)); // newest
}

/** In-memory search + category filter (the index filters without refetching). */
export function filterJournalPosts<T extends JournalPostSummary>(
  posts: T[],
  opts: { query?: string; category?: JournalCategory | "all" }
): T[] {
  const q = (opts.query ?? "").trim().toLowerCase();
  const cat = opts.category ?? "all";
  return posts.filter((p) => {
    if (cat !== "all" && p.category !== cat) return false;
    if (!q) return true;
    return (
      p.title.toLowerCase().includes(q) || p.excerpt.toLowerCase().includes(q)
    );
  });
}

/** Slugify a title for the CMS "from title" button. Url-safe, lowercase. */
export function slugify(title: string): string {
  return title
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "") // strip combining accents
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}
