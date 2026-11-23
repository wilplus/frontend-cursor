"use client";

import type { LoungeMessage } from "@/services/api/loungeMessages";
import type { ReviewRun } from "@/services/api/takeReview";
import { TempoTryBubble } from "./walk/WalkTempo";
import WalkPlayer from "./walk/WalkPlayer";
import { PROJECT_SPEAKER_BUBBLE } from "./walk/InlineWalkHost";

function isAttempt(message: LoungeMessage): boolean {
  const step = message.metadata?.step;
  return message.kind === "walk_step" && message.role === "user" &&
    typeof step === "string" && (step === "tempo:try" || step.startsWith("try:"));
}

const REPLIES = new Set(["improved", "encourage", "thanks", "late", "tempo:comment", "skipped:exVideo"]);

/** Unlike the unloaded receipts, walk rows carry the actual speaker audio
 * and the words the speaker saw. The owner read refreshes their media. */
export default function TakeReviewPracticeHistory({ runs, messages }: {
  runs: readonly ReviewRun[];
  messages: readonly LoungeMessage[];
}) {
  const attempts = messages.filter(isAttempt);
  const drawn = new Set(attempts.map((attempt) => attempt.id ?? attempt.client_id));
  const receipts = runs.filter((run) => !drawn.has(run.id));
  if (attempts.length + receipts.length === 0) return null;
  const rows = messages.filter((message) => isAttempt(message) ||
    (message.kind === "walk_step" && message.role === "bot" && message.body.trim() &&
      REPLIES.has(String(message.metadata?.step))));
  const count = drawn.size + receipts.length;
  return <details open className="mt-2 w-full" data-take-practice-history>
    <summary className="min-h-10 w-fit cursor-pointer py-2 text-[13px] text-muted-foreground">
      {count} practice {count === 1 ? "run" : "runs"}
    </summary>
    <div className="flex flex-col gap-2">
      {receipts.map((run) => <p key={run.id} className="ml-auto rounded-2xl bg-accent px-3 py-2 text-sm">
        {run.kind === "tempo" ? "Sniper" : "Voice practice"} · <time dateTime={run.at}>{new Date(run.at).toLocaleString()}</time>
      </p>)}
      {rows.map((row) => isAttempt(row) ? <PastAttempt key={row.client_id} row={row} /> :
        <p key={row.client_id} className="w-fit max-w-[94%] whitespace-pre-wrap rounded-[18px] bg-muted px-4 py-2.5">{row.body}</p>)}
    </div>
  </details>;
}

function PastAttempt({ row }: { row: LoungeMessage }) {
  const metadata = row.metadata;
  const clip = metadata?.clip as Record<string, unknown> | null;
  const path = metadata?.path;
  if (metadata?.step === "tempo:try" && Array.isArray(path) && path.every((point) => Number.isFinite(point))) {
    return <TempoTryBubble label={row.body} path={path} />;
  }
  const audio = typeof clip?.src === "string" ? clip.src : null;
  return <div className={PROJECT_SPEAKER_BUBBLE + " ml-auto w-fit max-w-[86%] space-y-1.5 rounded-[18px] px-4 py-2.5"}>
    <p className="whitespace-pre-wrap">{row.body}</p>
    {audio ? <WalkPlayer look="bare" seed={row.client_id} src={audio} label={row.body}
      startOffsetMs={typeof clip?.start_ms === "number" ? clip.start_ms : null}
      durationMs={typeof clip?.duration_ms === "number" ? clip.duration_ms : null} /> : null}
  </div>;
}
