"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import CommunitySection from "./CommunitySection";
import CoverImageStudio from "./CoverImageStudio";
import BodyBlocks from "@/components/journal/BodyBlocks";
import {
  ArrowDown,
  ArrowUp,
  Eye,
  Loader2,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import {
  JOURNAL_CATEGORIES,
  slugify,
  sortJournalPosts,
  type JournalCategory,
  type JournalCoverKind,
} from "@/services/api/journal";
import {
  adminCreatePost,
  adminDeletePost,
  adminGetPost,
  adminListPosts,
  adminPresign,
  adminReorder,
  adminListCommunity,
  sortCommunityByCadence,
  adminRevalidate,
  type CommunityPost,
  adminSetPublished,
  adminUpdatePost,
  uploadToStorage,
  type AdminJournalPost,
  type JournalPostDraft,
} from "@/services/api/journalAdmin";

/* -------------------------------------------------------------------------- */
/*  /cms — the Journal CMS                                           */
/*                                                                            */
/*  NOT linked in any nav, NOT under (protected), and NOT role-gated: auth is   */
/*  the shared admin password checked on the BACKEND (it rides in each request  */
/*  body), the established internal-tool pattern. The password is held in state    */
/*  and mirrored to sessionStorage only — never localStorage, so it dies with   */
/*  the tab.                                                                    */
/*                                                                            */
/*  Two semantics that are deliberately independent:                            */
/*    - Publish / Unpublish  = VISIBILITY (does it appear publicly)             */
/*    - Published date       = the DISPLAY date (so a post can be backdated)    */
/*                                                                            */
/*  The body is PLAIN TEXT (blank line = new paragraph). No rich text, no       */
/*  HTML — with ONE founder-approved extension: two line-level media tokens,    */
/*  `[image: url | alt]` and `[file: url | label]` (the BODY TOKEN SPEC in      */
/*  services/api/journal.ts). The body textarea accepts dropped/pasted images:  */
/*  they are downscaled client-side, uploaded via the same presign flow as      */
/*  covers, and inserted as an [image: …] token line.                           */
/* -------------------------------------------------------------------------- */

const PW_KEY = "willpower.journal.pw";

const LABEL_CLS =
  "mb-1.5 block text-[11px] uppercase tracking-[0.14em] text-muted-foreground";
const INPUT_CLS =
  "w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground transition focus:border-foreground/30 focus:outline-none";
const BTN_PRIMARY =
  "inline-flex items-center gap-1.5 rounded-full bg-foreground px-3.5 py-1.5 text-xs font-medium text-background transition hover:bg-foreground/90 disabled:opacity-40";
const BTN_GHOST =
  "inline-flex items-center gap-1.5 rounded-full border border-border bg-background px-3.5 py-1.5 text-xs text-muted-foreground transition hover:text-foreground disabled:opacity-40";
const BTN_ICON =
  "rounded-lg border border-border p-2 text-muted-foreground transition hover:text-foreground disabled:opacity-40";

const COVER_KINDS: ReadonlyArray<{ key: JournalCoverKind; label: string }> = [
  { key: "image", label: "Image" },
  { key: "video", label: "Video" },
  { key: "audio", label: "Audio" },
];

/** The editor's working copy of a post. */
type Editable = JournalPostDraft & { id: string | null };

function blankDraft(): Editable {
  return {
    id: null,
    // A new draft needs a unique placeholder slug so two unsaved drafts can't
    // collide; the author renames it with "from title".
    slug: `draft-${Math.random().toString(36).slice(2, 8)}`,
    title: "",
    excerpt: "",
    category: "others",
    read_time_min: null,
    cover_kind: "image",
    cover_image_url: null,
    cover_alt: null,
    media_url: null,
    media_duration_sec: null,
    body: "",
    author_name: "Willpower Lab",
    published_at: null,
  };
}

function toEditable(p: AdminJournalPost): Editable {
  return {
    id: p.id,
    slug: p.slug,
    title: p.title,
    excerpt: p.excerpt,
    category: p.category,
    read_time_min: p.readTimeMin,
    cover_kind: p.coverKind,
    cover_image_url: p.coverImageUrl,
    cover_alt: p.coverAlt,
    media_url: p.mediaUrl,
    media_duration_sec: p.mediaDurationSec,
    body: p.body,
    author_name: p.authorName,
    published_at: p.publishedAt,
  };
}

/** ISO timestamp -> the yyyy-mm-dd a <input type="date"> needs. */
function dateInputValue(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toISOString().slice(0, 10);
}

/* ----------------------- body image upload helpers ------------------------ */

/** Max width for an inline body image. 1200px covers the 680px content
 *  column on a 2x display with headroom; anything larger only costs bytes. */
const BODY_IMAGE_MAX_WIDTH = 1200;

/** Alt-text guess from a filename: "breathing-drill_01.jpg" → "breathing
 *  drill 01". Token delimiters are stripped so the guess can never break the
 *  `[image: url | alt]` line it lands in. */
function altFromFilename(name: string): string {
  return name
    .replace(/\.[a-z0-9]+$/i, "")
    .replace(/[[\]|]/g, " ")
    .replace(/[-_]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Swap a filename's extension to match the re-encoded format. */
function withExt(name: string, ext: string): string {
  return name.replace(/\.[a-z0-9]+$/i, "") + ext;
}

/** Downscale a body image client-side: max width 1200px (aspect kept),
 *  exported as webp q0.85 with a jpeg fallback for browsers that can't
 *  encode webp. GIFs pass through untouched — a canvas re-encode would keep
 *  one frame and silently kill the animation. If decoding fails (exotic
 *  format), the original file is returned and the presign allowlist decides. */
async function prepareBodyImage(
  file: File
): Promise<{ file: File; contentType: string }> {
  if (file.type === "image/gif") {
    return { file, contentType: "image/gif" };
  }
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, BODY_IMAGE_MAX_WIDTH / bitmap.width);
    const w = Math.max(1, Math.round(bitmap.width * scale));
    const h = Math.max(1, Math.round(bitmap.height * scale));
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("no 2d context");
    ctx.drawImage(bitmap, 0, 0, w, h);
    bitmap.close();
    const encode = (type: string) =>
      new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, type, 0.85));
    // toBlob silently falls back to PNG when it can't encode the requested
    // type, so the REAL type of the result decides, not the request.
    let blob = await encode("image/webp");
    if (blob && blob.type === "image/webp") {
      return {
        file: new File([blob], withExt(file.name, ".webp"), {
          type: "image/webp",
        }),
        contentType: "image/webp",
      };
    }
    blob = await encode("image/jpeg");
    if (blob && blob.type === "image/jpeg") {
      return {
        file: new File([blob], withExt(file.name, ".jpg"), {
          type: "image/jpeg",
        }),
        contentType: "image/jpeg",
      };
    }
    throw new Error("encode failed");
  } catch {
    // Undecodable/unencodable here — hand the original to the presign, whose
    // MIME allowlist gives the author a real error instead of a silent drop.
    return { file, contentType: file.type || "application/octet-stream" };
  }
}

/** Insert `line` into `body` at character index `at`, on its own line (the
 *  token spec is line-level). Adds only the newlines actually missing. */
function insertLineIntoBody(body: string, at: number, line: string): string {
  const i = Math.max(0, Math.min(at, body.length));
  const before = body.slice(0, i);
  const after = body.slice(i);
  const prefix = before === "" || before.endsWith("\n") ? "" : "\n";
  const suffix = after === "" || after.startsWith("\n") ? "" : "\n";
  return before + prefix + line + suffix + after;
}

/** Remove a placeholder line again (failed upload), healing the newlines the
 *  insert added so the author isn't left with stray blank lines. */
function removeLineFromBody(body: string, line: string): string {
  return body
    .replace(line + "\n", "")
    .replace(line, "")
    .replace(/\n{3,}/g, "\n\n");
}

/** Map a drop point to a caret index in the textarea where the browser can
 *  (Firefox reports the textarea itself as the offset node). Null = unknown;
 *  the caller falls back to the current caret. */
function dropCaretIndex(
  e: React.DragEvent,
  textarea: HTMLTextAreaElement
): number | null {
  const doc = document as Document & {
    caretPositionFromPoint?: (
      x: number,
      y: number
    ) => { offsetNode: Node; offset: number } | null;
  };
  const pos = doc.caretPositionFromPoint?.(e.clientX, e.clientY);
  return pos && pos.offsetNode === textarea ? pos.offset : null;
}

function StatusPill({ status }: { status: "draft" | "published" }) {
  // Semantic emerald/amber: these signal state in an internal tool, not brand.
  return (
    <span
      className={`rounded-full px-2 py-0.5 text-[10px] uppercase tracking-wider ${
        status === "published"
          ? "bg-emerald-100 text-emerald-800"
          : "bg-amber-100 text-amber-800"
      }`}
    >
      {status}
    </span>
  );
}

export default function JournalAdminPage() {
  const [password, setPassword] = useState("");
  const [unlocked, setUnlocked] = useState(false);
  const [posts, setPosts] = useState<AdminJournalPost[]>([]);
  const [editing, setEditing] = useState<Editable | null>(null);
  const [editingStatus, setEditingStatus] = useState<"draft" | "published">(
    "draft"
  );
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);
  const bodyRef = useRef<HTMLTextAreaElement | null>(null);
  // Body image uploads: a sequence for unique placeholders, a counter for the
  // spinner (several drops can be in flight at once), drag highlight, and the
  // collapsible preview.
  const bodyUploadSeq = useRef(0);
  const [bodyUploads, setBodyUploads] = useState(0);
  const [bodyDragOver, setBodyDragOver] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  // Snapshot of the editor as last loaded/saved. Anything different is unsaved
  // work, so leaving the editor has to ask first (losing a written post to a
  // stray click is the worst thing this tool could do).
  const [savedSnapshot, setSavedSnapshot] = useState<string>("");
  // Every community draft, loaded once on unlock and grouped by parent post.
  const [community, setCommunity] = useState<CommunityPost[]>([]);
  const [focusItemId, setFocusItemId] = useState<string | null>(null);

  const isDirty = editing !== null && JSON.stringify(editing) !== savedSnapshot;

  /** Open a post / new draft / close, guarding unsaved work. */
  function openEditor(next: Editable | null, status: "draft" | "published") {
    if (
      isDirty &&
      !window.confirm("You have unsaved changes. Discard them?")
    ) {
      return;
    }
    setEditing(next);
    setEditingStatus(status);
    setSavedSnapshot(next ? JSON.stringify(next) : "");
  }

  /** Adopt a server echo as the new clean baseline. */
  function adopt(post: AdminJournalPost) {
    const next = toEditable(post);
    setEditing(next);
    setEditingStatus(post.status);
    setSavedSnapshot(JSON.stringify(next));
  }

  /** Take ONLY the cover fields from a server echo, and move the clean
   *  baseline for those two fields with them.
   *
   *  Deliberately not `adopt`: a draw writes the cover server-side while the
   *  founder may have unsaved title/body edits in the editor, and adopting the
   *  whole post would silently overwrite them with the stored version. Moving
   *  the snapshot in step keeps `isDirty` honest — the cover genuinely IS
   *  saved, so it must not read as an unsaved change, while any other edit
   *  still does. */
  const adoptCoverFields = useCallback((post: AdminJournalPost) => {
    const cover = {
      cover_image_url: post.coverImageUrl,
      cover_alt: post.coverAlt,
    };
    setEditing((prev) => (prev ? { ...prev, ...cover } : prev));
    setSavedSnapshot((snap) => {
      if (!snap) return snap;
      try {
        return JSON.stringify({ ...(JSON.parse(snap) as Editable), ...cover });
      } catch {
        return snap;
      }
    });
  }, []);

  // Restore the password for this tab only (sessionStorage, never localStorage).
  useEffect(() => {
    try {
      const saved = window.sessionStorage.getItem(PW_KEY);
      if (saved) setPassword(saved);
    } catch {
      /* ignore */
    }
  }, []);

  /** Refetch the list. `keepError` lets a failed caller resync WITHOUT wiping
   *  the message it just set (otherwise the error never reaches the screen). */
  const load = useCallback(
    async (pw: string, keepError = false) => {
      setBusy("load");
      if (!keepError) setError(null);
      const r = await adminListPosts(pw);
      setBusy(null);
      if (!r.ok) {
        setError(r.message);
        return false;
      }
      // Display in CURATED order, which is the order reorder writes back. The
      // admin list endpoint doesn't pin an order, so without this the arrows
      // would stamp sort_order across every post from whatever order the
      // server happened to return (e.g. created_at), silently destroying a
      // hand-tuned order that also drives the public "Curated" sort.
      setPosts(sortJournalPosts(r.data, "curated"));
      // Community drafts ride along on the same refresh. Best-effort: they
      // are a side panel, never a reason to fail opening the CMS.
      const c = await adminListCommunity(pw);
      if (c.ok) setCommunity(c.data);
      return true;
    },
    []
  );

  async function unlock() {
    if (!password.trim() || busy) return;
    const ok = await load(password);
    if (!ok) return;
    setUnlocked(true);
    try {
      window.sessionStorage.setItem(PW_KEY, password);
    } catch {
      /* ignore */
    }
  }

  function flash(msg: string) {
    setNotice(msg);
    window.setTimeout(() => setNotice(null), 2500);
  }

  /* ------------------------------ mutations ------------------------------ */

  /** Save the editor. Returns the post's server id, so a caller that needs one
   *  (Publish) can save first and act on the result instead of giving up. */
  async function save(): Promise<string | null> {
    if (!editing || busy) return null;
    setBusy("save");
    setError(null);
    const { id, ...draft } = editing;
    const r = id
      ? await adminUpdatePost(password, id, draft)
      : await adminCreatePost(password, draft);
    setBusy(null);
    if (!r.ok) {
      setError(r.message);
      return null;
    }
    let savedId: string | null = id;
    if (r.data) {
      adopt(r.data);
      savedId = r.data.id;
    } else if (!id) {
      // Created, but the echo carried no usable id. Without adopting one, the
      // NEXT save would create a second post — so recover the id from the list
      // by slug rather than risk a duplicate.
      const listed = await adminListPosts(password);
      const match = listed.ok
        ? listed.data.find((p) => p.slug === draft.slug)
        : undefined;
      if (match) {
        adopt(match);
        savedId = match.id;
      } else {
        setError(
          "Saved, but this post could not be re-identified. Reopen it from the list before editing again."
        );
        return null;
      }
    } else {
      // Updated with no echo: what's on screen is what we just sent.
      setSavedSnapshot(JSON.stringify(editing));
    }
    await adminRevalidate(password, editing.slug);
    await load(password);
    flash("Saved.");
    return savedId;
  }

  async function togglePublished() {
    if (busy) return;
    if (!editing) return;
    const next = editingStatus !== "published";

    // Publishing must never be a dead click. The id can be missing for two
    // reasons — the draft was never saved, or a create echo did not carry one
    // — and previously both left the button inert with no request and no
    // message, which reads exactly like "publishing is broken". Resolve an id
    // instead: take the editor's, else the saved row with this slug, else save
    // the draft first, which is what the click meant anyway.
    let id = editing.id;
    if (!id) {
      id = posts.find((p) => p.slug === editing.slug)?.id ?? null;
    }
    if (!id) {
      id = await save();
      if (!id) return; // save() already surfaced why
    }

    setBusy("publish");
    setError(null);
    const r = await adminSetPublished(password, id, next);
    setBusy(null);
    if (!r.ok) {
      setError(r.message);
      return;
    }
    // Publishing changes VISIBILITY only. Merge just the status (and a
    // server-assigned date when the post had none) — adopting the whole echo
    // would silently throw away whatever is unsaved in the editor.
    setEditingStatus(r.data?.status ?? (next ? "published" : "draft"));
    let serverDate = r.data?.publishedAt ?? null;
    if (!r.data) {
      // No echo: the backend may have stamped published_at itself. Read it back
      // rather than leave the editor holding null, because the next Save PUTs
      // the whole draft and would overwrite the server's date with it.
      const fresh = await adminGetPost(password, id);
      if (fresh.ok && fresh.data) serverDate = fresh.data.publishedAt;
    }
    if (serverDate && !editing.published_at) {
      setEditing((prev) =>
        prev ? { ...prev, published_at: serverDate } : prev
      );
    }
    await adminRevalidate(password, editing.slug);
    await load(password);
    flash(next ? "Published." : "Moved back to draft.");
  }

  async function remove(post: AdminJournalPost) {
    if (busy) return;
    const label = post.title.trim() || post.slug;
    if (!window.confirm(`Delete "${label}"? This cannot be undone.`)) return;
    setBusy(`del-${post.id}`);
    setError(null);
    const r = await adminDeletePost(password, post.id);
    setBusy(null);
    if (!r.ok) {
      setError(r.message);
      return;
    }
    if (editing?.id === post.id) {
      setEditing(null);
      setSavedSnapshot("");
    }
    await adminRevalidate(password, post.slug);
    await load(password);
    flash("Deleted.");
  }

  async function move(index: number, dir: -1 | 1) {
    const next = index + dir;
    if (busy || next < 0 || next >= posts.length) return;
    const reordered = [...posts];
    const [row] = reordered.splice(index, 1);
    reordered.splice(next, 0, row);
    // Optimistic, and restamp sortOrder to match the new positions — that is
    // exactly what the backend assigns from the array, so local state stays
    // coherent with the server without a second round trip.
    setPosts(reordered.map((p, idx) => ({ ...p, sortOrder: idx })));
    setBusy("reorder");
    const r = await adminReorder(
      password,
      reordered.map((p) => p.id)
    );
    setBusy(null);
    if (!r.ok) {
      setError(r.message);
      await load(password, true); // resync, but keep the message on screen
    }
  }

  async function pickFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || !editing || busy) return;
    // Pin the target at call time: an upload that resolves after the author
    // switched posts (or changed the media kind) must not write its URL into
    // whatever happens to be open then.
    const targetId = editing.id;
    const targetKind = editing.cover_kind;
    setBusy("upload");
    setError(null);
    const signed = await adminPresign(password, {
      filename: file.name,
      contentType: file.type || "application/octet-stream",
      kind: targetKind,
    });
    if (!signed.ok || !signed.data) {
      setBusy(null);
      setError(signed.ok ? "Upload could not be prepared." : signed.message);
      return;
    }
    const uploaded = await uploadToStorage(signed.data, file);
    const publicUrl = signed.data.publicUrl;
    setBusy(null);
    if (!uploaded) {
      setError("Upload failed. Try again, or paste a URL instead.");
      return;
    }
    let applied = false;
    setEditing((prev) => {
      if (!prev || prev.id !== targetId || prev.cover_kind !== targetKind) {
        return prev; // moved on — drop the result rather than corrupt the post
      }
      applied = true;
      // An image upload is the cover; video/audio uploads are the media file.
      return targetKind === "image"
        ? { ...prev, cover_image_url: publicUrl }
        : { ...prev, media_url: publicUrl };
    });
    flash(
      applied
        ? "Uploaded."
        : "Upload finished, but the editor had moved on. Paste the URL if you still want it."
    );
  }

  /** Upload ONE dropped/pasted image and insert its `[image: …]` token line.
   *
   *  A unique `[image: uploading-N | alt]` placeholder goes in immediately at
   *  the drop/caret position and is swapped for the real token when the
   *  upload lands (or removed again on failure, with the error surfaced in
   *  the same red box every other CMS failure uses). Deliberately NOT gated
   *  on the global `busy`: the author keeps typing while the bytes move, and
   *  the placeholder swap is a string replace, so concurrent edits are safe. */
  async function addBodyImage(file: File, at: number | null) {
    if (!editing) return;
    const alt = altFromFilename(file.name);
    const placeholder = `[image: uploading-${++bodyUploadSeq.current} | ${alt}]`;
    setEditing((prev) => {
      if (!prev) return prev;
      const idx = at ?? bodyRef.current?.selectionEnd ?? prev.body.length;
      return { ...prev, body: insertLineIntoBody(prev.body, idx, placeholder) };
    });
    setBodyUploads((n) => n + 1);
    const fail = (msg: string) => {
      setEditing((prev) =>
        prev ? { ...prev, body: removeLineFromBody(prev.body, placeholder) } : prev
      );
      setError(msg);
    };
    try {
      const prepared = await prepareBodyImage(file);
      const signed = await adminPresign(password, {
        filename: prepared.file.name,
        contentType: prepared.contentType,
        kind: "image",
      });
      if (!signed.ok || !signed.data) {
        fail(
          signed.ok ? "Image upload could not be prepared." : signed.message
        );
        return;
      }
      const uploaded = await uploadToStorage(signed.data, prepared.file);
      if (!uploaded) {
        fail(
          "Image upload failed. Try again, or type an [image: url | alt] line with a hosted URL."
        );
        return;
      }
      const token = `[image: ${signed.data.publicUrl} | ${alt}]`;
      let swapped = false;
      setEditing((prev) => {
        if (!prev || !prev.body.includes(placeholder)) return prev;
        swapped = true;
        return { ...prev, body: prev.body.replace(placeholder, token) };
      });
      flash(
        swapped
          ? "Image added to the body."
          : "Upload finished, but the editor had moved on."
      );
    } finally {
      setBodyUploads((n) => Math.max(0, n - 1));
    }
  }

  /** Fan a dropped/pasted file list into sequential uploads. Only the first
   *  insert uses the drop point — the following ones land at the caret the
   *  previous insert left, which keeps a multi-file drop in order. */
  async function addBodyImages(files: File[], at: number | null) {
    const images = files.filter((f) => f.type.startsWith("image/"));
    if (images.length === 0 || !editing) return;
    for (const file of images) {
      await addBodyImage(file, at);
      at = null;
    }
  }

  /* -------------------------------- render ------------------------------- */

  const patch = (p: Partial<Editable>) =>
    setEditing((prev) => (prev ? { ...prev, ...p } : prev));

  const mediaUrlValue = useMemo(() => {
    if (!editing) return "";
    return editing.cover_kind === "image"
      ? editing.cover_image_url ?? ""
      : editing.media_url ?? "";
  }, [editing]);

  if (!unlocked) {
    return (
      <main className="mx-auto max-w-sm px-6 py-24">
        <h1 className="text-lg font-semibold tracking-tight">Journal CMS</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Enter the admin password to continue.
        </p>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") void unlock();
          }}
          placeholder="Admin password"
          aria-label="Admin password"
          autoComplete="off"
          className={`${INPUT_CLS} mt-5`}
          autoFocus
        />
        <button
          type="button"
          onClick={() => void unlock()}
          disabled={!password.trim() || busy !== null}
          className={`${BTN_PRIMARY} mt-3 w-full justify-center py-2`}
        >
          {busy === "load" ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
          ) : null}
          Unlock
        </button>
        {error ? (
          <p className="mt-3 text-xs text-destructive">{error}</p>
        ) : null}
      </main>
    );
  }

  return (
    <div className="min-h-full bg-muted/40">
      <div className="sticky top-0 z-20 border-b border-border bg-background/85 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-3">
          <div className="flex items-center gap-3">
            <Link
              href="/blog"
              className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground no-underline transition hover:text-foreground"
            >
              ← Journal
            </Link>
            <span className="text-sm font-semibold tracking-tight">CMS</span>
          </div>
          <div className="flex items-center gap-2">
            {notice ? (
              <span className="text-xs text-muted-foreground">{notice}</span>
            ) : null}
            <button
              type="button"
              onClick={() => void load(password)}
              disabled={busy !== null}
              className={BTN_GHOST}
            >
              Refresh
            </button>
            <button
              type="button"
              onClick={() => openEditor(blankDraft(), "draft")}
              className={BTN_PRIMARY}
            >
              + New draft
            </button>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-6xl px-6 py-6">
        {error ? (
          <p className="mb-4 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs text-destructive">
            {error}
          </p>
        ) : null}

        <div className="grid gap-6 lg:grid-cols-[1fr_1.4fr]">
          {/* ------------------------------ list ------------------------------ */}
          <section className="rounded-2xl border border-border bg-background">
            <p className="border-b border-border px-4 py-3 text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
              Posts · {posts.length}
            </p>
            <div className="divide-y divide-border">
              {posts.length === 0 ? (
                <p className="px-4 py-6 text-sm text-muted-foreground">
                  No posts yet. Start a new draft.
                </p>
              ) : (
                posts.map((p, i) => (
                  <div key={p.id}>
                  <div
                    className={`flex items-start gap-3 px-4 py-3 ${
                      editing?.id === p.id ? "bg-muted/60" : ""
                    }`}
                  >
                    <div className="flex flex-col gap-1 pt-0.5">
                      <button
                        type="button"
                        onClick={() => void move(i, -1)}
                        disabled={i === 0 || busy !== null}
                        aria-label="Move up"
                        className="text-muted-foreground transition hover:text-foreground disabled:opacity-30"
                      >
                        <ArrowUp className="h-3.5 w-3.5" aria-hidden />
                      </button>
                      <button
                        type="button"
                        onClick={() => void move(i, 1)}
                        disabled={i === posts.length - 1 || busy !== null}
                        aria-label="Move down"
                        className="text-muted-foreground transition hover:text-foreground disabled:opacity-30"
                      >
                        <ArrowDown className="h-3.5 w-3.5" aria-hidden />
                      </button>
                    </div>

                    <button
                      type="button"
                      onClick={() => openEditor(toEditable(p), p.status)}
                      disabled={busy !== null}
                      className="min-w-0 flex-1 text-left disabled:opacity-60"
                    >
                      <span className="flex flex-wrap items-center gap-2">
                        <StatusPill status={p.status} />
                        <span className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
                          {p.category.replace(/_/g, " ")}
                        </span>
                        {p.coverKind !== "image" ? (
                          <span className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
                            {p.coverKind}
                          </span>
                        ) : null}
                      </span>
                      <span className="mt-1 block truncate text-sm font-medium text-foreground">
                        {p.title.trim() || "Untitled"}
                      </span>
                    </button>

                    <div className="flex shrink-0 items-center gap-1">
                      {/* The public route only serves published posts, so a
                          draft's preview would 404. Show the affordance as
                          unavailable rather than linking into a dead end. */}
                      {p.status === "published" ? (
                        <Link
                          href={`/blog/${p.slug}`}
                          target="_blank"
                          aria-label={`Preview ${p.title || p.slug}`}
                          className={BTN_ICON}
                        >
                          <Eye className="h-3.5 w-3.5" aria-hidden />
                        </Link>
                      ) : (
                        <span
                          title="Publish this post to view it on the site."
                          aria-label="Preview unavailable until published"
                          className={`${BTN_ICON} inline-block cursor-not-allowed opacity-40`}
                        >
                          <Eye className="h-3.5 w-3.5" aria-hidden />
                        </span>
                      )}
                      <button
                        type="button"
                        onClick={() => void remove(p)}
                        disabled={busy !== null}
                        aria-label="Delete"
                        className={BTN_ICON}
                      >
                        <Trash2 className="h-3.5 w-3.5" aria-hidden />
                      </button>
                    </div>
                  </div>

                  {/* This post's community drafts, indented beneath it. They
                      are NOT publishable, so they carry no reorder, no preview
                      and no publish control — the omission is the signal. */}
                  {sortCommunityByCadence(
                    community.filter((c) => c.journalPostId === p.id)
                  )
                    .map((c) => (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => {
                          openEditor(toEditable(p), p.status);
                          setFocusItemId(c.id);
                        }}
                        className="flex w-full items-center gap-2 py-1.5 pl-10 pr-4 text-left transition hover:bg-muted/40"
                      >
                        <span className="rounded-full bg-indigo-100 px-2 py-0.5 text-[9px] uppercase tracking-wider text-indigo-800">
                          Community
                        </span>
                        <span className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
                          {c.label}
                        </span>
                        <span className="truncate text-[12px] text-foreground/80">
                          {c.title}
                        </span>
                      </button>
                    ))}
                  </div>
                ))
              )}
            </div>
          </section>

          {/* ----------------------------- editor ----------------------------- */}
          <section className="rounded-2xl border border-border bg-background">
            {!editing ? (
              <p className="px-4 py-6 text-sm text-muted-foreground">
                Pick a post to edit, or start a new draft.
              </p>
            ) : (
              <>
                <div className="flex items-center justify-between border-b border-border px-4 py-3">
                  <div className="flex items-center gap-2">
                    <StatusPill status={editingStatus} />
                    {isDirty ? (
                      <span className="text-[11px] text-muted-foreground">
                        Unsaved changes
                      </span>
                    ) : null}
                    <button
                      type="button"
                      onClick={() => void togglePublished()}
                      disabled={busy !== null}
                      title={
                        editing.id
                          ? undefined
                          : "This saves the draft first, then publishes it."
                      }
                      className={BTN_GHOST}
                    >
                      {editingStatus === "published" ? "Unpublish" : "Publish"}
                    </button>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => openEditor(null, "draft")}
                      className={BTN_ICON}
                      aria-label="Close editor"
                    >
                      <X className="h-3.5 w-3.5" aria-hidden />
                    </button>
                    <button
                      type="button"
                      onClick={() => void save()}
                      disabled={busy !== null}
                      className={BTN_PRIMARY}
                    >
                      {busy === "save" ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
                      ) : null}
                      Save
                    </button>
                  </div>
                </div>

                <div className="space-y-5 px-4 py-5">
                  {/* 1 — cover media */}
                  <div>
                    <span className={LABEL_CLS}>Cover media</span>
                    <div className="mb-3 flex flex-wrap gap-2">
                      {COVER_KINDS.map((k) => {
                        const active = editing.cover_kind === k.key;
                        return (
                          <button
                            key={k.key}
                            type="button"
                            onClick={() => patch({ cover_kind: k.key })}
                            aria-pressed={active}
                            className={`rounded-full px-3.5 py-1.5 text-xs transition ${
                              active
                                ? "border border-foreground bg-foreground text-background"
                                : "border border-border text-muted-foreground hover:border-foreground/40 hover:text-foreground"
                            }`}
                          >
                            {k.label}
                          </button>
                        );
                      })}
                    </div>

                    <div className="mb-3 flex aspect-[4/3] items-center justify-center overflow-hidden rounded-2xl bg-muted">
                      {editing.cover_kind === "image" &&
                      editing.cover_image_url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={editing.cover_image_url}
                          alt={editing.cover_alt ?? ""}
                          className="h-full w-full object-cover"
                        />
                      ) : editing.cover_kind !== "image" && editing.media_url ? (
                        <p className="px-4 text-center text-xs text-muted-foreground">
                          {editing.cover_kind} attached
                        </p>
                      ) : (
                        <p className="text-xs text-muted-foreground">
                          No {editing.cover_kind} yet
                        </p>
                      )}
                    </div>

                    <div className="flex flex-col gap-2 sm:flex-row">
                      <input
                        value={mediaUrlValue}
                        onChange={(e) => {
                          const v = e.target.value.trim() || null;
                          patch(
                            editing.cover_kind === "image"
                              ? { cover_image_url: v }
                              : { media_url: v }
                          );
                        }}
                        placeholder="Paste a URL, or upload"
                        aria-label={`${editing.cover_kind} URL`}
                        className={INPUT_CLS}
                      />
                      <input
                        ref={fileRef}
                        type="file"
                        className="hidden"
                        onChange={pickFile}
                        accept={
                          editing.cover_kind === "image"
                            ? "image/*"
                            : editing.cover_kind === "video"
                              ? "video/*"
                              : "audio/*"
                        }
                      />
                      <button
                        type="button"
                        onClick={() => fileRef.current?.click()}
                        disabled={busy !== null}
                        className={`${BTN_GHOST} shrink-0 justify-center`}
                      >
                        {busy === "upload" ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
                        ) : (
                          <Upload className="h-3.5 w-3.5" aria-hidden />
                        )}
                        Upload
                      </button>
                    </div>

                    {/* Video keeps a poster image alongside its file; audio can
                        carry a cover image too (without one the card falls back
                        to the waveform). Either way the field must stay
                        reachable, or a previously-set image is stranded. */}
                    {editing.cover_kind !== "image" ? (
                      <input
                        value={editing.cover_image_url ?? ""}
                        onChange={(e) =>
                          patch({
                            cover_image_url: e.target.value.trim() || null,
                          })
                        }
                        placeholder={
                          editing.cover_kind === "video"
                            ? "Poster image URL (optional)"
                            : "Cover image URL (optional, else a waveform shows)"
                        }
                        aria-label="Cover image URL"
                        className={`${INPUT_CLS} mt-2`}
                      />
                    ) : null}

                    <input
                      value={editing.cover_alt ?? ""}
                      onChange={(e) =>
                        patch({ cover_alt: e.target.value || null })
                      }
                      placeholder="Alt text"
                      aria-label="Alt text"
                      className={`${INPUT_CLS} mt-2`}
                    />

                    {/* Generated covers. Fills the SAME cover_image_url the
                        upload above fills, so the preview needs no changes and
                        stays visible while a draw is in flight. */}
                    <CoverImageStudio
                      password={password}
                      postId={editing.id}
                      postTitle={editing.title}
                      postBody={editing.body}
                      currentImageUrl={editing.cover_image_url}
                      onCoverChanged={adoptCoverFields}
                    />
                  </div>

                  {/* 2 — title */}
                  <div>
                    <label className={LABEL_CLS} htmlFor="j-title">
                      Title
                    </label>
                    <input
                      id="j-title"
                      value={editing.title}
                      onChange={(e) => patch({ title: e.target.value })}
                      className={`${INPUT_CLS} text-base font-semibold tracking-tight`}
                    />
                  </div>

                  {/* 3 — slug */}
                  <div>
                    <label className={LABEL_CLS} htmlFor="j-slug">
                      Slug (URL)
                    </label>
                    <div className="flex items-center gap-2">
                      <span className="shrink-0 text-xs text-muted-foreground">
                        /blog/
                      </span>
                      <input
                        id="j-slug"
                        value={editing.slug}
                        onChange={(e) =>
                          patch({ slug: slugify(e.target.value) })
                        }
                        className={INPUT_CLS}
                      />
                      <button
                        type="button"
                        onClick={() => patch({ slug: slugify(editing.title) })}
                        disabled={!editing.title.trim()}
                        className={`${BTN_GHOST} shrink-0`}
                      >
                        from title
                      </button>
                    </div>
                  </div>

                  {/* 4 — category + author */}
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div>
                      <label className={LABEL_CLS} htmlFor="j-cat">
                        Category
                      </label>
                      <select
                        id="j-cat"
                        value={editing.category}
                        onChange={(e) =>
                          patch({
                            category: e.target.value as JournalCategory,
                          })
                        }
                        className={INPUT_CLS}
                      >
                        {JOURNAL_CATEGORIES.map((c) => (
                          <option key={c.key} value={c.key}>
                            {c.label}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className={LABEL_CLS} htmlFor="j-author">
                        Author
                      </label>
                      <input
                        id="j-author"
                        value={editing.author_name}
                        onChange={(e) => patch({ author_name: e.target.value })}
                        className={INPUT_CLS}
                      />
                    </div>
                  </div>

                  {/* 5 — published date + read minutes */}
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div>
                      <label className={LABEL_CLS} htmlFor="j-date">
                        Published date
                      </label>
                      <input
                        id="j-date"
                        type="date"
                        value={dateInputValue(editing.published_at)}
                        onChange={(e) =>
                          patch({
                            published_at: e.target.value
                              ? new Date(`${e.target.value}T00:00:00Z`).toISOString()
                              : null,
                          })
                        }
                        className={INPUT_CLS}
                      />
                      <p className="mt-1 text-[11px] text-muted-foreground">
                        The date shown on the post. Publishing is separate.
                      </p>
                    </div>
                    <div>
                      <label className={LABEL_CLS} htmlFor="j-read">
                        Read minutes
                      </label>
                      <input
                        id="j-read"
                        type="number"
                        min={1}
                        value={editing.read_time_min ?? ""}
                        onChange={(e) =>
                          patch({
                            read_time_min: e.target.value
                              ? Number(e.target.value)
                              : null,
                          })
                        }
                        className={INPUT_CLS}
                      />
                    </div>
                  </div>

                  {/* 6 — excerpt */}
                  <div>
                    <label className={LABEL_CLS} htmlFor="j-excerpt">
                      Excerpt
                    </label>
                    <textarea
                      id="j-excerpt"
                      value={editing.excerpt}
                      onChange={(e) => patch({ excerpt: e.target.value })}
                      rows={3}
                      className={`${INPUT_CLS} resize-y`}
                    />
                  </div>

                  {/* 7 — body (plain text + media token lines) */}
                  <div>
                    <label className={LABEL_CLS} htmlFor="j-body">
                      <span className="inline-flex items-center gap-1.5">
                        Body, separate paragraphs with a blank line
                        {bodyUploads > 0 ? (
                          <Loader2
                            className="h-3 w-3 animate-spin"
                            aria-label="Uploading image"
                          />
                        ) : null}
                      </span>
                    </label>
                    <textarea
                      id="j-body"
                      ref={bodyRef}
                      value={editing.body}
                      onChange={(e) => patch({ body: e.target.value })}
                      // Drag/drop + paste of image files. dragover MUST
                      // preventDefault or the browser navigates to the file;
                      // the highlight tells the author the drop will land.
                      onDragOver={(e) => {
                        if (e.dataTransfer.types.includes("Files")) {
                          e.preventDefault();
                          setBodyDragOver(true);
                        }
                      }}
                      onDragLeave={() => setBodyDragOver(false)}
                      onDrop={(e) => {
                        if (!e.dataTransfer.types.includes("Files")) return;
                        e.preventDefault();
                        setBodyDragOver(false);
                        const at = dropCaretIndex(e, e.currentTarget);
                        void addBodyImages(Array.from(e.dataTransfer.files), at);
                      }}
                      onPaste={(e) => {
                        const files = Array.from(
                          e.clipboardData?.files ?? []
                        ).filter((f) => f.type.startsWith("image/"));
                        if (files.length === 0) return; // plain text pastes as usual
                        e.preventDefault();
                        void addBodyImages(files, e.currentTarget.selectionEnd);
                      }}
                      rows={18}
                      className={`${INPUT_CLS} resize-y text-[15px] leading-[1.75] ${
                        bodyDragOver
                          ? "border-foreground/60 ring-2 ring-foreground/10"
                          : ""
                      }`}
                    />
                    <p className="mt-1 text-[11px] text-muted-foreground">
                      Drop or paste an image to upload and insert it. On its
                      own line, <code>[image: url | alt text]</code> renders a
                      centered image and <code>[file: url | label]</code> a
                      download row; anything else stays plain text.
                    </p>

                    {/* Live preview — the SAME BodyBlocks the public post
                        renders, so what the founder sees here is what ships. */}
                    <button
                      type="button"
                      onClick={() => setPreviewOpen((o) => !o)}
                      aria-expanded={previewOpen}
                      className={`${BTN_GHOST} mt-2`}
                    >
                      <Eye className="h-3.5 w-3.5" aria-hidden />
                      {previewOpen ? "Hide preview" : "Preview"}
                    </button>
                    {previewOpen ? (
                      <div className="mt-2 space-y-6 rounded-xl border border-border bg-background p-4">
                        {editing.body.trim() ? (
                          <BodyBlocks body={editing.body} />
                        ) : (
                          <p className="text-xs text-muted-foreground">
                            Nothing to preview yet.
                          </p>
                        )}
                      </div>
                    ) : null}
                  </div>

                  {/* 8 — community drafts derived from this post. Sits under
                      the body because the body is what they are made from. */}
                  <CommunitySection
                    password={password}
                    postId={editing.id}
                    postBody={editing.body}
                    items={community.filter(
                      (c) => c.journalPostId === editing.id
                    )}
                    onItemsChanged={(postId, next) =>
                      setCommunity((prev) => [
                        ...prev.filter((c) => c.journalPostId !== postId),
                        ...next,
                      ])
                    }
                    focusItemId={focusItemId}
                    onFocusHandled={() => setFocusItemId(null)}
                  />
                </div>
              </>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
