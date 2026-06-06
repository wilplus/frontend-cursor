import type {
  Direction,
  PublishLabel,
  PublishNote,
} from "@/services/api/publishWillabSession";
import type { CoachTag } from "./readout";

/* -------------------------------------------------------------------------- */
/*  coachAuthoring — the §14 publish floor + split-sink payload (pure)         */
/*                                                                            */
/*  Extracted from CoachAuthoring so the publish gate and payload shape are     */
/*  unit-tested. Split-sink: every snippet → a private direction label; only    */
/*  noted+tagged snippets → a user note. The two lanes never cross.           */
/* -------------------------------------------------------------------------- */

export interface SnippetAuthor {
  label: Direction | null;
  note: string;
  tag: CoachTag | null;
  /** §6b coaching (post-corrections). `when` = how/when to use it; `examples` is
   *  raw textarea text (one example per line) — split into lines at publish. */
  when: string;
  examples: string;
}

/** Publish floor (§14): every snippet labeled AND ≥1 carries a note + tag. */
export function publishGate(
  snippetIds: string[],
  authors: Record<string, SnippetAuthor>
): { allLabeled: boolean; hasNotePlusTag: boolean; canPublish: boolean } {
  if (snippetIds.length === 0) {
    return { allLabeled: false, hasNotePlusTag: false, canPublish: false };
  }
  const allLabeled = snippetIds.every((id) => authors[id]?.label != null);
  const hasNotePlusTag = snippetIds.some(
    (id) => Boolean(authors[id]?.note.trim()) && authors[id]?.tag != null
  );
  return { allLabeled, hasNotePlusTag, canPublish: allLabeled && hasNotePlusTag };
}

/**
 * Build the split-sink publish payload — call only when publishGate passes:
 *   labels: EVERY snippet (private direction lane)
 *   notes:  ONLY noted+tagged snippets (user lane; tag is independent of label)
 *   overallMessage: trimmed, or null when empty (optional, §3.10)
 */
export function buildPublishPayload(
  snippetIds: string[],
  authors: Record<string, SnippetAuthor>,
  overall: string
): { labels: PublishLabel[]; notes: PublishNote[]; overallMessage: string | null } {
  const labels: PublishLabel[] = snippetIds.map((id) => ({
    snippet_id: id,
    value: authors[id]!.label as Direction,
    was_pre_filled: false,
    was_overridden: false,
  }));
  const notes: PublishNote[] = snippetIds
    .filter((id) => authors[id]?.note.trim() && authors[id]?.tag != null)
    .map((id) => {
      const a = authors[id]!;
      const examples = a.examples
        .split("\n")
        .map((e) => e.trim())
        .filter((e) => e.length > 0);
      return {
        snippet_id: id,
        note: a.note.trim(),
        tag: a.tag as CoachTag,
        when: a.when.trim() || null,
        examples,
      };
    });
  return { labels, notes, overallMessage: overall.trim() || null };
}
