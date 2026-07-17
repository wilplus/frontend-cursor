"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Check, Copy, PencilLine, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import OverlayCloseButton from "./OverlayCloseButton";
import LoadingState from "./LoadingState";
import PaywallPanel from "./PaywallPanel";
import FeedbackOverlay from "./FeedbackOverlay";
import { useBackDismiss } from "./useBackDismiss";
import { RichText } from "./RichText";
import {
  fetchIdealText,
  saveIdealNotes,
  saveIdealUserEdit,
  segmentIdealText,
  type IdealKeyMomentLink,
  type IdealText,
  type InstantPaywall,
} from "@/services/api/idealText";
import {
  fetchMomentExplanation,
  unlockMoments,
  type MomentExplanationResult,
} from "@/services/api/momentExplanation";

/* -------------------------------------------------------------------------- */
/*  IdealTextOverlay — the user's ideal-text NOTEBOOK (delivery layer)         */
/*                                                                            */
/*  The purple bubble's destination: the coach-approved one-block ideal text   */
/*  in a big, clean reading view. Bolded openings (coach key phrases),         */
/*  underlined key moments — tapping one asks "Go to this moment?" and         */
/*  deep-links into the feedback page anchored at that moment. Copy + Edit;    */
/*  edits save to the user's PERSONAL copy (never the coach canonical — L1).   */
/*  Paywalled: locked (402) renders the unlock panel; pending = coach still    */
/*  working.                                                                   */
/* -------------------------------------------------------------------------- */

export default function IdealTextOverlay({
  arcId,
  onClose,
  onReadAloud,
}: {
  arcId: string;
  onClose: () => void;
  /** SD — "Read it aloud": the host closes this overlay into the record flow
   *  for this presentation (a re-read is just another recording). Receives the
   *  current version as a take-count hint for the arc seed. Optional: without
   *  it the CTA hides. */
  onReadAloud?: (version: number | null) => void;
}) {
  // D-3 invariant — the device Back gesture closes THIS overlay (LIFO with the
  // nested FeedbackOverlay, which pushes its own entry on top).
  useBackDismiss(onClose);
  const [status, setStatus] = useState<
    "loading" | "ready" | "instant" | "locked" | "pending" | "error"
  >("loading");
  const [ideal, setIdeal] = useState<IdealText | null>(null);
  // Instant lane — the payload's paywall figures for the upsell CTA.
  const [instantPaywall, setInstantPaywall] = useState<InstantPaywall | null>(
    null
  );
  // The user unlocked from THIS overlay (or the payload says they're already
  // entitled). The BE serves variant:"instant" for any unapproved arc, paid or
  // not — so after a successful unlock the refetch lands back on instant and,
  // without this flag, would re-show a "Buy" CTA for an arc the user just
  // bought (review R-i1). Unlocked → the upsell swaps to a confirmation.
  const [unlocked, setUnlocked] = useState(false);
  // The last instant draft, kept so a post-unlock refetch that maps to
  // "pending" (a BE serving instant strictly to unpaid arcs) doesn't make the
  // text the user was just reading vanish behind a bare pending line (R-i2).
  const lastInstantRef = useRef<{
    ideal: IdealText;
    paywall: InstantPaywall;
  } | null>(null);
  const unlockedRef = useRef(false);
  const [refetchNonce, setRefetchNonce] = useState(0);
  // SD (single-deliverable) — the living-document state: verification status,
  // version, and whether the 5-credit moments unlock has run.
  const [sd, setSd] = useState<{
    status: "unverified" | "verified";
    version: number | null;
    momentsUnlocked: boolean;
    priceCredits: number | null;
  } | null>(null);
  // SD — the open key-moment overlay: which moment, and its fetched content.
  const [momentOpen, setMomentOpen] = useState<IdealKeyMomentLink | null>(null);
  const [momentContent, setMomentContent] =
    useState<MomentExplanationResult | null>(null);

  // A different arc = a fresh entitlement question; never carry the unlocked
  // flag or a cached draft across arcs.
  useEffect(() => {
    unlockedRef.current = false;
    lastInstantRef.current = null;
    setUnlocked(false);
  }, [arcId]);

  // Notebook state: the personal copy wins for display once saved.
  const [notes, setNotes] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [copied, setCopied] = useState(false);

  // The tapped key moment awaiting "Go to this moment?" confirmation.
  const [momentAsk, setMomentAsk] = useState<IdealKeyMomentLink | null>(null);
  // The open feedback deep-link (stacked over this overlay).
  const [feedbackTarget, setFeedbackTarget] =
    useState<IdealKeyMomentLink | null>(null);

  useEffect(() => {
    let active = true;
    setStatus("loading");
    void fetchIdealText(arcId).then((r) => {
      if (!active) return;
      if (r.kind === "single") {
        // SD — the ONE living text: both statuses free to read; the only paid
        // thing is opening the key moments. Renders through the ready view
        // with the SD chrome (status chip, read-aloud CTA, moment behavior).
        setIdeal(r.ideal);
        setNotes(null);
        setSd({
          status: r.status,
          version: r.version,
          momentsUnlocked: r.momentsUnlocked,
          priceCredits: r.priceCredits,
        });
        setStatus("ready");
      } else if (r.kind === "ready") {
        setIdeal(r.ideal);
        setNotes(r.ideal.notes);
        setStatus("ready");
      } else if (r.kind === "instant") {
        // The free machine draft — same reading view, plus the polishing
        // banner + upsell; no personal-notes editing (perfected-lane feature).
        setIdeal(r.ideal);
        setNotes(null);
        setInstantPaywall(r.paywall);
        lastInstantRef.current = { ideal: r.ideal, paywall: r.paywall };
        if (r.entitled) {
          unlockedRef.current = true;
          setUnlocked(true);
        }
        setStatus("instant");
      } else if (
        r.kind === "pending" &&
        unlockedRef.current &&
        lastInstantRef.current
      ) {
        // R-i2 — the user just unlocked and the BE stopped serving the instant
        // draft (a strictly-unpaid instant lane). Keep showing the draft they
        // were reading, with the unlocked confirmation, instead of swapping
        // paid-for content for a bare pending line.
        setIdeal(lastInstantRef.current.ideal);
        setNotes(null);
        setInstantPaywall(lastInstantRef.current.paywall);
        setStatus("instant");
      } else {
        setStatus(r.kind);
      }
    });
    return () => {
      active = false;
    };
  }, [arcId, refetchNonce]);

  const displayText = notes ?? ideal?.text ?? "";

  // Staleness guard for the moment-explanation fetches: a slow response for a
  // closed/replaced sheet must never overwrite the currently open one (R-sd3).
  const momentReqRef = useRef(0);

  async function loadMomentContent(m: IdealKeyMomentLink) {
    const req = ++momentReqRef.current;
    setMomentContent(null);
    const r = await fetchMomentExplanation(arcId, m.momentId ?? m.snippetId);
    if (momentReqRef.current === req) setMomentContent(r);
  }

  // SD — a tapped moment opens the explanation overlay (or the unlock prompt);
  // legacy mode keeps the "Go to this moment?" feedback deep-link. A legacy
  // moment with no snippet link stays inert (it has nowhere to deep-link;
  // rendering it tappable would open an unanchored feedback page — R-sd4).
  async function openMoment(m: IdealKeyMomentLink) {
    if (!sd) {
      if (!m.snippetId) return;
      setMomentAsk(m);
      return;
    }
    setMomentOpen(m);
    if (!sd.momentsUnlocked) {
      momentReqRef.current++;
      setMomentContent({ kind: "locked", priceCredits: sd.priceCredits });
      return;
    }
    await loadMomentContent(m);
  }

  async function buyMoments(): Promise<string | null> {
    const r = await unlockMoments(arcId);
    if (r.ok) {
      setSd((prev) => (prev ? { ...prev, momentsUnlocked: true } : prev));
      if (momentOpen) await loadMomentContent(momentOpen);
      return null;
    }
    if (r.reason === "insufficient") {
      // Top-ups live on the pricing page (hard navigation — the documented
      // forward-nav trap with stacked overlays' back-dismiss cleanup).
      window.location.assign("/dashboard/pricing");
      return null;
    }
    return r.message;
  }

  function copyText() {
    void navigator.clipboard?.writeText(displayText).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    });
  }

  return (
    <div className="fixed inset-0 z-40 flex flex-col bg-background">
      <div className="flex shrink-0 items-center justify-between border-b border-border bg-muted/70 px-4 py-2.5 backdrop-blur">
        <span className="text-[13px] font-medium text-foreground">
          Your ideal text
        </span>
        <div className="flex items-center gap-1.5">
          {(status === "ready" || status === "instant") && !editing ? (
            <button
              type="button"
              onClick={copyText}
              aria-label={copied ? "Copied" : "Copy the text"}
              className="flex h-8 w-8 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              {copied ? (
                <Check className="h-4 w-4 text-success" aria-hidden />
              ) : (
                <Copy className="h-4 w-4" aria-hidden />
              )}
            </button>
          ) : null}
          {/* Personal-notes editing is a legacy perfected-lane feature — no
              pencil on the instant draft or in the SD living document. */}
          {status === "ready" && !editing ? (
            <button
              type="button"
              onClick={() => setEditing(true)}
              aria-label="Edit your copy"
              className="flex h-8 w-8 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              <PencilLine className="h-4 w-4" aria-hidden />
            </button>
          ) : null}
          <OverlayCloseButton onClick={onClose} />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto flex min-h-full w-full max-w-2xl flex-col px-5 py-8">
          {status === "loading" ? (
            <LoadingState />
          ) : status === "locked" ? (
            <PaywallPanel
              arcId={arcId}
              onUnlocked={() => setRefetchNonce((n) => n + 1)}
            />
          ) : status === "pending" ? (
            <p className="py-16 text-center text-[15px] leading-relaxed text-muted-foreground">
              Your coach is still shaping your ideal text. It lands here the
              moment it&apos;s approved.
            </p>
          ) : status === "error" ? (
            <p className="py-16 text-center text-[15px] leading-relaxed text-muted-foreground">
              Couldn&apos;t load your ideal text. Try again in a moment.
            </p>
          ) : status === "instant" && ideal ? (
            <div className="flex flex-col gap-5">
              {/* The persistent instant banner — this text is a DRAFT the
                  machine assembled; the coach-perfected version replaces it
                  on this same screen once approved + unlocked. */}
              <div className="flex items-center gap-2 rounded-xl border border-primary/30 bg-primary/5 px-4 py-3">
                <Sparkles className="h-4 w-4 shrink-0 text-primary" aria-hidden />
                <p className="text-[13px] leading-relaxed text-foreground">
                  Instant draft. Your coach is polishing the full version.
                </p>
              </div>
              <NotebookText
                text={displayText}
                ideal={ideal}
                onMomentTap={setMomentAsk}
              />
              {/* The upsell — same unlock seam as the hard paywall, with the
                  payload's figures and instant-specific lead copy. Once
                  unlocked (here, or already entitled per the payload), the Buy
                  CTA must never re-show for this arc: the perfected text just
                  isn't approved yet, which is the coach's timeline, not a
                  payment problem (review R-i1). */}
              {unlocked ? (
                <div className="flex items-center gap-2 rounded-2xl border border-success/40 bg-success/5 px-4 py-3">
                  <Check className="h-4 w-4 shrink-0 text-success" aria-hidden />
                  <p className="text-[13px] leading-relaxed text-foreground">
                    Full analysis unlocked. The coach-perfected version lands
                    here as soon as your coach approves it.
                  </p>
                </div>
              ) : (
                <div className="rounded-2xl border border-border bg-card">
                  <PaywallPanel
                    arcId={arcId}
                    onUnlocked={() => {
                      unlockedRef.current = true;
                      setUnlocked(true);
                      setRefetchNonce((n) => n + 1);
                    }}
                    lead="Want the coach-perfected version? Unlock the full analysis."
                    priceCredits={instantPaywall?.priceCredits ?? null}
                    creditsCurrent={instantPaywall?.creditsCurrent ?? null}
                  />
                </div>
              )}
            </div>
          ) : editing && ideal ? (
            <NotebookEditor
              arcId={arcId}
              initial={displayText}
              // #214 — SD edits persist through the user-edit PUT (the
              // student's edit always wins; supersede retried inside the
              // service). Legacy mode keeps the personal-notes PUT.
              save={
                sd
                  ? async (t: string) =>
                      (await saveIdealUserEdit(arcId, t, sd.version)).ok
                  : undefined
              }
              onSaved={(text) => {
                if (sd) {
                  setIdeal((prev) => (prev ? { ...prev, text } : prev));
                } else {
                  setNotes(text);
                }
                setEditing(false);
              }}
              onCancel={() => setEditing(false)}
            />
          ) : ideal ? (
            <div className="flex flex-col gap-4">
              {/* SD chrome — the living document's status + the read-aloud ask. */}
              {sd ? (
                <div className="flex flex-col gap-3">
                  <span
                    className={`self-start rounded-full px-2.5 py-1 text-[12px] font-medium ${
                      sd.status === "verified"
                        ? "bg-success/10 text-success"
                        : "bg-muted text-muted-foreground"
                    }`}
                  >
                    {sd.status === "verified"
                      ? "Verified"
                      : "Pending verification by the coach"}
                  </span>
                  {sd.status === "unverified" && onReadAloud ? (
                    <button
                      type="button"
                      onClick={() => onReadAloud(sd.version)}
                      className="flex items-center justify-between gap-2 rounded-xl border border-primary/30 bg-primary/5 px-4 py-3 text-left transition-colors hover:border-primary/60"
                    >
                      <span className="text-[13px] leading-relaxed text-foreground">
                        Read it aloud. Your reading becomes your next
                        recording, and your text gets sharper.
                      </span>
                      <span className="shrink-0 text-[12px] font-medium text-primary">
                        Record
                      </span>
                    </button>
                  ) : null}
                </div>
              ) : null}
              <NotebookText
                text={displayText}
                ideal={ideal}
                onMomentTap={(m) => void openMoment(m)}
              />
            </div>
          ) : null}
        </div>
      </div>

      {/* "Go to this moment?" — the small confirm bubble for a tapped moment. */}
      {momentAsk ? (
        <div className="pointer-events-none fixed inset-x-0 bottom-6 z-10 flex justify-center px-4">
          <div className="pointer-events-auto flex items-center gap-3 rounded-2xl border border-border bg-card px-4 py-3 shadow-lg">
            <p className="text-[14px] text-foreground">Go to this moment?</p>
            <Button
              type="button"
              onClick={() => {
                setFeedbackTarget(momentAsk);
                setMomentAsk(null);
              }}
              className="h-8 rounded-full bg-foreground px-4 text-[13px] text-background hover:bg-foreground/90"
            >
              Go
            </Button>
            <button
              type="button"
              onClick={() => setMomentAsk(null)}
              className="text-[13px] text-muted-foreground hover:text-foreground"
            >
              Stay
            </button>
          </div>
        </div>
      ) : null}

      {/* The deep-linked feedback page, stacked over the notebook. */}
      {feedbackTarget ? (
        <FeedbackOverlay
          arcId={arcId}
          takeSessionId={feedbackTarget.takeSessionId || null}
          anchorSnippetId={feedbackTarget.snippetId}
          onClose={() => setFeedbackTarget(null)}
          topLayer
        />
      ) : null}

      {/* SD — the key-moment sheet: a simple card over the page (coach note
          and/or video, or the 5-credit unlock prompt). Never navigates away. */}
      {momentOpen ? (
        <div
          className="fixed inset-0 z-10 flex items-end justify-center bg-black/40 p-4 sm:items-center"
          onClick={() => setMomentOpen(null)}
          role="presentation"
        >
          {/* D-3 — the sheet joins the back-dismiss LIFO: Back closes the
              sheet first, not the whole notebook underneath (R-sd5). */}
          <SheetBackDismiss onClose={() => setMomentOpen(null)} />
          <div
            className="w-full max-w-md rounded-2xl border border-border bg-card p-5 shadow-xl"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-label="Key moment"
          >
            <div className="mb-3 flex items-center justify-between">
              <p className="text-[14px] font-semibold text-foreground">
                Your key moment
              </p>
              <OverlayCloseButton
                onClick={() => setMomentOpen(null)}
                ariaLabel="Close key moment"
              />
            </div>
            {momentContent === null ? (
              <p className="py-6 text-center text-[13px] text-muted-foreground">
                Loading…
              </p>
            ) : momentContent.kind === "locked" ? (
              <MomentUnlockPrompt
                priceCredits={momentContent.priceCredits}
                onBuy={buyMoments}
              />
            ) : momentContent.kind === "error" ? (
              <p className="py-6 text-center text-[13px] text-muted-foreground">
                Couldn&apos;t load this moment just now. Try again in a moment.
              </p>
            ) : (
              <div className="flex flex-col gap-3">
                {momentContent.videoRef ? (
                  // eslint-disable-next-line jsx-a11y/media-has-caption
                  <video
                    src={momentContent.videoRef}
                    controls
                    playsInline
                    className="w-full rounded-xl bg-black"
                  />
                ) : null}
                {momentContent.note ? (
                  <p className="text-[15px] leading-relaxed text-foreground">
                    {momentContent.note}
                  </p>
                ) : null}
                {!momentContent.videoRef && !momentContent.note ? (
                  <p className="py-4 text-center text-[13px] text-muted-foreground">
                    Your coach hasn&apos;t added the explanation for this moment
                    yet.
                  </p>
                ) : null}
              </div>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}

/** D-3 — a mount-scoped back-dismiss entry for the moment sheet (hooks can't
 *  be conditional, so the conditional mount of this child does the pushing). */
function SheetBackDismiss({ onClose }: { onClose: () => void }) {
  useBackDismiss(onClose);
  return null;
}

/** SD — the unlock prompt inside the moment sheet: one price, one button. */
function MomentUnlockPrompt({
  priceCredits,
  onBuy,
}: {
  priceCredits: number | null;
  onBuy: () => Promise<string | null>;
}) {
  const [buying, setBuying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const price = priceCredits ?? 5;
  return (
    <div className="flex flex-col items-center gap-3 py-2 text-center">
      <p className="text-[14px] leading-relaxed text-foreground">
        See why these were your key moments, from your coach.
      </p>
      <Button
        type="button"
        onClick={() => {
          if (buying) return;
          setBuying(true);
          setError(null);
          void onBuy().then((err) => {
            setBuying(false);
            if (err) setError(err);
          });
        }}
        disabled={buying}
        className="h-10 rounded-full bg-foreground px-6 text-[14px] text-background hover:bg-foreground/90"
      >
        {buying ? "Unlocking…" : `Unlock for ${price} credits`}
      </Button>
      <p className="text-[12px] text-muted-foreground">
        One unlock opens every key moment in this presentation, now and later.
      </p>
      {error ? <p className="text-[12px] text-destructive">{error}</p> : null}
    </div>
  );
}

/** The big, clean reading view: bold key phrases, underlined tappable key
 *  moments. A1-size type, no playback, no chrome. */
function NotebookText({
  text,
  ideal,
  onMomentTap,
}: {
  text: string;
  ideal: IdealText;
  onMomentTap: (m: IdealKeyMomentLink) => void;
}) {
  const segments = useMemo(
    () => segmentIdealText(text, ideal.keyPhrases, ideal.keyMoments),
    [text, ideal.keyPhrases, ideal.keyMoments]
  );
  // FE-9 — an INLINE [[moment:…]] marker (coach-authored) is as tappable as an
  // anchor-based key moment: bridge RichText's {snippetId, sessionId} shape to
  // the overlay's IdealKeyMomentLink flow.
  const onInlineMoment = (m: { snippetId: string; sessionId: string }) =>
    onMomentTap({ anchor: "", snippetId: m.snippetId, takeSessionId: m.sessionId });
  return (
    <p className="whitespace-pre-line text-[24px] leading-relaxed text-foreground">
      {segments.map((s, i) =>
        s.moment ? (
          <button
            key={i}
            type="button"
            onClick={() => onMomentTap(s.moment!)}
            className="inline underline decoration-primary decoration-2 underline-offset-4 transition-colors hover:text-primary"
          >
            {/* No onMomentTap inside — never nest a button in a button. */}
            <RichText text={s.text} />
          </button>
        ) : s.bold ? (
          <strong key={i} className="font-semibold">
            <RichText text={s.text} onMomentTap={onInlineMoment} />
          </strong>
        ) : (
          // FE-9 — the coach's inline markers (bold / italic / underline /
          // orange / moment links) render here too, identically to the coach
          // preview, instead of leaking raw marker syntax into the notebook.
          <span key={i}>
            <RichText text={s.text} onMomentTap={onInlineMoment} />
          </span>
        )
      )}
    </p>
  );
}

/** The minimalist notebook editor — saves to the user's PERSONAL copy via the
 *  notes PUT; the coach-approved canonical is never touched (L1/A6). */
function NotebookEditor({
  arcId,
  initial,
  save: saveOverride,
  onSaved,
  onCancel,
}: {
  arcId: string;
  initial: string;
  /** #214 — optional persistence override (the SD user-edit PUT); default is
   *  the legacy personal-notes PUT. Returns success. */
  save?: (text: string) => Promise<boolean>;
  onSaved: (text: string) => void;
  onCancel: () => void;
}) {
  const [draft, setDraft] = useState(initial);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const ref = useRef<HTMLTextAreaElement | null>(null);
  useEffect(() => {
    ref.current?.focus();
  }, []);

  // An emptied draft can't save: the mapper reads an empty stored copy as
  // "no personal copy" on the next load, so it would silently revert to the
  // canonical — blocking it here keeps what you see and what persists aligned.
  const empty = draft.trim() === "";

  async function save() {
    if (saving || empty) return;
    setSaving(true);
    setError(null);
    const ok = saveOverride
      ? await saveOverride(draft)
      : await saveIdealNotes(arcId, draft);
    setSaving(false);
    if (ok) onSaved(draft);
    else setError("Couldn't save. Try again.");
  }

  return (
    <div className="flex flex-1 flex-col gap-3">
      <textarea
        ref={ref}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        className="min-h-[50vh] w-full flex-1 resize-none rounded-2xl border border-border bg-background px-4 py-4 text-[18px] leading-relaxed outline-none focus:border-primary"
      />
      <p className="text-[12px] text-muted-foreground">
        {saveOverride
          ? "Your edit becomes the text. Your coach sees it too."
          : "This is your personal copy. The coach-approved original stays unchanged."}
      </p>
      <div className="flex items-center gap-2">
        <Button
          type="button"
          onClick={() => void save()}
          disabled={saving || empty}
          className="h-10 rounded-full bg-foreground px-6 text-[14px] text-background hover:bg-foreground/90"
        >
          {saving ? "Saving…" : "Save"}
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={onCancel}
          className="h-10 rounded-full px-6 text-[14px]"
        >
          Cancel
        </Button>
        {error ? <p className="text-[13px] text-destructive">{error}</p> : null}
      </div>
    </div>
  );
}
