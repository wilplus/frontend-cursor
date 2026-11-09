"use client";

/* -------------------------------------------------------------------------- */
/*  "Matching by how you speak", in Settings (Data & consent): the person's   */
/*  own switch (backend N463 item 2, N465 items 1 and 2, N559 item 6; App     */
/*  Model MATCH-11). Built as the signed prototype's screen 5 draws it        */
/*  (https://claude.ai/artifact/CKYJznNCva7EPmHtCkNQMS, Settings): On with    */
/*  "Turn off"; Turn off asks first, in the card; once off, it says what was  */
/*  deleted, with "Turn on". Every word is N465's, signed.                    */
/*                                                                            */
/*  Shown only while matching by how people speak is switched on at all      */
/*  (`available`, the backend's TAKE_MATCH_SKILLS) and the person has it on, */
/*  or has just turned it off here. Off by default (N463 item 2): someone who */
/*  never said yes sees no card, since the signed off line says something    */
/*  was deleted. Turning off deletes what Will learned from how they speak;  */
/*  the backend does that and answers only once it has (services/            */
/*  speaking_match.py). A failure leaves it as it was and says so.           */
/* -------------------------------------------------------------------------- */

import { useEffect, useState } from "react";
import { getSpeakingMatch, setSpeakingMatch } from "@/services/api/takeMatches";
import { Failed } from "./DataConsentChoices";

/** N465 item 1, the Settings card, signed (founder, 4 November 2026: "Sign all as drawn"). */
export const SPEAKING_MATCH_COPY = {
  title: "Matching by how you speak",
  on: "On. Will uses your pace, your pauses and how you build an answer to choose your practice buddies. Nobody sees it, you included.",
  turnOff: "Turn off",
  askTitle: "Turn off matching by how you speak?",
  askBody: "We delete what Will learned from how you speak. Your buddies stay.",
  cancel: "Cancel",
  off: "Off. We deleted what Will learned from how you speak.",
  turnOn: "Turn on",
} as const;

const COPY = SPEAKING_MATCH_COPY;
const BUTTON =
  "inline-flex h-10 items-center self-start rounded-full border border-border bg-background px-4 text-sm text-foreground hover:bg-muted";

type Mode = "on" | "confirm" | "off";

export default function SpeakingMatchCard() {
  const [mode, setMode] = useState<Mode | null>(null);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let alive = true;
    void getSpeakingMatch().then((s) => {
      if (alive && s?.available && s.on) setMode("on");
    });
    return () => {
      alive = false;
    };
  }, []);

  if (!mode) return null;

  const turn = async (on: boolean) => {
    setBusy(true);
    setFailed(false);
    const s = await setSpeakingMatch(on);
    setBusy(false);
    if (!s || s.on !== on) {
      setFailed(true);
      setMode(on ? "off" : "on");
      return;
    }
    setMode(on ? "on" : "off");
  };

  return (
    <section className="mt-6 flex flex-col gap-2 rounded-2xl border border-border p-4" aria-label={COPY.title}>
      {mode === "confirm" ? (
        <>
          <h2 className="text-base font-semibold">{COPY.askTitle}</h2>
          <p className="text-sm leading-relaxed text-muted-foreground">{COPY.askBody}</p>
          <div className="mt-1 flex gap-3">
            <button
              type="button"
              className="h-11 flex-1 rounded-full border border-border bg-background text-[15px]"
              onClick={() => setMode("on")}
            >
              {COPY.cancel}
            </button>
            <button
              type="button"
              className="h-11 flex-1 rounded-full bg-foreground text-[15px] font-medium text-background"
              disabled={busy}
              onClick={() => void turn(false)}
            >
              {COPY.turnOff}
            </button>
          </div>
        </>
      ) : (
        <>
          <h2 className="text-base font-semibold">{COPY.title}</h2>
          <p className="text-sm leading-relaxed text-muted-foreground">{mode === "on" ? COPY.on : COPY.off}</p>
          <button
            type="button"
            className={`mt-1 ${BUTTON}`}
            disabled={busy}
            onClick={() => (mode === "on" ? setMode("confirm") : void turn(true))}
          >
            {mode === "on" ? COPY.turnOff : COPY.turnOn}
          </button>
        </>
      )}
      <Failed show={failed} />
    </section>
  );
}
