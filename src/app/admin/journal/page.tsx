"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
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
  adminListPosts,
  adminPresign,
  adminReorder,
  adminSetPublished,
  adminUpdatePost,
  uploadToStorage,
  type AdminJournalPost,
  type JournalPostDraft,
} from "@/services/api/journalAdmin";

/* -------------------------------------------------------------------------- */
/*  /admin/journal — the Journal CMS                                           */
/*                                                                            */
/*  NOT linked in any nav, NOT under (protected), and NOT role-gated: auth is   */
/*  the shared admin password checked on the BACKEND (it rides in each request  */
/*  body), the same pattern as /admin/credits. The password is held in state    */
/*  and mirrored to sessionStorage only — never localStorage, so it dies with   */
/*  the tab.                                                                    */
/*                                                                            */
/*  Two semantics that are deliberately independent:                            */
/*    - Publish / Unpublish  = VISIBILITY (does it appear publicly)             */
/*    - Published date       = the DISPLAY date (so a post can be backdated)    */
/*                                                                            */
/*  The body is PLAIN TEXT (blank line = new paragraph). No rich text, no       */
/*  inline media, no HTML.                                                     */
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
  // Snapshot of the editor as last loaded/saved. Anything different is unsaved
  // work, so leaving the editor has to ask first (losing a written post to a
  // stray click is the worst thing this tool could do).
  const [savedSnapshot, setSavedSnapshot] = useState<string>("");

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

  async function save() {
    if (!editing || busy) return;
    setBusy("save");
    setError(null);
    const { id, ...draft } = editing;
    const r = id
      ? await adminUpdatePost(password, id, draft)
      : await adminCreatePost(password, draft);
    setBusy(null);
    if (!r.ok) {
      setError(r.message);
      return;
    }
    if (r.data) {
      adopt(r.data);
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
      } else {
        setError(
          "Saved, but this post could not be re-identified. Reopen it from the list before editing again."
        );
        return;
      }
    } else {
      // Updated with no echo: what's on screen is what we just sent.
      setSavedSnapshot(JSON.stringify(editing));
    }
    await load(password);
    flash("Saved.");
  }

  async function togglePublished() {
    if (!editing?.id || busy) return;
    const next = editingStatus !== "published";
    setBusy("publish");
    setError(null);
    const r = await adminSetPublished(password, editing.id, next);
    setBusy(null);
    if (!r.ok) {
      setError(r.message);
      return;
    }
    // Publishing changes VISIBILITY only. Merge just the status (and a
    // server-assigned date when the post had none) — adopting the whole echo
    // would silently throw away whatever is unsaved in the editor.
    setEditingStatus(r.data?.status ?? (next ? "published" : "draft"));
    if (r.data?.publishedAt && !editing.published_at) {
      setEditing((prev) =>
        prev ? { ...prev, published_at: r.data!.publishedAt } : prev
      );
    }
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
              href="/journal"
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
                  <div
                    key={p.id}
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
                          href={`/journal/${p.slug}`}
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
                      disabled={!editing.id || busy !== null}
                      title={
                        editing.id
                          ? undefined
                          : "Save the draft before publishing it."
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
                        /journal/
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

                  {/* 7 — body (plain text) */}
                  <div>
                    <label className={LABEL_CLS} htmlFor="j-body">
                      Body, separate paragraphs with a blank line
                    </label>
                    <textarea
                      id="j-body"
                      value={editing.body}
                      onChange={(e) => patch({ body: e.target.value })}
                      rows={18}
                      className={`${INPUT_CLS} resize-y text-[15px] leading-[1.75]`}
                    />
                  </div>
                </div>
              </>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
