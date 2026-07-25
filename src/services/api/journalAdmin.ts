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
  | { ok: false; status: number; message: string };

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
  if (!res.ok) return { ok: false, status: res.status, message: readError(data, res.status) };
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
