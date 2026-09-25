"use client";

import { useCallback, useEffect, useState } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  fetchSnippetHistory,
  type MomentHistory,
} from "@/services/api/voiceAlbum";
import { Event, Origin } from "./VoiceAlbumMoment";

/* -------------------------------------------------------------------------- */
/*  THE STORY BEHIND ANY MOMENT (founder 2026-09-25).                          */
/*                                                                            */
/*  "the album shows your confident moments, not any moments." The Album is a  */
/*  trophy case — three separate yeses to get in — so the history above it can */
/*  only ever be told about a moment that went well. The ones worth learning   */
/*  from are the others, and this tells their story where they actually live:  */
/*  the sheet the speaker opens on their own words.                            */
/*                                                                            */
/*  NOT A STEP IN THE LADDER, and that is a fence. `stepProgress` warns: "this */
/*  counts SCREENS and nothing else. It must never encode how many problems    */
/*  were found — a four-segment bar on one paragraph beside a three-segment    */
/*  bar on another would say exactly that, out loud, in a column." A story     */
/*  step present only where there IS a story would lengthen the bar on exactly */
/*  the weaker paragraphs. So it sits inside the exercise step instead.        */
/*                                                                            */
/*  EVERY WORD HERE IS ALREADY SIGNED. The label, the error line and the       */
/*  timeline are the Album's own, shipped 2026-09-18 — reused rather than      */
/*  rewritten, so this surface needed no new copy at all.                      */
/*                                                                            */
/*  Loaded on OPEN, never with the sheet: the speaker came here to practise,   */
/*  and a read they did not ask for should not be on that path.                */
/* -------------------------------------------------------------------------- */
export default function MomentStory({
  arcId,
  sessionId,
  snippetId,
}: {
  arcId: string | null;
  sessionId: string | null;
  snippetId: string | null;
}) {
  const [open, setOpen] = useState(false);
  const [status, setStatus] = useState<"idle" | "loading" | "ready" | "error">(
    "idle",
  );
  const [history, setHistory] = useState<MomentHistory | null>(null);

  const load = useCallback(async () => {
    if (!arcId || !sessionId || !snippetId) return;
    setStatus("loading");
    const next = await fetchSnippetHistory(arcId, sessionId, snippetId);
    if (next === null) {
      setStatus("error");
      return;
    }
    setHistory(next);
    setStatus("ready");
  }, [arcId, sessionId, snippetId]);

  useEffect(() => {
    if (open && status === "idle") void load();
  }, [open, status, load]);

  if (!arcId || !sessionId || !snippetId) return null;

  const events = history?.events ?? [];

  return (
    <div className="rounded-2xl border border-border">
      <button
        type="button"
        onClick={() => setOpen((was) => !was)}
        aria-expanded={open}
        className="flex w-full items-center justify-end gap-1 px-4 py-3 text-[13px] font-semibold text-foreground"
      >
        {open ? "Hide" : "History"}
        <ChevronDown
          className={cn(
            "h-3.5 w-3.5 transition-transform",
            open && "rotate-180",
          )}
          aria-hidden
        />
      </button>
      {open ? (
        <div className="border-t border-border px-4 pb-4 pt-3.5">
          {status === "error" ? (
            <p className="py-2 text-[14px] text-muted-foreground">
              We couldn&apos;t load this history just now.
            </p>
          ) : status === "ready" && events.length === 0 ? (
            /* An honest empty: nothing has happened on this moment yet, and
               inventing a chapter would be worse than showing none. */
            <Origin
              takeIndex={history?.origin.takeIndex ?? null}
              slideIndex={history?.origin.slideIndex ?? null}
              recorded={null}
            />
          ) : status === "ready" ? (
            <>
              <Origin
                takeIndex={history?.origin.takeIndex ?? null}
                slideIndex={history?.origin.slideIndex ?? null}
                recorded={null}
              />
              <ul className="m-0 list-none p-0">
                {events.map((event, index) => (
                  <Event key={`${event.kind}-${index}`} event={event} />
                ))}
              </ul>
            </>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
