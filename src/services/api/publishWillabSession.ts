import type { CoachTag } from "@/components/willab/readout";

/* -------------------------------------------------------------------------- */
/*  publishWillabSession — the coach payload TYPES (split-sink, §14 / §3.9)     */
/*                                                                            */
/*  Delivery layer: the old per-session direct publish is RETIRED — the coach   */
/*  now Saves each take as a checkpoint (saveCoachFeedback.ts, same payload     */
/*  shape) and delivery happens once at the arc-level "Save and Publish full    */
/*  analysis" (arcBatch.publishArc). These types survive as the shared payload  */
/*  contract: coach notes and the R4-8 full-snapshot `snippets`.                */
/* -------------------------------------------------------------------------- */
export interface PublishNote {
  snippet_id: string;
  note: string;
  /** NULLABLE since 2026-08-14 — and null is the normal case. The FE used to
   *  send `cs.tag ?? "strong"`, inventing a coach verdict out of the fact that
   *  someone had typed a note; the backend then ranked on it. There is no
   *  picker for "strong" anywhere in this app, so the FE must not claim one
   *  was used. Send what the coach actually chose, or null. */
  tag: CoachTag | null;
  /** §6b coaching guidance (post-corrections; additive). `when` = how/when to use
   *  it; `examples` = "E.g." lines. Optional — omitted/empty when not authored. */
  when?: string | null;
  examples?: string[];
}
/** The FULL per-snippet coach state, persisted in one shot at Save (R4-8's
 *  save-on-publish became save-on-Save). */
export interface PublishSnippetState {
  id: string;
  note: string;
  tag: CoachTag | null;
  surfaced: boolean;
}

export interface PublishInput {
  sessionId: string;
  overallMessage: string | null;
  notes: PublishNote[];
  /** Optional full snapshot; when present the BE persists every entry with the
   *  checkpoint. */
  snippets?: PublishSnippetState[];
  /** Legacy field from the direct-publish era; the per-take Save never
   *  notifies (delivery happens at the arc publish), so this is unused. */
  notifyClient?: boolean;
}
