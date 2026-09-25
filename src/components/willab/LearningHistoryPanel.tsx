"use client";

import { useEffect, useState } from "react";
import {
  fetchLearningHistory,
  type LearningHistory,
  type LearningHistoryEntry,
} from "@/services/api/learningHistory";

/* -------------------------------------------------------------------------- */
/*  THE HISTORY OF LEARNING (founder 2026-09-25).                              */
/*                                                                            */
/*  "just make it a history of learning; there was a video then the practice   */
/*  and they can scroll and actually see how it changed."                      */
/*                                                                            */
/*  This is the surface for the fix that dissolves a bug rather than patching  */
/*  it. A coach's note used to be pinned to an exact phrase and looked up by   */
/*  matching it against the CURRENT document, so rewriting the sentence        */
/*  dropped it — silently, with nobody told on either side. The note was       */
/*  trying to stay current on words the speaker is free to change. Here each   */
/*  version is its own chapter, stamped to when it was written: a later        */
/*  rewrite cannot invalidate a chapter, because the rewrite IS the next one.  */
/*                                                                            */
/*  ⚠ COPY IS NOT YET SIGNED OFF. Every visible string below is a draft for    */
/*  founder review (LIVE LOOP: user-facing copy needs sign-off). They are      */
/*  collected in HISTORY_COPY so a single pass can change them all.            */
/*                                                                            */
/*  AC-9: nothing here is a score, a ratio or a verdict. The entries are       */
/*  facts — these words, this video, these recordings, these dates. Practice   */
/*  is listed as events rather than counted, because a number beside a         */
/*  person's attempts invites being read as a mark.                            */
/* -------------------------------------------------------------------------- */

/** Draft strings, awaiting founder sign-off. */
export const HISTORY_COPY = {
  heading: "How it changed",
  coach: "Your coach showed you",
  practice: "You recorded it again",
  empty: "Nothing to show yet — this fills in as your text changes.",
  begins: "Your history starts here.",
} as const;

function dateLabel(iso: string | null): string | null {
  if (!iso) return null;
  const at = new Date(iso);
  if (Number.isNaN(at.getTime())) return null;
  return at.toLocaleDateString(undefined, {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function versionLabel(version: number | null): string | null {
  return typeof version === "number" ? `Version ${version}.0` : null;
}

function Chapter({ entry }: { entry: LearningHistoryEntry }) {
  const when = dateLabel(entry.createdAt);
  const label = versionLabel(entry.version);
  return (
    <li className="relative pl-6">
      <span
        className="absolute left-0 top-2 h-2.5 w-2.5 rounded-full bg-primary"
        aria-hidden
      />
      <span
        className="absolute bottom-0 left-[4.5px] top-6 w-px bg-border"
        aria-hidden
      />
      <div className="pb-8">
        <p className="text-[12px] uppercase tracking-wide text-muted-foreground">
          {[label, when].filter(Boolean).join(" · ")}
        </p>

        <p className="mt-2 whitespace-pre-wrap text-[15px] leading-relaxed text-foreground">
          {entry.text}
        </p>

        {entry.coach ? (
          <div className="mt-4 rounded-2xl border border-primary/20 p-4">
            <p className="text-[13px] font-medium text-foreground">
              {HISTORY_COPY.coach}
            </p>
            {entry.coach.title ? (
              <p className="mt-1 text-[14px] text-foreground">
                {entry.coach.title}
              </p>
            ) : null}
            {entry.coach.videoRef ? (
              <video
                src={entry.coach.videoRef}
                controls
                playsInline
                preload="metadata"
                className="mt-3 max-h-52 w-full rounded-xl bg-black"
              />
            ) : null}
            {entry.coach.instruction ? (
              <p className="mt-3 text-[14px] leading-relaxed text-muted-foreground">
                {entry.coach.instruction}
              </p>
            ) : null}
          </div>
        ) : null}

        {entry.practice.length ? (
          <div className="mt-4">
            <p className="text-[13px] font-medium text-foreground">
              {HISTORY_COPY.practice}
            </p>
            <ul className="mt-2 flex flex-col gap-1">
              {entry.practice.map((attempt, index) => (
                <li
                  key={`${attempt.attemptIndex ?? index}`}
                  className="text-[13.5px] text-muted-foreground"
                >
                  {dateLabel(attempt.recordedAt) ?? "—"}
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </div>
    </li>
  );
}

export function LearningHistoryPanel({ arcId }: { arcId: string }) {
  const [history, setHistory] = useState<LearningHistory | null>(null);

  useEffect(() => {
    let live = true;
    void fetchLearningHistory(arcId).then((next) => {
      if (live) setHistory(next);
    });
    return () => {
      live = false;
    };
  }, [arcId]);

  if (!history) return null;
  if (!history.entries.length) {
    return (
      <p className="text-[14px] text-muted-foreground">
        {HISTORY_COPY.empty}
      </p>
    );
  }

  return (
    <section>
      <h2 className="text-[17px] font-semibold text-foreground">
        {HISTORY_COPY.heading}
      </h2>
      <ol className="mt-5">
        {history.entries.map((entry, index) => (
          <Chapter key={`${entry.version ?? index}`} entry={entry} />
        ))}
      </ol>
      {/* HISTORY STARTS WHERE THE RECORD STARTS. A project older than the
          snapshot table has a shorter chain, and saying where it begins is
          the difference between a short history and a wrong one. */}
      <p className="pl-6 text-[12.5px] text-muted-foreground">
        {HISTORY_COPY.begins}
      </p>
    </section>
  );
}
