import {
  mapJournalPost,
  type JournalCategory,
  type JournalCoverKind,
  type JournalPost,
} from "./journal";

/* -------------------------------------------------------------------------- */
/*  journalAdmin — the CMS client (browser-side)                               */
/*                                                                            */
/*  Auth is the existing internal-tools pattern: a shared admin password that   */
/*  rides in the BODY of every request and is checked on the BACKEND. There is  */
/*  no user role and no Supabase session involved, so every call (including     */
/*  reads) is a POST.                                                          */
/*                                                                            */
/*  The password lives in component state (optionally sessionStorage, NEVER     */
/*  localStorage) and is passed in per call — this module never stores it.      */
/* -------------------------------------------------------------------------- */

/** A post as the CMS edits it: drafts included, so `status` matters here. */
export interface AdminJournalPost extends JournalPost {
  id: string;
  status: "draft" | "published";
}

/** Everything the editor can write. Server owns id/created/updated. */
export interface JournalPostDraft {
  slug: string;
  title: string;
  excerpt: string;
  category: JournalCategory;
  read_time_min: number | null;
  cover_kind: JournalCoverKind;
  cover_image_url: string | null;
  cover_alt: string | null;
  media_url: string | null;
  media_duration_sec: number | null;
  body: string;
  author_name: string;
  published_at: string | null;
}

export type AdminResult<T> =
  | { ok: true; data: T }
  /** `code` is the backend's machine-readable reason, when it sent one. Added
   *  for the cover generator, which must tell a rewordable refusal
   *  (IMAGE_REJECTED) and a dead kill switch (DISABLED) apart from a transient
   *  draw failure (V2_ERROR) that is worth a retry button. Optional on purpose:
   *  every older caller reads only `message`/`status` and is unaffected. */
  | { ok: false; status: number; message: string; code?: string };

function readError(data: unknown, status: number): string {
  const d = (data && typeof data === "object" ? data : {}) as Record<
    string,
    unknown
  >;
  if (typeof d.error === "string" && d.error.trim()) return d.error;
  if (status === 401) return "Wrong password.";
  if (status === 409) return "That slug is already taken.";
  if (status === 503) return "Admin password is not configured on the server.";
  return `Request failed (HTTP ${status}).`;
}

/** POST a password-gated CMS call. `path` is the segment after /journal/. */
async function post<T>(
  path: string,
  password: string,
  body: Record<string, unknown>,
  pick: (data: unknown) => T
): Promise<AdminResult<T>> {
  let res: Response;
  let data: unknown;
  try {
    res = await fetch(`/api/v2/internal/journal/${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password, ...body }),
    });
    data = await res.json().catch(() => ({}));
  } catch {
    return { ok: false, status: 0, message: "Network error. Try again." };
  }
  if (!res.ok) {
    const code = (data as Record<string, unknown> | null)?.code;
    return {
      ok: false,
      status: res.status,
      message: readError(data, res.status),
      ...(typeof code === "string" && code ? { code } : {}),
    };
  }
  return { ok: true, data: pick(data) };
}

function mapAdminPost(raw: unknown): AdminJournalPost | null {
  const base = mapJournalPost(raw);
  if (!base) return null;
  const r = (raw ?? {}) as Record<string, unknown>;
  const id = typeof r.id === "string" ? r.id : String(r.id ?? "");
  if (!id) return null;
  return {
    ...base,
    id,
    status: r.status === "published" ? "published" : "draft",
  };
}

function mapAdminList(data: unknown): AdminJournalPost[] {
  const d = (data ?? {}) as Record<string, unknown>;
  const rows = Array.isArray(d.posts) ? d.posts : Array.isArray(data) ? data : [];
  return (rows as unknown[])
    .map(mapAdminPost)
    .filter((p): p is AdminJournalPost => p !== null);
}

/** Every post, drafts included. Doubles as the password check on unlock. */
export function adminListPosts(password: string) {
  return post("posts/list", password, {}, mapAdminList);
}

export function adminGetPost(password: string, id: string) {
  return post("posts/get", password, { id }, (d) => {
    const row = (d as Record<string, unknown>)?.post ?? d;
    return mapAdminPost(row);
  });
}

export function adminCreatePost(
  password: string,
  draft: Partial<JournalPostDraft>
) {
  return post("posts/create", password, draft, (d) => {
    const row = (d as Record<string, unknown>)?.post ?? d;
    return mapAdminPost(row);
  });
}

export function adminUpdatePost(
  password: string,
  id: string,
  draft: JournalPostDraft
) {
  return post("posts/update", password, { id, ...draft }, (d) => {
    const row = (d as Record<string, unknown>)?.post ?? d;
    return mapAdminPost(row);
  });
}

export function adminDeletePost(password: string, id: string) {
  return post("posts/delete", password, { id }, () => true);
}

export function adminSetPublished(
  password: string,
  id: string,
  published: boolean
) {
  return post(
    published ? "posts/publish" : "posts/unpublish",
    password,
    { id },
    (d) => {
      const row = (d as Record<string, unknown>)?.post ?? d;
      return mapAdminPost(row);
    }
  );
}

export function adminReorder(password: string, ids: string[]) {
  return post("reorder", password, { ids }, () => true);
}

/* -------------------------------------------------------------------------- */
/*  Community Content Studio                                                   */
/*                                                                            */
/*  The week's journal post IS format ① Technique; these are the three other   */
/*  formats derived from it. They are NOT journal posts and can never become   */
/*  one: the row has no slug, no status and no published_at, and no public      */
/*  route serves them. Anything that would imply publishing belongs nowhere    */
/*  near this type.                                                           */
/* -------------------------------------------------------------------------- */

export type CommunityKind = "myth_bust" | "fear" | "win";

/** Why a draft needs a human eye before it goes out. Never a reason to drop it. */
export type CommunityFlag = "construct" | "verify";

export interface CommunityPost {
  id: string;
  journalPostId: string;
  kind: CommunityKind;
  /** Server-supplied display label. Deliberately not re-derived from `kind`. */
  label: string;
  /** Posting day from the content model's cadence. */
  day: string;
  title: string;
  /** Plain text, blank-line paragraphs — same shape as a journal body. */
  body: string;
  charCount: number;
  flags: CommunityFlag[];
  /** Batch-level: identical across all three items of a post. */
  pillarId: number | null;
  pillarName: string;
  theme: string;
  /** "" unless the batch is pillar 6. Render only when non-empty. */
  softCtaLine: string;
  appProofLine: string;
  generatedAt: string | null;
  updatedAt: string | null;
}

const KINDS: CommunityKind[] = ["myth_bust", "fear", "win"];

/** Posting order from the content model's cadence: Tue Fear, Thu Myth-bust,
 *  Sat Win. Deliberately NOT the order the API returns (generation order), and
 *  defined once here so the queue and the editor can never disagree. */
export const COMMUNITY_CADENCE: readonly CommunityKind[] = [
  "fear",
  "myth_bust",
  "win",
];

/** Sort a post's drafts into posting order. */
export function sortCommunityByCadence<T extends { kind: CommunityKind }>(
  items: T[]
): T[] {
  return [...items].sort(
    (a, b) =>
      COMMUNITY_CADENCE.indexOf(a.kind) - COMMUNITY_CADENCE.indexOf(b.kind)
  );
}

export function mapCommunityPost(raw: unknown): CommunityPost | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const id = typeof r.id === "string" ? r.id : String(r.id ?? "");
  const kind = KINDS.find((k) => k === r.kind);
  // Without an id there is nothing to update or delete, and an unknown kind
  // cannot be placed in the cadence — drop rather than render something broken.
  if (!id || !kind) return null;
  const flags = Array.isArray(r.flags)
    ? r.flags.filter(
        (f): f is CommunityFlag => f === "construct" || f === "verify"
      )
    : [];
  const str = (v: unknown) => (typeof v === "string" ? v : "");
  return {
    id,
    journalPostId: str(r.journal_post_id),
    kind,
    label: str(r.label),
    day: str(r.day),
    title: str(r.title),
    body: str(r.body),
    charCount:
      typeof r.char_count === "number" && Number.isFinite(r.char_count)
        ? r.char_count
        : str(r.body).length,
    flags,
    pillarId:
      typeof r.pillar_id === "number" && Number.isFinite(r.pillar_id)
        ? r.pillar_id
        : null,
    pillarName: str(r.pillar_name),
    theme: str(r.theme),
    softCtaLine: str(r.soft_cta_line),
    appProofLine: str(r.app_proof_line),
    generatedAt: typeof r.generated_at === "string" ? r.generated_at : null,
    updatedAt: typeof r.updated_at === "string" ? r.updated_at : null,
  };
}

function mapCommunityList(data: unknown): CommunityPost[] {
  const d = (data ?? {}) as Record<string, unknown>;
  const rows = Array.isArray(d.items) ? d.items : Array.isArray(data) ? data : [];
  return (rows as unknown[])
    .map(mapCommunityPost)
    .filter((p): p is CommunityPost => p !== null);
}

/** Derive the community formats from a post. Returns the post's FULL current
 *  set, not only what was regenerated, so a single-format reroll still yields
 *  the whole batch. Slow (10-25s): the caller must show progress. */
export function adminGenerateCommunity(
  password: string,
  postId: string,
  opts?: { formats?: CommunityKind[]; notes?: string }
) {
  const payload: Record<string, unknown> = { post_id: postId };
  if (opts?.formats && opts.formats.length > 0) payload.formats = opts.formats;
  if (opts?.notes && opts.notes.trim()) payload.notes = opts.notes.trim();
  return post("community/generate", password, payload, mapCommunityList);
}

/** One post's drafts, or every draft when postId is omitted (CMS boot). */
export function adminListCommunity(password: string, postId?: string) {
  return post(
    "community/list",
    password,
    postId ? { post_id: postId } : {},
    mapCommunityList
  );
}

/** Only title/body are writable. Editing clears the flags server-side — they
 *  exist to make the founder look at the draft, and he just has. */
export function adminUpdateCommunity(
  password: string,
  id: string,
  changes: { title?: string; body?: string }
) {
  return post("community/update", password, { id, ...changes }, (d) => {
    const row = (d as Record<string, unknown>)?.item ?? d;
    return mapCommunityPost(row);
  });
}

export function adminDeleteCommunity(password: string, id: string) {
  return post("community/delete", password, { id }, () => true);
}

/** Push the public pages out of the ISR cache after a change, so a published
 *  post is live immediately instead of up to a full revalidate window later
 *  (and without the first visitor after expiry still getting the stale page).
 *  Best-effort: publishing already succeeded, so a failure here is not an
 *  error the author needs to act on. */
export async function adminRevalidate(
  password: string,
  slug?: string | null
): Promise<void> {
  const paths = slug ? ["/blog", `/blog/${slug}`] : ["/blog"];
  try {
    await fetch("/api/v2/internal/journal/revalidate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password, paths }),
    });
  } catch {
    /* non-fatal: the page still refreshes on its own revalidate window */
  }
}

/* -------------------------------------------------------------------------- */
/*  Generated cover images                                                     */
/*                                                                            */
/*  A second way to fill `cover_image_url`, alongside the manual presign +     */
/*  upload path below, which stays. The model reads the post, writes a brief,  */
/*  draws it, and the file lands in the same R2 bucket an uploaded cover uses. */
/*                                                                            */
/*  Every attempt is kept server-side, which is what makes Regenerate safe:    */
/*  the strip is the undo. CMS-ONLY — no public route may read these           */
/*  candidates; the public site sees only cover_image_url / cover_alt on the   */
/*  post itself.                                                              */
/* -------------------------------------------------------------------------- */

/** Why a generated attempt needs a human eye. Never a reason to hide it —
 *  `construct` means the retired score vocabulary reached the brief or the alt
 *  text, and the founder rewords or rerolls. Same warn-never-withhold rule as
 *  the community drafts' flags. */
export type CoverImageFlag = "construct";

export interface CoverImage {
  id: string;
  journalPostId: string;
  imageUrl: string;
  altText: string;
  /** The brief the model was given. Shown collapsed, so an odd cover can be
   *  understood rather than guessed at. */
  prompt: string;
  /** What the image model says it actually drew. "" for most. */
  revisedPrompt: string;
  /** The steer that produced THIS attempt. */
  notes: string;
  parentImageId: string | null;
  flags: CoverImageFlag[];
  model: string | null;
  size: string | null;
  quality: string | null;
  createdAt: string | null;
}

/** Where the brief came from. "fallback" = the text model failed and the
 *  backend drew from a deterministic title+excerpt brief instead: a worse
 *  image, but a working button, and worth saying so. */
export type BriefSource = "model" | "fallback";

export interface GenerateCoverResult {
  /** The attempt just drawn. */
  image: CoverImage | null;
  /** The WHOLE strip, newest first. Comes back on every generate, so the
   *  caller re-renders from this and never fires a second list call. */
  items: CoverImage[];
  /** The updated post, or null when `attach` was false. */
  post: AdminJournalPost | null;
  attached: boolean;
  briefSource: BriefSource;
  /** Set ONLY when the image drew and stored but could not be written onto the
   *  post. The image is real and paid for: show it, warn, and let a click on
   *  the thumbnail retry the attach via select. Never discard it. */
  attachError: string | null;
}

const COVER_FLAGS: CoverImageFlag[] = ["construct"];

export function mapCoverImage(raw: unknown): CoverImage | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const id = typeof r.id === "string" ? r.id : String(r.id ?? "");
  const str = (v: unknown) => (typeof v === "string" ? v : "");
  const imageUrl = str(r.image_url);
  // Without an id there is nothing to select or delete, and without a URL there
  // is nothing to show — drop rather than render a broken thumbnail.
  if (!id || !imageUrl) return null;
  const nullableStr = (v: unknown) => (typeof v === "string" && v ? v : null);
  return {
    id,
    journalPostId: str(r.journal_post_id),
    imageUrl,
    altText: str(r.alt_text),
    prompt: str(r.prompt),
    revisedPrompt: str(r.revised_prompt),
    notes: str(r.notes),
    parentImageId: nullableStr(r.parent_image_id),
    flags: Array.isArray(r.flags)
      ? r.flags.filter((f): f is CoverImageFlag =>
          COVER_FLAGS.includes(f as CoverImageFlag)
        )
      : [],
    model: nullableStr(r.model),
    size: nullableStr(r.size),
    quality: nullableStr(r.quality),
    createdAt: nullableStr(r.created_at),
  };
}

function mapCoverList(data: unknown): CoverImage[] {
  const d = (data ?? {}) as Record<string, unknown>;
  const rows = Array.isArray(d.items) ? d.items : Array.isArray(data) ? data : [];
  return (rows as unknown[])
    .map(mapCoverImage)
    .filter((i): i is CoverImage => i !== null);
}

/** Draw a cover for a post. SLOW (10-30s) — the caller must show progress.
 *  `attach` defaults to true server-side, so the drawn image becomes the
 *  post's cover and its alt text; the response carries the updated post. */
export function adminGenerateCoverImage(
  password: string,
  opts: {
    postId: string;
    /** The steer for THIS attempt, applied to the PREVIOUS brief rather than
     *  to the essay from scratch. Empty deliberately draws a different scene:
     *  never substitute a hidden "make it different" note. */
    notes?: string;
    /** Refine a specific earlier attempt instead of the newest. */
    parentId?: string;
    /** Ignore history and brief from the essay alone. */
    fresh?: boolean;
    /** Default true — write the result onto the post's cover. */
    attach?: boolean;
  }
) {
  const payload: Record<string, unknown> = { post_id: opts.postId };
  if (opts.notes && opts.notes.trim()) payload.notes = opts.notes.trim();
  if (opts.parentId) payload.parent_id = opts.parentId;
  if (opts.fresh) payload.fresh = true;
  if (opts.attach === false) payload.attach = false;
  return post(
    "image/generate",
    password,
    payload,
    (d): GenerateCoverResult => {
      const r = (d ?? {}) as Record<string, unknown>;
      return {
        image: mapCoverImage(r.image),
        items: mapCoverList(d),
        post: r.post ? mapAdminPost(r.post) : null,
        attached: r.attached !== false,
        briefSource: r.brief_source === "fallback" ? "fallback" : "model",
        attachError:
          typeof r.attach_error === "string" && r.attach_error.trim()
            ? r.attach_error
            : null,
      };
    }
  );
}

/** Every attempt for a post, newest first. */
export function adminListCoverImages(password: string, postId: string) {
  return post("image/list", password, { post_id: postId }, mapCoverList);
}

/** Promote an earlier attempt onto the post's cover. The undo for Regenerate,
 *  and the retry when a draw stored its image but failed to attach it. */
export function adminSelectCoverImage(password: string, imageId: string) {
  return post("image/select", password, { image_id: imageId }, (d) => {
    const r = (d ?? {}) as Record<string, unknown>;
    return {
      post: r.post ? mapAdminPost(r.post) : null,
      image: mapCoverImage(r.image),
    };
  });
}

/** Clear a candidate from the strip. The stored file stays, so a post still
 *  pointing at that URL does not break. */
export function adminDeleteCoverImage(password: string, imageId: string) {
  return post("image/delete", password, { image_id: imageId }, () => true);
}

export interface PresignResult {
  uploadUrl: string;
  publicUrl: string;
  /** Extra form fields for a POST-policy upload; absent = plain PUT. */
  fields: Record<string, string> | null;
}

export function adminPresign(
  password: string,
  file: { filename: string; contentType: string; kind: JournalCoverKind }
) {
  return post(
    "media/presign",
    password,
    {
      filename: file.filename,
      content_type: file.contentType,
      kind: file.kind,
    },
    (d): PresignResult | null => {
      const r = (d ?? {}) as Record<string, unknown>;
      const uploadUrl = typeof r.upload_url === "string" ? r.upload_url : "";
      const publicUrl = typeof r.public_url === "string" ? r.public_url : "";
      if (!uploadUrl || !publicUrl) return null;
      const fields =
        r.fields && typeof r.fields === "object"
          ? (r.fields as Record<string, string>)
          : null;
      return { uploadUrl, publicUrl, fields };
    }
  );
}

/** Upload the file straight to storage. NEVER routed through the BFF: Vercel's
 *  ~4.5MB serverless body limit 413s real media (the app already hit this on
 *  audio). Supports both presign shapes: POST-policy (fields) and plain PUT. */
export async function uploadToStorage(
  presign: PresignResult,
  file: File
): Promise<boolean> {
  try {
    if (presign.fields) {
      const form = new FormData();
      for (const [k, v] of Object.entries(presign.fields)) form.append(k, v);
      form.append("file", file);
      const res = await fetch(presign.uploadUrl, { method: "POST", body: form });
      return res.ok;
    }
    const res = await fetch(presign.uploadUrl, {
      method: "PUT",
      headers: { "Content-Type": file.type || "application/octet-stream" },
      body: file,
    });
    return res.ok;
  } catch {
    return false;
  }
}
