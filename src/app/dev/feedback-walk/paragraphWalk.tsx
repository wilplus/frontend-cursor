"use client";

import { useEffect, useMemo, useState } from "react";
import ParagraphSheet from "@/components/willab/ParagraphSheet";
import type { DocumentSuggestion } from "@/services/api/idealText";
import PageStandIn from "./pageStandIn";
import { PARAGRAPHS, SLIDE_LABEL, makeToneUrl } from "./walkFixtures";

/* -------------------------------------------------------------------------- */
/*  /dev/feedback-walk?paragraph=this | saved | helpers — the PRODUCTION        */
/*  paragraph sheet (ParagraphSheet, HelperWordsSheet) in the walk's look and  */
/*  motion (build plan D-IT-6; Q-B3 A), over the page stand-in, for the        */
/*  screenshot harness (X7):                                                  */
/*                                                                            */
/*    this     "This paragraph": an answered moment                           */
/*    saved    "Helper words saved": its helper words saved; Edit opens the   */
/*             helper-words overlay                                           */
/*    helpers  the helper-words overlay itself                                */
/*                                                                            */
/*  ‹ › walk the stand-in's paragraphs, ✕ closes and the page's own button    */
/*  opens it again. Nothing is fetched (no project) and every write is only   */
/*  noted. DEV ONLY: page.tsx renders nothing in production.                  */
/* -------------------------------------------------------------------------- */

export type ParagraphView = "this" | "saved" | "helpers";

/** The fixture's helper words on each paragraph (its own words). */
const HELPER_WORDS = ["growth doubled", "the window closes", "approval", "Two hires"];

function momentOn(index: number, text: string, src: string | null): DocumentSuggestion {
  return {
    id: `cv-${index}`,
    start: 0,
    end: text.length,
    quote: text,
    kind: "advice",
    proposedText: null,
    device: null,
    status: "dismissed",
    feedbackFamily: "confident_voice",
    source: "confident_voice",
    snippetId: `snip-${index}`,
    takeSessionId: null,
    snippetAudioRef: src,
    startOffsetMs: 0,
    durationMs: 9000,
  } as unknown as DocumentSuggestion;
}

export default function ParagraphWalk({ view }: { view: ParagraphView }) {
  const [at, setAt] = useState(1);
  const [open, setOpen] = useState(true);
  const [src, setSrc] = useState<string | null>(null);
  useEffect(() => {
    const url = makeToneUrl();
    setSrc(url);
    return () => URL.revokeObjectURL(url);
  }, []);
  const text = PARAGRAPHS[at];
  const decided = useMemo(() => [momentOn(at, text, src)], [at, text, src]);
  const saved = view !== "this";
  const host = {
    onUseFromTake: async () => true,
    onDelete: async () => true,
  };
  return (
    <div data-paragraph-walk={view}>
      <PageStandIn answers={{}} onReview={() => setOpen(true)} />
      {open ? (
        <ParagraphSheet
          key={`${view}-${at}`}
          arcId={null}
          takeSessionId={null}
          partId={`p${at}`}
          text={text}
          headline={saved ? HELPER_WORDS[at] ?? null : null}
          decided={decided}
          // An answered moment: the speaker's own Yes (the hand-off answer).
          answer={saved ? null : "yes"}
          onUseHelperWords={async () => true}
          helperWordsHost={host}
          startPicking={view === "helpers"}
          firstTake
          walkLook
          pager={{
            index: at,
            total: PARAGRAPHS.length,
            label: SLIDE_LABEL,
            onBack: () => setAt((i) => Math.max(0, i - 1)),
            onNext: () => setAt((i) => Math.min(PARAGRAPHS.length - 1, i + 1)),
          }}
          slideLabel={SLIDE_LABEL}
          onDone={() => setAt((i) => Math.min(PARAGRAPHS.length - 1, i + 1))}
          onClose={() => setOpen(false)}
        />
      ) : null}
    </div>
  );
}
