"use client";

import { useState } from "react";
import { Check, Loader2, Mic } from "lucide-react";
import { Button } from "@/components/ui/button";
import IdealReadMic from "./IdealReadMic";
import { saveIdealText } from "@/services/api/saveIdealText";

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
  saved,
  onSaved,
  onNewTake,
  onReadUploaded,
}: {
  arcId: string;
  version: number | null;
  title: string | null;
  latestTakeSessionId: string | null;
  rereadDone: boolean;
  /** Whether THIS version is already saved (drives the re-read gate). */
  saved: boolean;
  /** The save landed — the host refetches so the clean, badge-free script
   *  replaces the working view. */
  onSaved: () => void;
  /** Route into the regular record flow for the next official take. */
  onNewTake: () => void;
  onReadUploaded: () => void;
}) {
  const [saving, setSaving] = useState(false);
  const [failed, setFailed] = useState(false);

  const save = () => {
    if (saving || saved) return;
    setSaving(true);
    setFailed(false);
    void saveIdealText(arcId).then((r) => {
      setSaving(false);
      // "unavailable" means the BE lane is not deployed — say nothing rather
      // than blame the student for a button that cannot work yet.
      if (r.kind === "saved") onSaved();
      else setFailed(true);
    });
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
          onClick={save}
          disabled={saving}
          className="h-11 w-full rounded-full bg-foreground text-[15px] font-medium text-background hover:bg-foreground/90"
        >
          {saving ? (
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
          onNewTake={onNewTake}
          onReadUploaded={onReadUploaded}
          micOnly
        />
      ) : null}

      {/* 3 — The next official take, always available. */}
      <Button
        type="button"
        onClick={onNewTake}
        variant="outline"
        className="h-11 w-full rounded-full text-[15px] font-medium"
      >
        <Mic className="mr-2 h-4 w-4" aria-hidden />
        Record the next take
      </Button>
    </div>
  );
}
