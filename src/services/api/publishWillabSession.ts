import type { CoachTag } from "@/components/willab/readout";

/* -------------------------------------------------------------------------- */
/*  publishWillabSession — canonical coach authoring payload types              */
/*                                                                            */
/*  Delivery layer: the old per-session direct publish is RETIRED — the coach   */
/*  now saves each take as a checkpoint and delivery happens once at the        */
/*  arc level. Paragraph feedback rides in snippets[]; overallMessage is the     */
/*  separate take-level coach summary.                                           */
/* -------------------------------------------------------------------------- */
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
  /** Optional full snapshot; when present the BE persists every entry with the
   *  checkpoint. */
  snippets?: PublishSnippetState[];
  /** Legacy field from the direct-publish era; the per-take Save never
   *  notifies (delivery happens at the arc publish), so this is unused. */
  notifyClient?: boolean;
}
