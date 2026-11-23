"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useUiLocale } from "@/components/ui/UiLocaleProvider";
import { usePublishedCoach } from "@/lib/willab/chatBuilder/usePublishedCoach";
import type { CoachDefinition } from "@/lib/willab/chatBuilder/types";
import { buildDeckChunks, groupChunksBySlide, withoutUnhearableJudgements } from "@/lib/willab/deckChunks";
import { buildFeedbackWalk, pickedPracticeSteps } from "@/lib/willab/feedbackWalkModel";
import { MediaRefreshProvider } from "@/lib/media/mediaRefresh";
import type { TempoStretch } from "@/lib/willab/tempoStep";
import { readAiVoice } from "@/services/api/aiVoice";
import { coachMomentFromMetadata, fetchCoachMoment, type CoachMomentReference } from "@/services/api/coachMoment";
import { readPractiseOffered } from "@/services/api/consentChoices";
import { fetchIdealText, type IdealTextResult } from "@/services/api/idealText";
import type { LoungeMessage } from "@/services/api/loungeMessages";
import { fetchReviewTempo } from "@/services/api/reviewTempo";
import { readReviewSteps } from "@/services/api/takeReview";
import IdealTextOverlay from "./IdealTextOverlay";
import NativeVideo from "./NativeVideo";
import WalkPlayer from "./walk/WalkPlayer";
import { InlineWalkHost } from "./walk/InlineWalkHost";
import { ONE_THING_COPY, WALK_COPY } from "./idealEditCopy";
import { deckReplayItems, practiceKey, tempoOffered } from "./useDeckFeedbackWalk";

type LiveDocument = Extract<IdealTextResult, { kind: "single" }>;
type PracticePreview = {
  key: string;
  title: string;
  instruction?: string | null;
  video?: string | null;
  practiceId?: string | null;
};
type PracticeContext = { document: LiveDocument; tempo: TempoStretch | null };

async function readPracticeContext({ arc_id, take_session_id }: CoachMomentReference): Promise<PracticeContext | null> {
  if (!await readPractiseOffered()) return null;
  const document = await fetchIdealText(arc_id);
  if (document.kind !== "single" || document.latestTakeSessionId !== take_session_id || document.feedbackFailed) return null;
  const tempo = await fetchReviewTempo(arc_id, take_session_id);
  if (tempo === "failed" && document.suggestions?.some((item) => item.oneFix === "tempo")) return null;
  return { document, tempo: tempo === "failed" ? null : tempo };
}

function practicePreview(
  { document, tempo }: PracticeContext, reference: CoachMomentReference, coach: CoachDefinition | null,
): PracticePreview | null {
  const suggestions = withoutUnhearableJudgements(
    (document.suggestions ?? []).filter((item) => item.takeSessionId === reference.take_session_id),
  );
  const chunks = buildDeckChunks(document.ideal.text, document.parts, suggestions);
  const slides = groupChunksBySlide(chunks, document.pieces?.map((piece) => piece.slideIndex ?? null),
    null, document.pieces?.map((piece) => piece.partId ?? null));
  if (!slides.ok) return null;
  const byId = new Map(suggestions.map((item) => [item.id, item]));
  const items = deckReplayItems(chunks, slides.groups, (chunk) => [
    ...chunk.pendingIds, ...(chunk.decidedIds ?? []),
  ].flatMap((id) => {
    const item = byId.get(id);
    return item ? [item] : [];
  }), () => null);
  const model = buildFeedbackWalk({
    items, practiceOn: true, coachNote: false, guest: false, interventions: tempoOffered(tempo, items), coach,
  });
  const steps = pickedPracticeSteps(model, reference.snippet_id, tempo?.snippetId);
  const first = steps[0];
  if (!first) return null;
  const key = practiceKey(model, first);
  if (first.key === "tempo" && tempo) {
    return { key, title: "Sniper", instruction: tempo.reading === "rushed" ? ONE_THING_COPY.letItBreathe : ONE_THING_COPY.keepItMoving };
  }
  if (first.moment == null || !steps.some((step) => step.key === "practise")) return null;
  const { clearer, exercise, practiseItem } = model.moments[first.moment];
  if (first.key === "clearer" && clearer) {
    return {
      key, title: "Clearer version", instruction: clearer.decided === "keep" ? null : clearer.say,
      video: clearer.byCoach ? clearer.item.coachAnswer?.videoUrl : null,
    };
  }
  if (exercise && exercise.item.practiceExercise) {
    return { key, title: exercise.item.practiceExercise.title, instruction: exercise.instruction, video: exercise.video };
  }
  return { key, title: WALK_COPY.aiVoiceLabel, practiceId: practiseItem?.practiceExercise?.practiceId };
}

function PracticeDemo({ preview }: { preview: PracticePreview }) {
  const [audio, setAudio] = useState<{ src: string; durationMs: number | null } | null>(null);
  const refresh = useCallback(async () => {
    const state = preview.practiceId ? await readAiVoice(preview.practiceId) : null;
    const clip = state?.ok && state.data.demo === "ai_voice" ? state.data.clip : null;
    setAudio(clip?.state === "ready" && clip.url ? { src: clip.url, durationMs: clip.durationMs } : null);
  }, [preview.practiceId]);
  useEffect(() => { void refresh(); }, [refresh]);
  if (preview.video) return <NativeVideo src={preview.video} className="max-h-56 w-full rounded-lg" />;
  if (!audio) return null;
  return <MediaRefreshProvider payload={audio} refresh={refresh}>
    <WalkPlayer seed={preview.practiceId ?? ""} src={audio.src} durationMs={audio.durationMs}
      label={preview.title} look="bare" />
  </MediaRefreshProvider>;
}

function CoachMomentPractice({ reference, takeIndex, recordingDock }: {
  reference: CoachMomentReference;
  takeIndex: number | null;
  recordingDock: HTMLDivElement | null;
}) {
  const locale = useUiLocale();
  const coach = usePublishedCoach();
  const [context, setContext] = useState<PracticeContext | null>(null);
  const [opened, setOpened] = useState<{ key: string; savedSteps: LoungeMessage[] } | null>(null);
  const [starting, setStarting] = useState(false);
  useEffect(() => {
    let current = true;
    void readPracticeContext(reference).then((value) => {
      if (current) setContext(value);
    }).catch(() => undefined);
    return () => { current = false; };
  }, [reference]);
  const preview = useMemo(() => context ? practicePreview(context, reference, coach) : null, [context, reference, coach]);
  if (!preview) return null;

  async function practise(key: string) {
    setStarting(true);
    const history = await readReviewSteps(reference.arc_id, reference.take_session_id).catch(() => []);
    setOpened({ key, savedSteps: history });
    setStarting(false);
  }

  return <div className="grid gap-2 border-t border-border pt-2.5" data-coach-intervention>
    {opened === null ? <>
      <p className="text-sm font-medium">{preview.title}</p>
      {preview.instruction ? <p className="text-sm">{preview.instruction}</p> : null}
      <PracticeDemo key={preview.practiceId ?? preview.video ?? preview.title} preview={preview} />
      <button type="button" disabled={starting} onClick={() => void practise(preview.key)}
        className="min-h-11 justify-self-start rounded-lg border border-border px-3 text-sm font-medium hover:bg-background">
        {locale === "pl" ? "Przećwicz" : "Practise"}
      </button>
    </> : <InlineWalkHost.Provider value={{ recordingDock, savedSteps: opened.savedSteps }}>
      <IdealTextOverlay arcId={reference.arc_id} reviewTake={reference.take_session_id} reviewTakeIndex={takeIndex}
        initialMode="review" requireFeedbackWalk
        reviewAt={{ practise: true, take: reference.take_session_id, snippet: reference.snippet_id, practiceKey: opened.key }}
        onClose={() => setOpened(null)} onPracticeUnavailable={() => { setOpened(null); setContext(null); }} />
    </InlineWalkHost.Provider>}
  </div>;
}

function CoachMomentCard({ reference, recordingDock }: {
  reference: CoachMomentReference; recordingDock: HTMLDivElement | null;
}) {
  const locale = useUiLocale();
  const [clip, setClip] = useState<Awaited<ReturnType<typeof fetchCoachMoment>>>(null);
  const refresh = useCallback(async () => setClip(await fetchCoachMoment(reference).catch(() => null)), [reference]);
  useEffect(() => { void refresh(); }, [refresh]);
  if (!clip) return null;
  const label = locale === "pl" ? "Fragment nagrania" : "Original moment";
  return <div className="mr-auto grid w-full max-w-[26rem] gap-2 rounded-[18px] bg-muted px-4 py-2.5" data-coach-moment>
    <MediaRefreshProvider payload={clip} refresh={refresh}>
      <p className="text-sm text-muted-foreground">{label}</p>
      <WalkPlayer seed={reference.snippet_id} src={clip.src} startOffsetMs={clip.startOffsetMs}
        durationMs={clip.durationMs} label={label} look="bare" />
    </MediaRefreshProvider>
    {reference.practise && <CoachMomentPractice reference={reference} takeIndex={clip.takeIndex} recordingDock={recordingDock} />}
  </div>;
}

export default function CoachMoment({ raw, project, recordingDock = null }: {
  raw: unknown;
  project?: string;
  recordingDock?: HTMLDivElement | null;
}) {
  const reference = useMemo(() => coachMomentFromMetadata(raw), [raw]);
  if (!reference || (project && project !== reference.arc_id)) return null;
  return <CoachMomentCard key={`${reference.arc_id}:${reference.take_session_id}:${reference.snippet_id}`}
    reference={reference} recordingDock={recordingDock} />;
}
