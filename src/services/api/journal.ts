/* -------------------------------------------------------------------------- */
/*  journal — shared types, mappers and pure helpers for the Journal (blog)     */
/*                                                                            */
/*  ISOMORPHIC ON PURPOSE: the index's filter/sort UI is a client component, so */
/*  this module must stay importable from the browser. The network reads live   */
/*  in `journalServer.ts`, which pulls `getBackendUrl` (a "server-only"          */
/*  module) — importing that here would break the client bundle.                */
/*                                                                            */
/*  The post body is PLAIN TEXT with blank-line-separated paragraphs — never    */
/*  HTML, never Markdown — with ONE minimal, founder-approved extension: two    */
/*  line-level media tokens (see the BODY TOKEN SPEC above `parseBodyBlocks`).  */
/*  `parseBodyBlocks` is the only renderer; nothing here is ever passed to      */
/*  dangerouslySetInnerHTML.                                                    */
/* -------------------------------------------------------------------------- */

export type JournalCategory =
  | "physiology"
  | "physical_exercise"
  | "philosophy"
  | "voice"
  | "language"
  | "science"
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
  { key: "science", label: "Science" },
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

/** The body is plain text: paragraphs are separated by blank lines. The
 *  low-level split — `parseBodyBlocks` (the actual renderer's input) builds
 *  on it and additionally recognises the two media tokens. The result is
 *  rendered as <p>/<figure>/<a> elements, so no HTML ever reaches the DOM. */
export function splitParagraphs(body: string): string[] {
  // Normalize Windows / pasted line endings first, or "\r\n\r\n" would not
  // match a blank-line split and the whole post would collapse into one block.
  const text = body.replace(/\r\n?/g, "\n");

  const byBlankLine = text
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter((p) => p.length > 0);
  if (byBlankLine.length > 1) return byBlankLine;

  // No blank lines anywhere: the author pressed Enter ONCE between paragraphs,
  // which is what a textarea makes look correct. Honour that instead of
  // rendering the entire post as a single paragraph (HTML collapses lone
  // newlines to spaces, so the result was an unreadable wall of text).
  return text
    .split("\n")
    .map((p) => p.trim())
    .filter((p) => p.length > 0);
}

/* -------------------------------------------------------------------------- */
/*  BODY TOKEN SPEC (founder-approved minimal extension, 2026-07-30)           */
/*                                                                            */
/*  The body stays PLAIN TEXT — no HTML, no Markdown, and the backend keeps    */
/*  treating it as opaque text. Exactly TWO line-level tokens are recognised:  */
/*                                                                            */
/*    [image: <url> | <alt text>]   → a centered image at the standard         */
/*                                    content width (<figure><img/></figure>)  */
/*    [file: <url> | <label>]      → a bordered download/link row              */
/*                                                                            */
/*  Rules:                                                                    */
/*    * The token must be the ENTIRE line (surrounding whitespace ignored).    */
/*    * <url> may not contain whitespace and must be http(s):// or             */
/*      site-relative ("/papers/x.pdf"). javascript:, data:, protocol-        */
/*      relative "//" etc. are rejected — the line then renders as text.      */
/*    * Escape hatch: any line that does not match EXACTLY renders as plain    */
/*      text inside its paragraph. A malformed token can never break a post.   */
/*                                                                            */
/*  This spec is mirrored in the contract comments in cms/page.tsx,           */
/*  blog/[slug]/page.tsx and the backend's services/journal.py docstring —    */
/*  keep them in step.                                                        */
/* -------------------------------------------------------------------------- */

export type BodyBlock =
  | { type: "p"; text: string }
  | { type: "image"; url: string; alt: string }
  | { type: "file"; url: string; label: string };

/** ^[image|file: url | text]$ — url is whitespace-free, text may be empty. */
const BODY_TOKEN_RE = /^\[(image|file):\s*(\S+)\s*\|([^\]]*)\]$/;

/** Only http(s) and site-relative URLs may render as src/href. Anything else
 *  (javascript:, data:, vbscript:, protocol-relative //evil.com) is refused
 *  and the token line falls back to plain text. */
export function isSafeBodyUrl(url: string): boolean {
  if (url.startsWith("/")) return !url.startsWith("//");
  return /^https?:\/\//i.test(url);
}

/** Parse the body into renderable blocks. Paragraph semantics are exactly
 *  `splitParagraphs`; within a paragraph, each LINE that is exactly a media
 *  token becomes its own image/file block, and the surrounding lines regroup
 *  into `p` blocks (joined with \n so whitespace-pre-line keeps the breaks).
 *  Isomorphic and pure — used by the public post page AND the CMS preview. */
export function parseBodyBlocks(body: string): BodyBlock[] {
  const blocks: BodyBlock[] = [];
  for (const para of splitParagraphs(body)) {
    let text: string[] = [];
    const flush = () => {
      if (text.length > 0) {
        blocks.push({ type: "p", text: text.join("\n") });
        text = [];
      }
    };
    for (const rawLine of para.split("\n")) {
      const line = rawLine.trim();
      const m = BODY_TOKEN_RE.exec(line);
      if (m && isSafeBodyUrl(m[2])) {
        flush();
        const url = m[2];
        const label = m[3].trim();
        if (m[1] === "image") {
          blocks.push({ type: "image", url, alt: label });
        } else {
          // A file row with no label still needs a visible name to click.
          blocks.push({ type: "file", url, label: label || url });
        }
      } else if (line.length > 0) {
        text.push(rawLine);
      }
    }
    flush();
  }
  return blocks;
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

/* -------------------------------------------------------------------------- */
/*  Client-side read of the PUBLIC list                                        */
/*                                                                            */
/*  The public pages read the backend server-side (journalServer.ts, ISR).     */
/*  This is for BROWSER surfaces that need the list live — the coach choosing  */
/*  a post to attach to a moment. Same-origin, no token, soft-fails to [] so a  */
/*  picker degrades to "nothing to choose" instead of breaking its host.        */
/* -------------------------------------------------------------------------- */

export async function fetchPublishedPosts(): Promise<JournalPostSummary[]> {
  let res: Response;
  try {
    res = await fetch("/api/v2/journal/posts?limit=100", {
      headers: { Accept: "application/json" },
      cache: "no-store",
    });
  } catch {
    return [];
  }
  if (!res.ok) return [];
  const body = (await res.json().catch(() => null)) as Record<
    string,
    unknown
  > | null;
  const rows = Array.isArray(body?.posts) ? (body.posts as unknown[]) : [];
  return rows
    .map(mapJournalSummary)
    .filter((p): p is JournalPostSummary => p !== null);
}
