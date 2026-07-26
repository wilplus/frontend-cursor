"use client";

import { useEffect, useRef, useState } from "react";
import { Loader2 } from "lucide-react";
import {
  adminDeleteCommunity,
  adminGenerateCommunity,
  adminUpdateCommunity,
  sortCommunityByCadence,
  type CommunityFlag,
  type CommunityKind,
  type CommunityPost,
} from "@/services/api/journalAdmin";

/* -------------------------------------------------------------------------- */
/*  Community Content Studio — section 8 of the CMS editor                     */
/*                                                                            */
/*  The journal post being edited IS format ① Technique; this derives the      */
/*  three other community formats from it. They are NOT journal posts and can   */
/*  never become one, so this surface carries no publish control, no preview    */
/*  link and no reorder — the omission is the point.                           */
/*                                                                            */
/*  The founder copies each draft by hand into Skool, so Copy is the primary   */
/*  verb throughout.                                                           */
/* -------------------------------------------------------------------------- */

const FLAG_COPY: Record<CommunityFlag, string> = {
  construct: "uses retired score vocabulary, reword before posting",
  verify: "contains a claim that isn't in your post, check before posting",
};

const BTN_PRIMARY =
  "inline-flex items-center gap-1.5 rounded-full bg-foreground px-3.5 py-1.5 text-xs font-medium text-background transition hover:bg-foreground/90 disabled:opacity-40";
const BTN_GHOST =
  "inline-flex items-center gap-1.5 rounded-full border border-border bg-background px-3.5 py-1.5 text-xs text-muted-foreground transition hover:text-foreground disabled:opacity-40";
const LABEL_CLS =
  "mb-1.5 block text-[11px] uppercase tracking-[0.14em] text-muted-foreground";
const INPUT_CLS =
  "w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground transition focus:border-foreground/30 focus:outline-none";

/** Copy-to-clipboard with a short confirmation. */
function useCopy() {
  const [copied, setCopied] = useState<string | null>(null);
  const timer = useRef<number | null>(null);
  useEffect(
    () => () => {
      if (timer.current) window.clearTimeout(timer.current);
    },
    []
  );
  async function copy(key: string, text: string) {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      return; // clipboard blocked; nothing useful to say
    }
    setCopied(key);
    if (timer.current) window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setCopied(null), 2000);
  }
  return { copied, copy };
}

export default function CommunitySection({
  password,
  postId,
  postBody,
  items,
  onItemsChanged,
  focusItemId,
  onFocusHandled,
}: {
  password: string;
  /** null while the post is unsaved — there is nothing to generate against. */
  postId: string | null;
  postBody: string;
  items: CommunityPost[];
  onItemsChanged: (postId: string, items: CommunityPost[]) => void;
  /** Set when the queue was clicked: scroll to and briefly highlight a card. */
  focusItemId?: string | null;
  onFocusHandled?: () => void;
}) {
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<{ title: string; body: string }>({
    title: "",
    body: "",
  });
  const { copied, copy } = useCopy();
  const cardRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const [flashId, setFlashId] = useState<string | null>(null);

  // Queue click: bring the card into view and flash it, so the two ways into
  // the same draft feel like one surface.
  useEffect(() => {
    if (!focusItemId) return;
    const el = cardRefs.current[focusItemId];
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "center" });
      setFlashId(focusItemId);
      const t = window.setTimeout(() => setFlashId(null), 1600);
      onFocusHandled?.();
      return () => window.clearTimeout(t);
    }
    onFocusHandled?.();
  }, [focusItemId, items, onFocusHandled]);

  const ordered = sortCommunityByCadence(items);
  // Batch-level fields are identical across the three, so read them off any one.
  const batch = ordered[0] ?? null;
  const canGenerate = !!postId && postBody.trim().length > 0;
  const disabledReason = !postId
    ? "Save the post before writing its community drafts."
    : postBody.trim().length === 0
      ? "Write the post body first, the drafts are derived from it."
      : undefined;

  async function generate(formats?: CommunityKind[]) {
    if (!postId || busy) return;
    // Regenerating overwrites drafts the founder may have edited by hand.
    const isRerollAll = !formats && ordered.length > 0;
    if (
      isRerollAll &&
      !window.confirm(
        "Rewrite all three community drafts? Any edits you made to them are lost."
      )
    ) {
      return;
    }
    setBusy(formats ? `gen:${formats[0]}` : "gen:all");
    setError(null);
    const r = await adminGenerateCommunity(password, postId, { formats });
    setBusy(null);
    if (!r.ok) {
      setError(r.message);
      return;
    }
    onItemsChanged(postId, r.data);
  }

  async function saveEdit(item: CommunityPost) {
    if (busy) return;
    setBusy(`save:${item.id}`);
    setError(null);
    const r = await adminUpdateCommunity(password, item.id, {
      title: draft.title,
      body: draft.body,
    });
    setBusy(null);
    if (!r.ok) {
      setError(r.message);
      return;
    }
    // Editing clears the flags server-side, so adopt the echo rather than
    // patching locally and leaving a stale warning on screen.
    const updated = r.data;
    onItemsChanged(
      item.journalPostId,
      items.map((it) => (it.id === item.id ? (updated ?? it) : it))
    );
    setEditingId(null);
  }

  async function remove(item: CommunityPost) {
    if (busy) return;
    if (!window.confirm(`Delete the ${item.label} draft? This cannot be undone.`))
      return;
    setBusy(`del:${item.id}`);
    setError(null);
    const r = await adminDeleteCommunity(password, item.id);
    setBusy(null);
    if (!r.ok) {
      setError(r.message);
      return;
    }
    onItemsChanged(
      item.journalPostId,
      items.filter((it) => it.id !== item.id)
    );
  }

  const generatingAll = busy === "gen:all";

  return (
    <div className="border-t border-border pt-6">
      <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-[13px] font-semibold text-foreground">
          Community posts
        </h3>
        {batch && (batch.pillarName || batch.theme) ? (
          <span className="text-[11px] text-muted-foreground">
            {[batch.pillarName, batch.theme].filter(Boolean).join(" · ")}
          </span>
        ) : null}
      </div>
      <p className="mb-4 text-[12px] text-muted-foreground">
        Drafts for the community. They are never published here, you copy each
        one across by hand.
      </p>

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => void generate()}
          disabled={!canGenerate || busy !== null}
          title={disabledReason}
          className={BTN_PRIMARY}
        >
          {generatingAll ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
          ) : null}
          {generatingAll
            ? "Writing three posts, about 20 seconds…"
            : ordered.length > 0
              ? "Regenerate all"
              : "Generate community posts"}
        </button>

        {/* Format ① Technique is the post itself, taken straight from the
            editor. No API call, and nothing to regenerate. */}
        <button
          type="button"
          onClick={() => void copy("technique", postBody)}
          disabled={postBody.trim().length === 0}
          title="Format 1, the post itself"
          className={BTN_GHOST}
        >
          {copied === "technique" ? "Copied ✓" : "Copy post body"}
        </button>
      </div>

      {error ? (
        <p className="mb-4 text-[12px] text-destructive">{error}</p>
      ) : null}

      {ordered.length === 0 ? (
        <p className="text-[12px] text-muted-foreground">
          Nothing yet.
        </p>
      ) : (
        <div className="flex flex-col gap-4">
          {ordered.map((item) => {
            const isEditing = editingId === item.id;
            return (
              <div
                key={item.id}
                ref={(el) => {
                  cardRefs.current[item.id] = el;
                }}
                className={`rounded-2xl border bg-background p-4 transition-colors ${
                  flashId === item.id
                    ? "border-foreground/40 bg-muted/60"
                    : "border-border"
                }`}
              >
                <div className="mb-2 flex flex-wrap items-center gap-2">
                  <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] uppercase tracking-wider text-muted-foreground">
                    {item.day}
                  </span>
                  <span className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
                    {item.label}
                  </span>
                  <span className="ml-auto text-[11px] tabular-nums text-muted-foreground">
                    {item.charCount} chars
                  </span>
                </div>

                {/* Flags warn, they never withhold the draft. */}
                {item.flags.length > 0 ? (
                  <ul className="mb-3 flex flex-col gap-1">
                    {item.flags.map((f) => (
                      <li
                        key={f}
                        className="rounded-lg bg-amber-100 px-2.5 py-1.5 text-[11px] text-amber-800"
                      >
                        {FLAG_COPY[f]}
                      </li>
                    ))}
                  </ul>
                ) : null}

                {isEditing ? (
                  <div className="flex flex-col gap-3">
                    <div>
                      <label className={LABEL_CLS}>Title</label>
                      <input
                        value={draft.title}
                        onChange={(e) =>
                          setDraft((d) => ({ ...d, title: e.target.value }))
                        }
                        className={INPUT_CLS}
                      />
                    </div>
                    <div>
                      <label className={LABEL_CLS}>Body</label>
                      <textarea
                        value={draft.body}
                        onChange={(e) =>
                          setDraft((d) => ({ ...d, body: e.target.value }))
                        }
                        rows={12}
                        className={`${INPUT_CLS} resize-y text-[14px] leading-[1.7]`}
                      />
                    </div>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => void saveEdit(item)}
                        disabled={busy !== null}
                        className={BTN_PRIMARY}
                      >
                        Save
                      </button>
                      <button
                        type="button"
                        onClick={() => setEditingId(null)}
                        className={BTN_GHOST}
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    <p className="mb-2 text-[14px] font-semibold text-foreground">
                      {item.title}
                    </p>
                    <p className="whitespace-pre-wrap text-[13px] leading-[1.7] text-foreground/90">
                      {item.body}
                    </p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => void copy(item.id, item.body)}
                        className={BTN_GHOST}
                      >
                        {copied === item.id ? "Copied ✓" : "Copy"}
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setEditingId(item.id);
                          setDraft({ title: item.title, body: item.body });
                        }}
                        disabled={busy !== null}
                        className={BTN_GHOST}
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => void generate([item.kind])}
                        disabled={busy !== null}
                        className={BTN_GHOST}
                      >
                        {busy === `gen:${item.kind}` ? (
                          <Loader2
                            className="h-3.5 w-3.5 animate-spin"
                            aria-hidden
                          />
                        ) : null}
                        {busy === `gen:${item.kind}`
                          ? "Rewriting…"
                          : "Regenerate"}
                      </button>
                      <button
                        type="button"
                        onClick={() => void remove(item)}
                        disabled={busy !== null}
                        className={BTN_GHOST}
                      >
                        Delete
                      </button>
                    </div>
                  </>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Opt-in lines. Batch-level, so they sit under the set rather than in
          any one card. */}
      {batch && (batch.appProofLine || batch.softCtaLine) ? (
        <div className="mt-5 flex flex-col gap-3">
          {batch.appProofLine ? (
            <OptInLine
              text={batch.appProofLine}
              when="Append to the Technique post every other week or so."
              copied={copied === "app-proof"}
              onCopy={() => void copy("app-proof", batch.appProofLine)}
            />
          ) : null}
          {/* Only pillar 6 batches carry a soft CTA. */}
          {batch.softCtaLine ? (
            <OptInLine
              text={batch.softCtaLine}
              when="Only for this pillar, use it once."
              copied={copied === "soft-cta"}
              onCopy={() => void copy("soft-cta", batch.softCtaLine)}
            />
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function OptInLine({
  text,
  when,
  copied,
  onCopy,
}: {
  text: string;
  when: string;
  copied: boolean;
  onCopy: () => void;
}) {
  return (
    <div className="rounded-xl border border-border bg-muted/40 p-3">
      <p className="text-[13px] leading-relaxed text-foreground">{text}</p>
      <div className="mt-2 flex items-center gap-3">
        <button type="button" onClick={onCopy} className={BTN_GHOST}>
          {copied ? "Copied ✓" : "Copy"}
        </button>
        <span className="text-[11px] text-muted-foreground">{when}</span>
      </div>
    </div>
  );
}
