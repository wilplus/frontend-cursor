"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import { fetchArcFeedback } from "@/services/api/arcFeedback";

/* -------------------------------------------------------------------------- */
/*  DeckCoachFeedback — the coach's own written note on this chunk's words.    */
/*                                                                            */
/*  Rendered on BOTH modal faces, locked chunks included — the founder's       */
/*  requirement, and the reason it lives here rather than beside a proposal:   */
/*  a locked chunk has no proposal left, and the coach's message is still      */
/*  about those words.                                                        */
/*                                                                            */
/*  WHY IT LOADS ON A TAP, never on open. The feedback read is METERED — the   */
/*  backend charges the insights price once per arc — so fetching it because   */
/*  someone opened a chunk to fix a typo would bill them for a thing they did  */
/*  not ask to see. The card announces itself from a FREE flag the ideal-text  */
/*  payload already carries (`has_explanation`: the coach surfaced a note),    */
/*  and only the deliberate tap pays, exactly as opening the                    */
/*  feedback page from the Lounge does today.                                  */
/* -------------------------------------------------------------------------- */

/** The founder's copy, in full (2026-08-11). */
const LABEL = "Coach note:";

export default function DeckCoachFeedback({
  arcId,
  snippetId,
}: {
  arcId: string | null;
  /** The moment's snippet — how the coach's message is keyed. */
  snippetId: string;
}) {
  const [state, setState] = useState<"idle" | "loading" | "ready" | "empty">(
    "idle"
  );
  const [loadedNote, setLoadedNote] = useState<string | null>(null);

  async function open() {
    if (!arcId || state === "loading") return;
    setState("loading");
    const feedback = await fetchArcFeedback(arcId);
    // The moment lives on whichever take it was recorded in; the snippet id
    // is unique across them, so the first match is the match.
    const hit = (feedback?.takes ?? [])
      .flatMap((t) => t.keyMoments)
      .find((m) => m.snippetId === snippetId);
    if (!hit?.commentText) {
      // The flag said there was something and the packet disagrees (a gated
      // take, a coach un-surfacing between the two reads). Say so plainly
      // rather than leaving a spinner or pretending the card was never here.
      setState("empty");
      return;
    }
    setLoadedNote(hit.commentText);
    setState("ready");
  }

  // ONE string on this card (founder 2026-08-11: "Change the copy to simply
  // say: 'Coach note:'"). While it is idle the CARD is the affordance, so
  // there is no second label to invent.
  if (state === "idle") {
    return (
      <button
        type="button"
        onClick={() => void open()}
        className="flex w-full items-center gap-2 rounded-2xl border border-border bg-card p-4 text-left text-[13px] font-medium text-foreground transition-colors hover:border-foreground/30"
      >
        {LABEL}
      </button>
    );
  }

  return (
    <div className="flex flex-col gap-2 rounded-2xl border border-border bg-card p-4">
      <p className="text-[13px] font-medium text-foreground">{LABEL}</p>

      {state === "loading" ? (
        <span className="inline-flex items-center gap-2 text-[13px] text-muted-foreground">
          <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
          Opening…
        </span>
      ) : null}

      {state === "empty" ? (
        <p className="text-[13px] leading-relaxed text-muted-foreground">
          Couldn&apos;t open this just now. Close and try again.
        </p>
      ) : null}

      {state === "ready" && loadedNote ? (
        <p className="text-[14px] leading-relaxed text-foreground">
          {loadedNote}
        </p>
      ) : null}
    </div>
  );
}
