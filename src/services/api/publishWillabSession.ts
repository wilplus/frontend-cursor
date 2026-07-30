import type { CoachTag } from "@/components/willab/readout";
import type { DirectionLabel } from "./coachReview";

/* -------------------------------------------------------------------------- */
/*  publishWillabSession — the coach payload TYPES (split-sink, §14 / §3.9)     */
/*                                                                            */
/*  Delivery layer: the old per-session direct publish is RETIRED — the coach   */
/*  now Saves each take as a checkpoint (saveCoachFeedback.ts, same payload     */
/*  shape) and delivery happens once at the arc-level "Save and Publish full    */
/*  analysis" (arcBatch.publishArc). These types survive as the shared payload  */
/*  contract: `labels` (private direction lane) and `insights_payload` (user    */
/*  notes) stay separate lanes (§2), plus the R4-8 full-snapshot `snippets`.    */
/* -------------------------------------------------------------------------- */

/** The private direction lane's three labels — ONE definition, owned by
 *  coachReview.ts (the module that maps them off the wire). This was a second,
 *  independent copy of the same union until 2026-07-30; two copies of one wire
 *  enum is precisely how the two coach lanes drift apart. The `Direction` name
 *  is kept as the alias because the payload contract below reads better with
 *  it, and nothing outside this module imports the name. */
export type Direction = DirectionLabel;

export interface PublishLabel {
  snippet_id: string;
  value: Direction;
  was_pre_filled?: boolean;
  was_overridden?: boolean;
}
export interface PublishNote {
  snippet_id: string;
  note: string;
  tag: CoachTag;
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
  direction: Direction | null;
  tag: CoachTag | null;
  surfaced: boolean;
}

export interface PublishInput {
  sessionId: string;
  overallMessage: string | null;
  notes: PublishNote[];
  labels: PublishLabel[];
  /** Optional full snapshot; when present the BE persists every entry with the
   *  checkpoint. */
  snippets?: PublishSnippetState[];
  /** Legacy field from the direct-publish era; the per-take Save never
   *  notifies (delivery happens at the arc publish), so this is unused. */
  notifyClient?: boolean;
}
