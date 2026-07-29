"use client";

import { useEffect, useState } from "react";
import { Check, Loader2, Mic } from "lucide-react";
import { Button } from "@/components/ui/button";
import IdealReadMic from "./IdealReadMic";
import { saveIdealText } from "@/services/api/saveIdealText";
import { IDEAL_EDIT_COPY } from "./idealEditCopy";

/* -------------------------------------------------------------------------- */
/*  IdealTextActions — the master document's three buttons (FE-3, founder      */
/*  2026-07-22), in this order and with this gating:                          */
/*                                                                            */
/*    1. Save the ideal text — accept-and-freeze. Resolves the pending state  */
/*       server-side, so afterwards the take badges go and the clean script   */
/*       shows. Saving is what UNLOCKS the re-read.                           */
/*    2. Record a re-read — only after a save: you read aloud what you have    */
/*       settled on, never a script still carrying open offers. The reading    */
/*       goes to the coach and is never rendered back (no bubble, no version,  */
/*       no document change — the BE guarantees this since #228).             */
/*    3. Record the next official take — the full pipeline, as today. The      */
/*       master then shows any new block-level upgrade offers.                */
/*                                                                            */
/*  SAFE-AHEAD: mounted only when the BE actually serves the save lane        */
/*  (`saved` is a boolean, not null). Until then the host keeps today's        */
/*  single two-state mic — a live affordance is never hidden behind a field   */
/*  that does not exist yet.                                                  */
/* -------------------------------------------------------------------------- */

export default function IdealTextActions({
  arcId,
  version,
  title,
  latestTakeSessionId,
  rereadDone,
  rereadProcessing = null,
  canRecordTake = null,
  saved,
  onBeforeSave,
  onSaved,
  onNewTake,
  onReadUploaded,
}: {
  arcId: string;
  version: number | null;
  title: string | null;
  latestTakeSessionId: string | null;
  rereadDone: boolean;
  /** §4 — the BE's re-read-in-flight signal, threaded to the read mic. */
  rereadProcessing?: boolean | null;
  /** The BE's gate on recording a new OFFICIAL take (button 3). Gates ONLY on
   *  an explicit false; null / absent leaves the button exactly as today. The
   *  re-read (button 2) is untouched: it is not an official take. */
  canRecordTake?: boolean | null;
  /** Whether THIS version is already saved (drives the re-read gate). */
  saved: boolean;
  /** MASTER DOCUMENT (review R-md1) — commit any pending local edit BEFORE
   *  the freeze: the snapshot must be the text on screen, not the last text a
   *  debounce happened to send. Resolving false means the edit could not be
   *  persisted, and the freeze is abandoned rather than freezing the wrong
   *  words under a green confirmation. */
  onBeforeSave?: () => Promise<boolean>;
  /** The save landed — the host refetches so the clean, badge-free script
   *  replaces the working view. */
  onSaved: () => void;
  /** Route into the regular record flow for the next official take. */
  onNewTake: () => void;
  onReadUploaded: () => void;
}) {
  const [saving, setSaving] = useState(false);
  const [failed, setFailed] = useState(false);
  // Released only when the host's refetch reports `saved` (review R-md3):
  // dropping `saving` on the POST's resolution re-enables the button for the
  // whole refetch round trip, and a second tap re-runs accept-and-freeze.
  const [justSaved, setJustSaved] = useState(false);
  const busy = saving || justSaved;
  useEffect(() => {
    if (saved) setJustSaved(false);
  }, [saved]);

  const save = async () => {
    if (busy || saved) return;
    setSaving(true);
    setFailed(false);
    // Drain the edit lane first — the freeze must capture the words on
    // screen. A failed flush abandons the freeze: better an honest retry than
    // a green tick over text the master never got.
    const flushed = (await onBeforeSave?.()) ?? true;
    if (!flushed) {
      setSaving(false);
      setFailed(true);
      return;
    }
    const r = await saveIdealText(arcId);
    setSaving(false);
    // "unavailable" = the lane is not deployed; "nothing" = there was nothing
    // pending to freeze. Neither is the student's fault, so neither shows a
    // failure line — both just re-sync with the server.
    if (r.kind === "saved" || r.kind === "nothing") {
      setJustSaved(true);
      onSaved();
    } else if (r.kind === "unavailable") {
      // Nothing to say: the button simply cannot work until the BE ships.
    } else {
      setFailed(true);
    }
  };

  return (
    <div className="mt-1 flex flex-col items-stretch gap-2 border-t border-border pt-4">
      {/* 1 — Save. Once saved it states the fact instead of offering again. */}
      {saved ? (
        <p className="flex items-center justify-center gap-1.5 text-[13px] text-muted-foreground">
          <Check className="h-4 w-4 text-success" aria-hidden />
          Saved. This is your script.
        </p>
      ) : (
        <Button
          type="button"
          onClick={() => void save()}
          disabled={busy}
          className="h-11 w-full rounded-full bg-foreground text-[15px] font-medium text-background hover:bg-foreground/90"
        >
          {busy ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />
              Saving…
            </>
          ) : (
            "Save the ideal text"
          )}
        </Button>
      )}
      {failed ? (
        <p className="text-center text-[12px] text-muted-foreground">
          Couldn&apos;t save that just now. Give it another go.
        </p>
      ) : null}

      {/* 2 — Re-read, unlocked by the save. */}
      {saved ? (
        <IdealReadMic
          arcId={arcId}
          version={version}
          title={title}
          latestTakeSessionId={latestTakeSessionId}
          rereadDone={rereadDone}
          rereadProcessing={rereadProcessing}
          onNewTake={onNewTake}
          onReadUploaded={onReadUploaded}
          micOnly
        />
      ) : null}

      {/* 3 — The next official take. Available unless the BE explicitly
          closes its gate; disabled rather than removed, so the entry to the
          record loop never silently disappears from this screen. */}
      <Button
        type="button"
        onClick={onNewTake}
        disabled={canRecordTake === false}
        variant="outline"
        className="h-11 w-full rounded-full text-[15px] font-medium"
      >
        <Mic className="mr-2 h-4 w-4" aria-hidden />
        Record the next take
      </Button>
      {canRecordTake === false ? (
        <p className="text-center text-[12px] text-muted-foreground">
          {IDEAL_EDIT_COPY.recordUnavailable}
        </p>
      ) : null}
    </div>
  );
}
