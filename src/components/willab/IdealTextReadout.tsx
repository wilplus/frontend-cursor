"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Check, Copy, PencilLine } from "lucide-react";
import { Button } from "@/components/ui/button";
import { mergeSession } from "@/services/api/mergeSession";
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
  signedIn,
  onAutoSent,
  onSignUp,
}: {
  payload: ReadoutPayload;
  sessionId: string | null;
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

  // Automatic delivery — no send button. Once, when signed in with a session.
  useEffect(() => {
    if (!signedIn || !sessionId || firedRef.current) return;
    firedRef.current = true;
    void mergeSession(sessionId).then((r) => {
      if (r.kind === "sent") onAutoSent();
      else if (r.kind !== "unauthenticated") setSendFailed(true);
    });
  }, [signedIn, sessionId, onAutoSent]);

  useEffect(() => {
    const el = editorRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }, [text, editing]);

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
        <textarea
          ref={editorRef}
          value={text}
          onChange={(e) => setText(e.target.value)}
          className="w-full resize-none overflow-hidden rounded-2xl border border-primary bg-background px-4 py-4 text-[17px] leading-relaxed outline-none"
        />
      ) : (
        <p className="whitespace-pre-line text-[17px] leading-relaxed text-foreground">
          {text}
        </p>
      )}

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
