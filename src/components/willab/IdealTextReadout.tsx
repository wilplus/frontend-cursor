"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Check, Copy, Mic, PencilLine } from "lucide-react";
import { Button } from "@/components/ui/button";
import { mergeSession } from "@/services/api/mergeSession";
import {
  fetchIdealText,
  saveIdealUserEdit,
  type IdealText,
} from "@/services/api/idealText";
import { MarkerToolbar } from "./RichText";
import { MomentSheet, MomentStarText, useMomentStars } from "./MomentStars";
import type { ReadoutPayload } from "./readout";

/* -------------------------------------------------------------------------- */
/*  IdealTextReadout — the post-recording screen IS the ideal text (SD)        */
/*                                                                            */
/*  Replaces the per-piece approve walker: the moment analysis lands, the      */
/*  user sees their ideal text 1.0 — every suggestion already applied, one     */
/*  continuous text in paragraphs, font one step up, editable — under a grey   */
/*  "Pending verification by the coach" badge. No Approve buttons, no "Send    */
/*  for analysis": a signed-in take is sent to the coach AUTOMATICALLY on      */
/*  arrival (mergeSession, once); a guest gets one button to save the text by  */
/*  creating an account (that is account creation, not a send step).           */
/* -------------------------------------------------------------------------- */

/** First-occurrence replace (mirrors ReadoutCard's applyUpgradeText). */
function applyUpgrade(text: string, original: string, upgrade: string): string {
  const i = text.indexOf(original);
  return i < 0 ? text : text.slice(0, i) + upgrade + text.slice(i + original.length);
}

/** The ideal text 1.0: every piece with ALL its suggestions applied (a saved
 *  user edit is already-composed text and wins), joined into paragraphs. */
export function composeIdealText(payload: ReadoutPayload): string {
  const parts: string[] = [];
  if (payload.instantChunks.length > 0) {
    for (const p of payload.instantChunks) {
      let t = p.userEditedText ?? p.text;
      if (!p.userEditedText) {
        for (const u of p.sayItStronger?.upgrades ?? []) {
          t = applyUpgrade(t, u.original, u.upgrade);
        }
      }
      if (t.trim()) parts.push(t.trim());
    }
  } else {
    for (const c of payload.fullTranscriptChunks) {
      const t = (c.userEditedText ?? c.transcript).trim();
      if (t) parts.push(t);
    }
  }
  return parts.join("\n\n");
}

export default function IdealTextReadout({
  payload,
  sessionId,
  arcId = null,
  signedIn,
  onAutoSent,
  onSignUp,
  onReRead,
}: {
  payload: ReadoutPayload;
  sessionId: string | null;
  /** The presentation this take belongs to — enables edit persistence (#214).
   *  null (guest / standalone upload) → edits stay local. */
  arcId?: string | null;
  signedIn: boolean | null;
  /** Fires once after the automatic send succeeds (review-pending bookkeeping). */
  onAutoSent: () => void;
  /** Guest path — save the text by creating an account (the signup gate). */
  onSignUp: () => void;
  /** Re-read: reading this ideal text aloud is just the next take — the host
   *  drops us back into the record flow for this presentation, and the reading
   *  sharpens the text. Absent → the re-read block hides. */
  onReRead?: () => void;
}) {
  const composed = useMemo(() => composeIdealText(payload), [payload]);
  const [text, setText] = useState(composed);
  const [editing, setEditing] = useState(false);
  const [copied, setCopied] = useState(false);
  const [sendFailed, setSendFailed] = useState(false);
  const firedRef = useRef(false);
  const editorRef = useRef<HTMLTextAreaElement | null>(null);
  // #214 — edit persistence: armed once the SD GET confirms the contract and
  // hands us the current version. Until then (flag OFF / guest) edits are
  // local-only, exactly the pre-#214 behavior.
  const versionRef = useRef<number | null>(null);
  // SD — the served living document: its text (the star anchors live in it),
  // verification status, and the moments entitlement. null until the GET lands
  // (or forever when the flag is OFF), and the screen stays exactly as before.
  const [sd, setSd] = useState<{
    ideal: IdealText;
    status: "unverified" | "verified";
    version: number | null;
    momentsUnlocked: boolean;
    priceCredits: number | null;
  } | null>(null);
  // State (not a ref) so arming re-runs the debounce effect — an edit typed
  // BEFORE the version fetch lands must still save once arming completes.
  const [canPersist, setCanPersist] = useState(false);
  const dirtyRef = useRef(false);
  // SEND-LATEST serialization (review R-ue2): saves run one at a time on a
  // promise chain, and each sends the text AS OF EXECUTION — overlapping PUTs
  // can therefore never commit an older edit over a newer one server-side.
  const textRef = useRef("");
  const savedTextRef = useRef<string | null>(null);
  const chainRef = useRef<Promise<void>>(Promise.resolve());
  const persistArmedRef = useRef(false);
  const arcIdRef = useRef<string | null>(null);
  const [saveState, setSaveState] = useState<"idle" | "saved" | "failed">(
    "idle"
  );
  textRef.current = text;
  arcIdRef.current = arcId;

  // Automatic delivery — no send button. Once, when signed in with a session.
  useEffect(() => {
    if (!signedIn || !sessionId || firedRef.current) return;
    firedRef.current = true;
    void mergeSession(sessionId).then((r) => {
      if (r.kind === "sent") onAutoSent();
      else if (r.kind !== "unauthenticated") setSendFailed(true);
    });
  }, [signedIn, sessionId, onAutoSent]);

  // #214 — arm persistence AND adopt the served ideal text. The SD GET is the
  // authority: its text carries the key-moment anchors (and any folds the BE
  // already applied), so the stars can only land if we render THAT text rather
  // than the locally composed one. Adopt it only while the text is still
  // untouched — a dirty edit always wins (locked rule), and a saved user_edit
  // is what the BE serves back anyway.
  useEffect(() => {
    if (!signedIn || !arcId) return;
    let active = true;
    void fetchIdealText(arcId).then((r) => {
      if (!active || r.kind !== "single") return;
      versionRef.current = r.version;
      persistArmedRef.current = true;
      setCanPersist(true);
      setSd({
        ideal: r.ideal,
        status: r.status,
        version: r.version,
        momentsUnlocked: r.momentsUnlocked,
        priceCredits: r.priceCredits,
      });
      if (!dirtyRef.current && r.ideal.text.trim()) {
        savedTextRef.current = r.ideal.text;
        setText(r.ideal.text);
      }
    });
    return () => {
      active = false;
    };
  }, [signedIn, arcId]);

  // #214 — debounced save of a DIRTY edit (never the untouched composed text).
  // saveIdealUserEdit retries once on VERSION_SUPERSEDED with the server's
  // current version — the student's edit always wins (locked rule). Each
  // chained save reads textRef at execution, so the newest words always land
  // last; "Edit saved." shows only when the SAVED text is still the current
  // text (a newer pending edit keeps the status quiet — R-ue3).
  const enqueueSave = useCallback((aid: string) => {
    chainRef.current = chainRef.current.then(async () => {
      const t = textRef.current;
      if (savedTextRef.current === t) return;
      const r = await saveIdealUserEdit(aid, t, versionRef.current);
      if (r.ok) {
        versionRef.current = r.version ?? versionRef.current;
        savedTextRef.current = t;
        setSaveState(textRef.current === t ? "saved" : "idle");
      } else {
        setSaveState("failed");
      }
    });
  }, []);

  useEffect(() => {
    if (!dirtyRef.current || !canPersist || !arcId) return;
    const id = setTimeout(() => enqueueSave(arcId), 800);
    return () => clearTimeout(id);
  }, [text, arcId, canPersist, enqueueSave]);

  // Unmount flush (R-ue3): a close inside the debounce window must not drop
  // the final edit — fire the save on the way out (the request outlives the
  // component; state setters after unmount are React no-ops).
  useEffect(
    () => () => {
      const aid = arcIdRef.current;
      if (
        aid &&
        persistArmedRef.current &&
        dirtyRef.current &&
        savedTextRef.current !== textRef.current
      ) {
        void saveIdealUserEdit(aid, textRef.current, versionRef.current);
      }
    },
    []
  );

  useEffect(() => {
    const el = editorRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }, [text, editing]);

  // SD — the shared star layer (sheet, Approve/Revert folds, 5-credit unlock).
  const stars = useMomentStars({
    arcId: arcId ?? "",
    momentsUnlocked: sd?.momentsUnlocked ?? false,
    priceCredits: sd?.priceCredits ?? null,
    onUnlocked: () =>
      setSd((prev) => (prev ? { ...prev, momentsUnlocked: true } : prev)),
  });

  // The one edit path — a keystroke or a toolbar wrap: mark dirty, reset the
  // save flash, update the text (the debounce effect persists it).
  const applyEdit = useCallback((next: string) => {
    dirtyRef.current = true;
    setSaveState("idle");
    setText(next);
  }, []);

  return (
    <div className="flex flex-1 flex-col gap-4">
      <div className="flex items-center justify-between gap-2">
        {/* The one status: grey now; flips to green on the ideal-text page
            once the coach verifies. */}
        <span className="rounded-lg bg-muted px-2.5 py-1 text-[12px] font-medium text-muted-foreground">
          Pending verification by the coach
        </span>
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => {
              void navigator.clipboard?.writeText(text).then(() => {
                setCopied(true);
                setTimeout(() => setCopied(false), 1600);
              });
            }}
            aria-label={copied ? "Copied" : "Copy the text"}
            className="flex h-8 w-8 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            {copied ? (
              <Check className="h-4 w-4 text-success" aria-hidden />
            ) : (
              <Copy className="h-4 w-4" aria-hidden />
            )}
          </button>
          <button
            type="button"
            onClick={() => setEditing((e) => !e)}
            aria-label={editing ? "Done editing" : "Edit the text"}
            className={`flex h-8 w-8 items-center justify-center rounded-full transition-colors hover:bg-muted ${
              editing ? "text-primary" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {editing ? (
              <Check className="h-4 w-4" aria-hidden />
            ) : (
              <PencilLine className="h-4 w-4" aria-hidden />
            )}
          </button>
        </div>
      </div>

      {editing ? (
        <div className="flex flex-col gap-2">
          {/* Bold / underline / italic / orange — wraps the selection in the
              shared marker contract; renders in the read view + everywhere. */}
          <MarkerToolbar
            textareaRef={editorRef}
            value={text}
            onChange={applyEdit}
          />
          <textarea
            ref={editorRef}
            value={text}
            onChange={(e) => applyEdit(e.target.value)}
            className="w-full resize-none overflow-hidden rounded-2xl border border-primary bg-background px-4 py-4 text-[17px] leading-relaxed outline-none"
          />
        </div>
      ) : sd ? (
        // SD — the SAME star layer as the notebook: grey suggestion stars to
        // Approve, orange coach-verified stars behind the unlock.
        <MomentStarText
          text={text}
          ideal={sd.ideal}
          onMomentTap={(m) => void stars.openMoment(m)}
          foldFor={stars.foldFor}
          textSizeClass="text-[17px]"
        />
      ) : (
        <p className="whitespace-pre-line text-[17px] leading-relaxed text-foreground">
          {text}
        </p>
      )}

      {saveState === "saved" ? (
        <p className="text-[12px] text-muted-foreground">Edit saved.</p>
      ) : saveState === "failed" ? (
        <p className="text-[12px] text-muted-foreground">
          Couldn&apos;t save your edit just now. It stays here; keep typing and
          it retries.
        </p>
      ) : null}

      {sendFailed ? (
        <p className="text-[12px] text-muted-foreground">
          Couldn&apos;t reach your coach just now. Your text is safe; delivery
          retries when you reopen it.
        </p>
      ) : null}

      {signedIn === false ? (
        <Button
          type="button"
          onClick={onSignUp}
          className="h-12 w-full rounded-full bg-foreground text-[15px] font-medium text-background hover:bg-foreground/90"
        >
          Save your ideal text
        </Button>
      ) : onReRead ? (
        // Re-read loop — reading the ideal text aloud is just the next take.
        // The reading goes back through analysis and the text gets sharper and
        // more yours. Small mic'd CTA at the bottom, under the ask.
        <div className="mt-1 flex flex-col gap-2.5 rounded-2xl border border-primary/25 bg-primary/5 px-4 py-4">
          <p className="text-[13px] leading-relaxed text-foreground">
            Please read the text as if you were presenting. It helps us spot
            whether it feels good, and make it even more your style and engaging
            for your specific audience.
          </p>
          <Button
            type="button"
            onClick={onReRead}
            className="h-11 w-full rounded-full bg-foreground text-[14px] font-medium text-background hover:bg-foreground/90"
          >
            <Mic className="mr-2 h-4 w-4" aria-hidden />
            Send for analysis
          </Button>
        </div>
      ) : null}

      <MomentSheet
        moment={stars.momentOpen}
        momentContent={stars.momentContent}
        applied={stars.momentOpen ? stars.isApplied(stars.momentOpen) : false}
        onClose={stars.closeMoment}
        onApprove={() => stars.momentOpen && stars.approveMoment(stars.momentOpen)}
        onRevert={() => stars.momentOpen && stars.revertMoment(stars.momentOpen)}
        onBuy={stars.buyMoments}
      />
    </div>
  );
}
