"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Check, Copy, PencilLine } from "lucide-react";
import { Button } from "@/components/ui/button";
import { mergeSession } from "@/services/api/mergeSession";
import { fetchIdealText, saveIdealUserEdit } from "@/services/api/idealText";
import { MarkerToolbar } from "./RichText";
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

  // #214 — arm persistence: read the current version from the SD GET. A
  // non-single result (flag OFF, older BE) leaves persistence off.
  useEffect(() => {
    if (!signedIn || !arcId) return;
    let active = true;
    void fetchIdealText(arcId).then((r) => {
      if (!active || r.kind !== "single") return;
      versionRef.current = r.version;
      persistArmedRef.current = true;
      setCanPersist(true);
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
      ) : null}
    </div>
  );
}
