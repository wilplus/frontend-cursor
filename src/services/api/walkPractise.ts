import type { ConfidentVoicePracticeOffer, DocumentSuggestion } from "@/services/api/idealText";
import {
  startConfidencePractice,
  uploadConfidencePracticeAttempt,
} from "@/services/api/confidentVoicePractice";
import { checkPracticeAttempt, type PracticeCheckResult } from "@/services/api/practiceCheck";

/* -------------------------------------------------------------------------- */
/*  The Feedback walk's practise, on the wire (build plan D-FW-16).            */
/*                                                                            */
/*  The three calls one practise loop makes, through the BFF routes that       */
/*  already exist: open the practice on the moment (the snippet's own         */
/*  route; an exercise's practise on the exercise the item carries, D-FW-17), */
/*  upload each try (the attempts route) and ask the machine about   */
/*  it (the check route; only `next` and the line's `key` come back, AC-9).   */
/*  Helper words tapped from a praised try are saved by the host, with the    */
/*  paragraph's lock (savePracticeHelperWords). Each call resolves to null on */
/*  any failure: the walk then offers Next or Practise again (O5) and never   */
/*  waits.                                                                    */
/* -------------------------------------------------------------------------- */

type Evidence = NonNullable<DocumentSuggestion["evidence"]>;

/** Where a practise is opened from: the moment's snippet and its evidence,
 *  and the feedback item it answers. */
export type WalkPractiseSource = {
  snippetId: string;
  evidence: Evidence;
  feedbackId: string | null;
  /** The exercise the item carries (the coach's or the library's), for the
   *  practise that follows its video (D-FW-17). Only the served offer. */
  exercise?: ConfidentVoicePracticeOffer | null;
};

/** What is practised: the accepted words of a clearer version, the
 *  exercise the moment carries (after its video, D-FW-17), or the moment
 *  said again. */
export type WalkPractisePassage = { kind: "rewrite"; say: string } | { kind: "exercise" } | { kind: "plain" };

/** One uploaded try: its id for the check, and its number as the server
 *  counts it (a position, never a score). */
export type WalkPractiseTry = { attemptId: string; attempt: number };

export interface WalkPractiseIO<R> {
  open(item: R, passage: WalkPractisePassage): Promise<string | null>;
  upload(practiceId: string, audio: Blob, durationSec: number): Promise<WalkPractiseTry | null>;
  check(practiceId: string, attemptId: string): Promise<PracticeCheckResult | null>;
}

/** A served item's practise source, when it carries one. */
export function suggestionSource(item: DocumentSuggestion): WalkPractiseSource | null {
  if (!item.snippetId || !item.evidence) return null;
  return {
    snippetId: item.snippetId,
    evidence: item.evidence,
    feedbackId: item.id,
    exercise: item.practiceExercise ?? null,
  };
}

/** The walk's practise through the app's own clients. `source` finds the
 *  snippet and evidence an item is practised on. */
export function walkPractiseIO<R>(source: (item: R) => WalkPractiseSource | null): WalkPractiseIO<R> {
  return {
    async open(item, passage) {
      const from = source(item);
      if (!from) return null;
      // An exercise's practise is opened on the exercise the item carries,
      // exactly as the Feedback sheet opens it; with none there is nothing
      // to open (the walk then offers Next or Practise again, O5).
      if (passage.kind === "exercise" && !from.exercise) return null;
      const opened = await startConfidencePractice(
        from.snippetId,
        passage.kind === "exercise" ? (from.exercise ?? null) : null,
        from.evidence,
        null,
        passage.kind === "rewrite"
          ? { kind: "rewrite", passage: passage.say, feedbackId: from.feedbackId }
          : passage.kind === "exercise"
            ? { kind: "exercise" }
            : { kind: "plain", feedbackId: from.feedbackId },
      );
      return opened.ok ? opened.practice.id : null;
    },
    async upload(practiceId, audio, durationSec) {
      const result = await uploadConfidencePracticeAttempt(practiceId, audio, durationSec);
      if (!result.ok) return null;
      const latest = [...result.practice.attempts].sort((a, b) => b.attemptIndex - a.attemptIndex)[0];
      if (!latest) return null;
      return { attemptId: latest.id, attempt: result.practice.attempts.length };
    },
    async check(practiceId, attemptId) {
      const result = await checkPracticeAttempt(practiceId, attemptId);
      return result.ok ? result.data : null;
    },
  };
}
