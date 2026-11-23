"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useUiLocale } from "@/components/ui/UiLocaleProvider";
import { usePublishedCoach } from "@/lib/willab/chatBuilder/usePublishedCoach";
import type { CoachDefinition } from "@/lib/willab/chatBuilder/types";
import { buildDeckChunks, groupChunksBySlide, withoutUnhearableJudgements } from "@/lib/willab/deckChunks";
import { buildFeedbackWalk, pickedPracticeSteps } from "@/lib/willab/feedbackWalkModel";
import { chatArtifactContent, type ChatArtifactContent } from "@/lib/willab/chatArtifact";
import { postTrackedDecision, type DecisionAction } from "@/lib/willab/idealTextDecisions";
import { MediaRefreshProvider } from "@/lib/media/mediaRefresh";
import type { TempoStretch } from "@/lib/willab/tempoStep";
import { readAiVoice } from "@/services/api/aiVoice";
import { coachMomentFromMetadata, fetchCoachMoment, type CoachMomentReference } from "@/services/api/coachMoment";
import { readPractiseOffered } from "@/services/api/consentChoices";
import { fetchIdealText, type DocumentSuggestion, type IdealTextResult } from "@/services/api/idealText";
import type { LoungeMessage } from "@/services/api/loungeMessages";
import { fetchReviewTempo } from "@/services/api/reviewTempo";
import { readReviewSteps } from "@/services/api/takeReview";
import ChatArtifact from "./chats/ChatArtifact";
import { ArtifactText, StructuredReplyArtifact } from "./chats/ReplyArtifact";
import IdealTextOverlay from "./IdealTextOverlay";
import NativeVideo from "./NativeVideo";
import TakeReviewPracticeHistory, { isSavedPracticeAttempt } from "./TakeReviewPracticeHistory";
import WalkPlayer from "./walk/WalkPlayer";
import { InlineWalkHost } from "./walk/InlineWalkHost";
import { ONE_THING_COPY, WALK_COPY } from "./idealEditCopy";
import { deckReplayItems, practiceKey, rewriteOf, tempoOffered } from "./useDeckFeedbackWalk";

type LiveDocument = Extract<IdealTextResult, { kind: "single" }>;
type PracticePreview = {
  key: string;
  title: string;
  instruction?: string | null;
  video?: string | null;
  practiceId?: string | null;
  rewrite?: DocumentSuggestion;
};
type PracticeContext = { document: LiveDocument; tempo: TempoStretch | null };
type Wording = { decision: DecisionAction; words: string };

function wordingFor(document: LiveDocument, reference: CoachMomentReference): Wording | null {
  for (const suggestion of document.suggestions ?? []) {
    if (suggestion.snippetId !== reference.snippet_id || suggestion.takeSessionId !== reference.take_session_id) continue;
    const rewrite = rewriteOf(suggestion);
    if (!rewrite?.decided) continue;
    const words = (rewrite.decided === "accept" ? rewrite.proposedText : rewrite.quote)?.trim();
    if (words) return { decision: rewrite.decided, words };
  }
  return null;
}

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
      key, title: "Clearer version", instruction: clearer.decided ? null : clearer.say,
      video: clearer.byCoach ? clearer.item.coachAnswer?.videoUrl : null,
      rewrite: !clearer.byCoach && !clearer.decided && clearer.item.snippetId === reference.snippet_id
        ? clearer.item : undefined,
    };
  }
  if (exercise && exercise.item.practiceExercise) {
    return {
      key, title: exercise.item.practiceExercise.title, instruction: exercise.instruction, video: exercise.video,
      practiceId: exercise.item.practiceExercise.practiceId,
    };
  }
  return { key, title: WALK_COPY.aiVoiceLabel, practiceId: practiseItem?.practiceExercise?.practiceId };
}

function PracticeDemo({ preview }: { preview: PracticePreview }) {
  const locale = useUiLocale();
  const [audio, setAudio] = useState<{ src: string; durationMs: number | null } | null>(null);
  const [pending, setPending] = useState(false);
  const label = locale === "pl" ? "Przykład AI" : "AI example";
  const refresh = useCallback(async () => {
    const state = preview.practiceId && !preview.video ? await readAiVoice(preview.practiceId).catch(() => null) : null;
    const clip = state?.ok && state.data.demo === "ai_voice" ? state.data.clip : null;
    setAudio(clip?.state === "ready" && clip.url ? { src: clip.url, durationMs: clip.durationMs } : null);
    setPending(clip?.state === "pending");
    return clip?.state === "pending";
  }, [preview.practiceId, preview.video]);
  useEffect(() => {
    let waiting = true;
    let timer: ReturnType<typeof setTimeout>;
    async function poll(remaining: number) {
      const pending = await refresh();
      if (waiting && pending && remaining > 0) timer = setTimeout(() => void poll(remaining - 1), 2500);
    }
    void poll(8);
    return () => { waiting = false; clearTimeout(timer); };
  }, [refresh]);
  if (preview.video) return <NativeVideo src={preview.video} className="max-h-56 w-full rounded-lg" />;
  if (pending) return <p role="status" className="text-sm text-muted-foreground">
    {locale === "pl" ? "Przygotowujemy przykład AI…" : "Preparing the AI example…"}
  </p>;
  if (!audio) return null;
  return <MediaRefreshProvider payload={audio} refresh={refresh}>
    <p className="text-xs text-muted-foreground">{label}</p>
    <WalkPlayer seed={preview.practiceId ?? ""} src={audio.src} durationMs={audio.durationMs}
      label={label} look="bare" />
  </MediaRefreshProvider>;
}

function useMomentReview(reference: CoachMomentReference, enabled: boolean, refreshKey: number) {
  const coach = usePublishedCoach();
  const [context, setContext] = useState<PracticeContext | null>(null);
  const [history, setHistory] = useState<LoungeMessage[]>([]);
  useEffect(() => {
    if (!enabled) return;
    let current = true;
    void readPracticeContext(reference).then((value) => {
      if (current) setContext(value);
    }).catch(() => { if (current) setContext(null); });
    void readReviewSteps(reference.arc_id, reference.take_session_id).then((value) => {
      if (current) setHistory(value);
    }).catch(() => undefined);
    return () => { current = false; };
  }, [enabled, reference, refreshKey]);
  const preview = useMemo(() => context ? practicePreview(context, reference, coach) : null, [context, reference, coach]);
  const wording = context ? wordingFor(context.document, reference) : null;
  return { preview, wording, history };
}

function relatedPractice(history: LoungeMessage[], snippet: string, practiceId?: string | null): LoungeMessage[] {
  return history.filter((message) => {
    const meta = message.metadata;
    if (message.kind !== "walk_step" || !meta) return false;
    if (typeof meta.snippet_id === "string") return meta.snippet_id === snippet;
    const clip = meta.clip as { snippet_id?: string; practice_id?: string } | undefined;
    return clip?.snippet_id === snippet || (Boolean(practiceId) && clip?.practice_id === practiceId);
  });
}

const PRACTICE_ACTION = "min-h-11 w-fit rounded-lg border border-border px-3 text-sm font-medium hover:bg-accent disabled:opacity-50";
const REPLY_COPY = {
  en: { moment: "Original moment", feedback: "Feedback", saved: "Saved wording",
    kept: "Kept your wording", practice: "Saved practice", failed: "Couldn’t save your choice. Try again." },
  pl: { moment: "Fragment nagrania", feedback: "Informacja zwrotna", saved: "Zapisana wersja",
    kept: "Zachowane słowa", practice: "Zapisana próba", failed: "Nie udało się zapisać. Spróbuj ponownie." },
};

function PracticeActions({ preview, wording, onPractise, onDecision, busy, status }: {
  preview: PracticePreview;
  wording: Wording | null;
  onPractise: () => void;
  onDecision: (item: DocumentSuggestion, decision: DecisionAction) => void;
  busy: boolean;
  status: string | null;
}) {
  const locale = useUiLocale();
  const rewrite = wording ? null : preview.rewrite;
  return <div className="grid gap-2" data-coach-intervention>
    <p className="text-sm font-medium">{preview.title}</p>
    {preview.instruction && !wording ? <ArtifactText text={preview.instruction} /> : null}
    <PracticeDemo key={preview.practiceId ?? preview.video ?? preview.title} preview={preview} />
    {rewrite ? <div className="flex flex-wrap gap-2">
      <button type="button" disabled={busy} className={PRACTICE_ACTION} onClick={() => onDecision(rewrite, "accept")}>
        {locale === "pl" ? "Użyj tej wersji" : "Use this wording"}
      </button>
      <button type="button" disabled={busy} className={PRACTICE_ACTION} onClick={() => onDecision(rewrite, "keep")}>
        {locale === "pl" ? "Zachowaj moje słowa" : "Keep my words"}
      </button>
    </div> : <button type="button" disabled={busy} className={PRACTICE_ACTION} onClick={onPractise}>
      {locale === "pl" ? "Przećwicz" : "Practise"}
    </button>}
    {status ? <p role="status" className="text-sm text-muted-foreground">{status}</p> : null}
  </div>;
}

function CoachMomentReview({ reference, clip, refreshClip, recordingDock, attachment, inline, replayOnly }: {
  reference: CoachMomentReference;
  clip: NonNullable<Awaited<ReturnType<typeof fetchCoachMoment>>>;
  refreshClip: () => Promise<void>;
  recordingDock: HTMLDivElement | null;
  attachment: ChatArtifactContent | null;
  inline: boolean;
  replayOnly: boolean;
}) {
  const copy = REPLY_COPY[useUiLocale()];
  const [open, setOpen] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [practising, setPractising] = useState(false);
  const [unavailable, setUnavailable] = useState(false);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [savedDecision, setSavedDecision] = useState<Wording | null>(null);
  const { preview, wording, history } = useMomentReview(reference, (open || inline) && reference.practise, refreshKey);
  const kept = wording ?? savedDecision;
  const related = relatedPractice(history, reference.snippet_id, preview?.practiceId);
  const attempts = related.some(isSavedPracticeAttempt);
  const savedLabel = kept?.decision === "accept" ? copy.saved : copy.kept;
  const snippet = reference.snippet_id;
  const reviewAt = useMemo(() => ({
    practise: true,
    take: reference.take_session_id,
    snippet,
    practiceKey: preview?.key,
    settledRewrite: kept?.decision,
  }), [reference.take_session_id, snippet, preview?.key, kept?.decision]);
  const closePractice = () => {
    setPractising(false);
    setRefreshKey((n) => n + 1);
  };

  async function decide(item: DocumentSuggestion, decision: DecisionAction) {
    const words = (decision === "accept" ? item.proposedText : item.quote)?.trim();
    if (!words || saving || kept) return;
    setSaving(true);
    setStatus(null);
    const result = await postTrackedDecision(reference.arc_id, item, decision).catch(() => "error");
    if (result === "ok") setSavedDecision({ decision, words });
    else setStatus(copy.failed);
    setSaving(false);
    setRefreshKey((n) => n + 1);
  }

  const moment = <MediaRefreshProvider payload={clip} refresh={refreshClip}>
    <p className="text-xs text-muted-foreground">{copy.moment}</p>
    <WalkPlayer seed={snippet} src={clip.src} startOffsetMs={clip.startOffsetMs}
      durationMs={clip.durationMs} label={copy.moment} look="bare" />
    <ArtifactText text={attachment?.moment ?? preview?.rewrite?.quote ?? undefined} />
  </MediaRefreshProvider>;
  const intervention = <MomentIntervention
    text={attachment?.intervention} practice={unavailable ? null : preview} practising={practising}
    actions={preview ? replayOnly ? <div className="space-y-2">
      <ArtifactText text={preview.instruction ?? undefined} />
      <PracticeDemo preview={preview} />
    </div> : <PracticeActions preview={preview} wording={kept} busy={saving} status={status}
      onPractise={() => setPractising(true)} onDecision={(item, decision) => void decide(item, decision)} /> : null}
    engine={preview && practising ? <InlineWalkHost.Provider value={{ recordingDock, savedSteps: history, conversation: inline }}>
      <IdealTextOverlay arcId={reference.arc_id} reviewTake={reference.take_session_id} reviewTakeIndex={clip.takeIndex}
        initialMode="review" requireFeedbackWalk
        reviewAt={reviewAt}
        onClose={closePractice} onPracticeUnavailable={() => { setUnavailable(true); closePractice(); }} />
    </InlineWalkHost.Provider> : null} />;
  const output = momentOutput(kept, savedLabel, !inline && !practising && attempts ? related : [], attachment?.output);
  const description = kept ? savedLabel : attempts ? copy.practice : attachment?.preview ?? describeClip(clip, copy.moment);
  const interventionContent = attachment?.intervention || (preview && !unavailable) ? intervention : null;
  if (inline) return <div className="min-w-0 space-y-2" data-coach-moment>
    {moment}
    {interventionContent}
    {output}
  </div>;
  return <div className="w-full min-w-0" data-coach-moment>
    <ChatArtifact title={attachment?.title ?? copy.feedback} preview={description} moment={moment}
      intervention={interventionContent} output={output}
      hideMinimise={practising || saving} onOpenChange={(next) => {
        setOpen(next);
        if (!next) { setPractising(false); setUnavailable(false); }
      }} />
  </div>;
}

function describeClip(clip: { takeIndex: number | null }, label: string) {
  return clip.takeIndex === null ? label : `Take ${clip.takeIndex} · ${label}`;
}

function momentOutput(kept: Wording | null, label: string, messages: LoungeMessage[], text?: string) {
  if (!kept && !messages.length && !text) return null;
  return <div className="space-y-1.5">
    {kept ? <div><p className="text-xs text-muted-foreground">{label}</p><ArtifactText text={kept.words} /></div> : null}
    <TakeReviewPracticeHistory messages={messages} runs={[]} />
    <ArtifactText text={text} />
  </div>;
}

function MomentIntervention({ text, practice, practising, actions, engine }: {
  text?: string; practice: PracticePreview | null; practising: boolean;
  actions: React.ReactNode; engine: React.ReactNode;
}) {
  return <div className="space-y-2">
    <ArtifactText text={text} />
    {practice ? (practising ? engine : actions) : null}
  </div>;
}

function CoachMomentCard({ reference, recordingDock, attachment, inline, replayOnly }: {
  reference: CoachMomentReference; recordingDock: HTMLDivElement | null; attachment: ChatArtifactContent | null;
  inline: boolean; replayOnly: boolean;
}) {
  const [clip, setClip] = useState<Awaited<ReturnType<typeof fetchCoachMoment>>>(null);
  const refresh = useCallback(async () => setClip(await fetchCoachMoment(reference).catch(() => null)), [reference]);
  useEffect(() => { void refresh(); }, [refresh]);
  if (!clip) return <StructuredReplyArtifact content={attachment} inline={inline} />;
  return <CoachMomentReview reference={reference} clip={clip} refreshClip={refresh}
    recordingDock={recordingDock} attachment={attachment} inline={inline} replayOnly={replayOnly} />;
}

export default function CoachMoment({ raw, artifact, project, recordingDock = null, inline = false, replayOnly = false }: {
  raw: unknown;
  artifact?: unknown;
  project?: string;
  recordingDock?: HTMLDivElement | null;
  inline?: boolean;
  replayOnly?: boolean;
}) {
  const reference = useMemo(() => coachMomentFromMetadata(raw), [raw]);
  const attachment = chatArtifactContent(artifact);
  if (!reference || (project && project !== reference.arc_id)) return <StructuredReplyArtifact content={attachment} inline={inline} />;
  return <CoachMomentCard key={`${reference.arc_id}:${reference.take_session_id}:${reference.snippet_id}`}
    reference={reference} recordingDock={recordingDock} attachment={attachment} inline={inline} replayOnly={replayOnly} />;
}
