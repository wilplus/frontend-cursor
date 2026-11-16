"use client";

import { useMemo, useState } from "react";
import FeedbackWalkCard from "../../FeedbackWalkCard";
import ProcessingWait from "../../ProcessingWait";
import { planForWalk } from "@/lib/willab/chatBuilder/runtime";
import { idealEmptyName, processingLabels, recordLabel, tryCopy } from "@/lib/willab/chatBuilder/screenCopy";
import type { CoachDefinition } from "@/lib/willab/chatBuilder/types";
import { walkMoments } from "@/lib/willab/walkPlan";
import type { PracticeChunk } from "@/services/api/trainings";

const FIXTURE = [{ start: 0, slide: 0, blockId: "preview", tiered: true, green: true, walkSlot: "strongest" as const, oneFix: "tempo" as const }];

const CHUNK: PracticeChunk = {
  startSlide: 1,
  endSlide: 5,
  attempts: 1,
  deliveryLabel: "Not yet there",
  latestSessionId: "preview",
};

/** Live is a fixture Take. It does not record, save, or spend a token. */
export default function CoachLive({ doc }: { doc: CoachDefinition }) {
  const [walkOpen, setWalkOpen] = useState(false);
  const plan = useMemo(
    () => planForWalk(doc, { moments: walkMoments(FIXTURE), coachNote: false, practiceOn: true, guest: false }),
    [doc],
  );
  const shown = new Set<string>(plan.map((s) => s.key));
  const lines = doc.walk.steps.filter((s) => s.fixed && shown.has(s.key)).map((s) => s.fixed);
  const theme = doc.theme.color;
  const tries = tryCopy(doc);
  return (
    <div
      data-coach-live=""
      className="flex min-h-0 flex-1 flex-col"
      style={{ background: theme.background, color: theme.foreground, ["--coach-primary" as string]: theme.primary }}
    >
      <p data-coach-preview="" className="px-4 pt-3 text-[12px]" style={{ color: theme.mutedForeground }}>Preview</p>
      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3">
        <div className="mx-auto w-full max-w-[384px]">
          <FeedbackWalkCard
            title={doc.chat.spec}
            progress={10}
            chunks={[CHUNK]}
            showProgress={doc.shell.historyCard.showProgress}
            onFeedback={() => setWalkOpen(true)}
            onIdealText={() => setWalkOpen(false)}
          />
        </div>
        <div data-coach-states="" className="mx-auto mt-4 flex w-full max-w-[520px] flex-col gap-2 text-[15px]">
          <p data-coach-record="">{recordLabel(doc, false)}</p>
          <p data-coach-record-again="">{recordLabel(doc, true)}</p>
          <p data-coach-ideal="">{idealEmptyName(doc)}</p>
          <p data-coach-try="">{tries.landed}</p>
          <p data-coach-try="">{tries.onceMore}</p>
          <p data-coach-try="">{tries.takeItWithYou}</p>
          <ProcessingWait labels={processingLabels(doc)} />
        </div>
        {walkOpen ? (
          <div data-coach-walk="" className="mx-auto mt-4 flex w-full max-w-[520px] flex-col gap-2">
            {lines.map((line) => (
              <p key={line} className="max-w-[88%] rounded-[16px] px-3 py-2 text-[15px]" style={{ background: theme.muted }}>{line}</p>
            ))}
          </div>
        ) : null}
      </div>
      <div className="shrink-0 px-4 pb-[max(12px,env(safe-area-inset-bottom))] pt-3">
        <button type="button" disabled className="flex min-h-12 w-full items-center justify-center rounded-full text-[15px] text-white" style={{ background: theme.foreground }}>
          {doc.shell.primaryAction.afterPractice}
        </button>
      </div>
    </div>
  );
}
