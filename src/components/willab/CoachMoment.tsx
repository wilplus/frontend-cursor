"use client";

import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { useUiLocale } from "@/components/ui/UiLocaleProvider";
import { usePublishedCoach } from "@/lib/willab/chatBuilder/usePublishedCoach";
import type { CoachDefinition } from "@/lib/willab/chatBuilder/types";
import { buildDeckChunks, groupChunksBySlide, withoutUnhearableJudgements } from "@/lib/willab/deckChunks";
import { buildFeedbackWalk, pickedPracticeSteps } from "@/lib/willab/feedbackWalkModel";
import type { ChatArtifactContent } from "@/lib/willab/chatArtifact";
import { postTrackedDecision, type DecisionAction } from "@/lib/willab/idealTextDecisions";
import { MediaRefreshProvider } from "@/lib/media/mediaRefresh";
import type { TempoStretch } from "@/lib/willab/tempoStep";
import { ensureAiVoice, noteAiVoicePlay, readAiVoice } from "@/services/api/aiVoice";
import { fetchCoachMoment, prepareCoachMomentAudio, type CoachMomentReference } from "@/services/api/coachMoment";
import { readPractiseOffered } from "@/services/api/consentChoices";
import { fetchIdealText, type DocumentSuggestion, type IdealTextResult } from "@/services/api/idealText";
import type { LoungeMessage } from "@/services/api/loungeMessages";
import { fetchReviewTempo } from "@/services/api/reviewTempo";
import { suggestionSource, walkPractiseIO } from "@/services/api/walkPractise";
import { readReviewSteps } from "@/services/api/takeReview";
import { ArtifactText, StructuredReplyArtifact } from "./chats/ReplyArtifact";
import IdealTextOverlay from "./IdealTextOverlay";
import NativeVideo from "./NativeVideo";
import TakeReviewPracticeHistory from "./TakeReviewPracticeHistory";
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
  const steps = pickedPracticeSteps(model, reference.snippet_id, tempo?.snippetId,
    (step) => reference.intervention !== "sniper" || step.key === "tempo");
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

function PracticeDemo({ preview, requested = false }: { preview: PracticePreview; requested?: boolean }) {
  if (preview.video) return <NativeVideo src={preview.video} className="max-h-56 w-full rounded-lg" />;
  return preview.practiceId ? <MomentAiAudio practiceId={preview.practiceId} requested={requested} /> : null;
}

function MomentAiAudio({ practiceId, requested, chatRetryId, onPlayable }: {
  practiceId: string; requested: boolean; chatRetryId?: string; onPlayable?: (ready: boolean) => void;
}) {
  const locale = useUiLocale();
  const [audio, setAudio] = useState<{ src: string; durationMs: number | null } | null>(null);
  const [pending, setPending] = useState(requested);
  const label = locale === "pl" ? "Przykład AI" : "AI example";
  const read = useCallback(async (prepare = false) => {
    try {
      const current = chatRetryId ? await readAiVoice(practiceId, chatRetryId) : await readAiVoice(practiceId);
      if (!chatRetryId && prepare && current.ok && (!current.data.clip || current.data.clip.state === "unavailable")) {
        return await ensureAiVoice(practiceId);
      }
      return current;
    } catch {
      return null;
    }
  }, [practiceId, chatRetryId]);
  const show = useCallback((state: Awaited<ReturnType<typeof read>>) => {
    const clip = state?.ok && state.data.demo === "ai_voice" ? state.data.clip : null;
    const playable = clip?.state === "ready" && clip.url ? { src: clip.url, durationMs: clip.durationMs } : null;
    setAudio(playable);
    onPlayable?.(Boolean(playable));
    setPending(clip?.state === "pending");
    return clip?.state === "pending";
  }, [onPlayable]);
  useEffect(() => {
    let active = true;
    let timer: ReturnType<typeof setTimeout>;
    async function poll(remaining: number, prepare = false) {
      const state = await read(prepare);
      if (!active) return;
      if (show(state) && remaining > 0) timer = setTimeout(() => void poll(remaining - 1), 2500);
    }
    void poll(requested ? 120 : 30, requested);
    return () => { active = false; clearTimeout(timer); };
  }, [read, show, requested]);
  const refresh = useCallback(async () => { show(await read()); }, [read, show]);
  if (pending) return <p role="status" className="text-sm text-muted-foreground">
    {locale === "pl" ? "Przygotowujemy przykład AI…" : "Preparing the AI example…"}
  </p>;
  if (!audio) return requested ? <InterventionUnavailable tool="ai_audio" /> : null;
  return <MediaRefreshProvider payload={audio} refresh={refresh}>
    <p className="text-xs text-muted-foreground">{label}</p>
    <div onClickCapture={chatRetryId ? undefined : () => void noteAiVoicePlay(practiceId)}>
      <WalkPlayer seed={chatRetryId ?? practiceId} src={audio.src} durationMs={audio.durationMs} label={label} look="bare" />
    </div>
  </MediaRefreshProvider>;
}

const openMomentPractice = walkPractiseIO(suggestionSource).open;

export function RequestedAiAudio({ reference, existing, item, chatRetryId, replyId, onPlayable }: {
  reference: CoachMomentReference;
  existing: string | null;
  item?: DocumentSuggestion;
  chatRetryId?: string;
  replyId?: string;
  onPlayable?: (ready: boolean) => void;
}) {
  const [practiceId, setPracticeId] = useState<string | null | undefined>(undefined);
  useEffect(() => {
    let active = true;
    async function find() {
      if (!await readPractiseOffered()) return null;
      if (existing) return existing;
      if (!item) {
        const prepared = replyId ? await prepareCoachMomentAudio(reference, replyId) : await prepareCoachMomentAudio(reference);
        return prepared.ok ? prepared.data : null;
      }
      const servedExercise = item.practiceExercise && (item.openCard === "exercise" || item.practicePrompt);
      return openMomentPractice(item, { kind: servedExercise ? "exercise" : "plain" });
    }
    void find().catch(() => null).then((id) => { if (active) setPracticeId(id); });
    return () => { active = false; };
  }, [existing, item, reference, replyId]);
  const locale = useUiLocale();
  if (practiceId === undefined) return <p role="status" className="text-sm text-muted-foreground">
    {locale === "pl" ? "Przygotowujemy przykład AI…" : "Preparing the AI example…"}
  </p>;
  return practiceId ? <MomentAiAudio practiceId={practiceId} requested chatRetryId={chatRetryId} onPlayable={onPlayable} />
    : <InterventionUnavailable tool="ai_audio" />;
}

const INTERVENTION_UNAVAILABLE = {
  ai_audio: { en: "AI audio is unavailable for this fragment.", pl: "Przykład AI dla tego fragmentu jest niedostępny." },
  sniper: { en: "Sniper is unavailable for this fragment.", pl: "Sniper dla tego fragmentu jest niedostępny." },
  coach_video: { en: "A coach video is unavailable for this fragment.", pl: "Wideo trenera jest niedostępne dla tego fragmentu." },
};

function InterventionUnavailable({ tool }: { tool: NonNullable<CoachMomentReference["intervention"]> }) {
  return <p role="status" className="text-sm text-muted-foreground">{INTERVENTION_UNAVAILABLE[tool][useUiLocale()]}</p>;
}

function namedPreview(preview: PracticePreview | null, kind: CoachMomentReference["intervention"]) {
  if (kind === "ai_audio") return null;
  if (kind === "sniper" && preview?.key !== "tempo") return null;
  if (kind === "coach_video" && !preview?.video) return null;
  return preview;
}

function useMomentReview(reference: CoachMomentReference, enabled: boolean, refreshKey: number) {
  const coach = usePublishedCoach();
  const [context, setContext] = useState<PracticeContext | null>();
  const [permitted, setPermitted] = useState(false);
  const [history, setHistory] = useState<LoungeMessage[]>([]);
  useEffect(() => {
    if (!enabled) return;
    let current = true;
    void readPractiseOffered().then((allowed) => {
      if (current) setPermitted(allowed);
      return allowed ? readPracticeContext(reference) : null;
    }).then((value) => {
      if (current) setContext(value);
    }).catch(() => { if (current) setContext(null); });
    void readReviewSteps(reference.arc_id, reference.take_session_id).then((value) => {
      if (current) setHistory(value);
    }).catch(() => undefined);
    return () => { current = false; };
  }, [enabled, reference, refreshKey]);
  const preview = useMemo(() => enabled && context && reference.intervention !== "ai_audio"
    ? namedPreview(practicePreview(context, reference, coach), reference.intervention) : null,
    [enabled, context, reference, coach]);
  const wording = enabled && context ? wordingFor(context.document, reference) : null;
  const aiSource = reference.intervention === "ai_audio" ? context?.document.suggestions?.find((item) =>
    item.snippetId === reference.snippet_id && item.takeSessionId === reference.take_session_id &&
    item.evidence?.takeSessionId === reference.take_session_id && item.evidence.projectId === reference.arc_id) : undefined;
  return { preview, wording, history, aiSource, permitted, loaded: context !== undefined };
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
  en: { moment: "Original moment", saved: "Saved wording",
    kept: "Kept your wording", failed: "Couldn’t save your choice. Try again." },
  pl: { moment: "Fragment nagrania", saved: "Zapisana wersja",
    kept: "Zachowane słowa", failed: "Nie udało się zapisać. Spróbuj ponownie." },
};

function MomentPractice({ preview, wording, onPractise, onDecision, busy, status, replayOnly }: {
  preview: PracticePreview;
  wording: Wording | null;
  onPractise: () => void;
  onDecision: (item: DocumentSuggestion, decision: DecisionAction) => void;
  busy: boolean;
  status: string | null;
  replayOnly: boolean;
}) {
  const locale = useUiLocale();
  const rewrite = wording ? null : preview.rewrite;
  return <div className="grid gap-2">
    <p className="text-sm font-medium">{preview.title}</p>
    {preview.instruction && !wording ? <ArtifactText text={preview.instruction} /> : null}
    <PracticeDemo key={preview.practiceId ?? preview.video ?? preview.title} preview={preview} />
    {replayOnly ? null : rewrite ? <div className="flex flex-wrap gap-2">
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

function MomentExample({ reference, existing, item, loaded, hasPractice, canOfferAudio }: {
  reference: CoachMomentReference;
  existing: string | null;
  item?: DocumentSuggestion;
  loaded: boolean;
  hasPractice: boolean;
  canOfferAudio: boolean;
}) {
  const [audioRequested, setAudioRequested] = useState(false);
  const locale = useUiLocale();
  if (reference.intervention === "ai_audio" || audioRequested) return loaded || existing
    ? <RequestedAiAudio reference={reference} existing={existing} item={item} /> : null;
  if (reference.intervention) return loaded && !hasPractice
    ? <InterventionUnavailable tool={reference.intervention} /> : null;
  if (!loaded || !canOfferAudio || hasPractice) return null;
  return <button type="button" className={PRACTICE_ACTION} onClick={() => setAudioRequested(true)}>
    {locale === "pl" ? "Posłuchaj przykładu AI" : "Hear an AI example"}
  </button>;
}

function CoachMomentReview({ reference, clip, refreshClip, recordingDock, attachment, example, includeHistory, replayOnly }: {
  reference: CoachMomentReference;
  clip: NonNullable<Awaited<ReturnType<typeof fetchCoachMoment>>>;
  refreshClip: () => Promise<void>;
  recordingDock: HTMLDivElement | null;
  attachment: ChatArtifactContent | null;
  example?: ReactNode;
  includeHistory: boolean;
  replayOnly: boolean;
}) {
  const copy = REPLY_COPY[useUiLocale()];
  const [refreshKey, setRefreshKey] = useState(0);
  const [practising, setPractising] = useState(false);
  const [unavailable, setUnavailable] = useState(false);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [savedDecision, setSavedDecision] = useState<Wording | null>(null);
  const { preview, wording, history, loaded, aiSource, permitted } = useMomentReview(reference, reference.practise, refreshKey);
  const practice = unavailable ? null : preview;
  const running = practising && Boolean(practice);
  const kept = wording ?? savedDecision;
  const related = includeHistory && !running ? relatedPractice(history, reference.snippet_id, preview?.practiceId) : [];
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

  const moment = reference.playback === false
    ? <ArtifactText text={attachment?.moment ?? preview?.rewrite?.quote ?? undefined} />
    : <MediaRefreshProvider payload={clip} refresh={refreshClip}>
    <p className="text-xs text-muted-foreground">{copy.moment}</p>
    <WalkPlayer seed={snippet} src={clip.src} startOffsetMs={clip.startOffsetMs}
      durationMs={clip.durationMs} label={copy.moment} look="bare" />
    <ArtifactText text={attachment?.moment ?? preview?.rewrite?.quote ?? undefined} />
  </MediaRefreshProvider>;
  return <div className="min-w-0 space-y-2" data-coach-moment>
    {moment}
    {attachment?.intervention || example || practice || reference.intervention ? <div data-coach-intervention className="space-y-2">
      <ArtifactText text={attachment?.intervention} />
      {running ? (
        <InlineWalkHost.Provider value={{ recordingDock, savedSteps: history, conversation: true }}>
          <IdealTextOverlay arcId={reference.arc_id} reviewTake={reference.take_session_id} reviewTakeIndex={clip.takeIndex}
            initialMode="review" requireFeedbackWalk reviewAt={reviewAt}
            onClose={closePractice} onPracticeUnavailable={() => { setUnavailable(true); closePractice(); }} />
        </InlineWalkHost.Provider>
      ) : practice ? (
        <MomentPractice preview={practice} wording={kept} busy={saving} status={status} replayOnly={replayOnly}
          onPractise={() => setPractising(true)} onDecision={(item, decision) => void decide(item, decision)} />
      ) : null}
      {example ?? <MomentExample reference={reference} existing={clip.practiceId} item={aiSource}
        loaded={loaded} hasPractice={Boolean(practice)}
        canOfferAudio={permitted && !replayOnly && Boolean(attachment?.intervention)} />}
    </div> : null}
    {momentOutput(kept, savedLabel, related, attachment?.output)}
  </div>;
}

function momentOutput(kept: Wording | null, label: string, messages: LoungeMessage[], text?: string) {
  if (!kept && !messages.length && !text) return null;
  return <div className="space-y-1.5" data-coach-moment-output>
    {kept ? <div><p className="text-xs text-muted-foreground">{label}</p><ArtifactText text={kept.words} /></div> : null}
    <TakeReviewPracticeHistory messages={messages} runs={[]} />
    <ArtifactText text={text} />
  </div>;
}

function CoachMomentCard({ reference, recordingDock, attachment, example, includeHistory, replayOnly }: {
  reference: CoachMomentReference; recordingDock: HTMLDivElement | null; attachment: ChatArtifactContent | null;
  example?: ReactNode;
  includeHistory: boolean; replayOnly: boolean;
}) {
  const [clip, setClip] = useState<Awaited<ReturnType<typeof fetchCoachMoment>>>(null);
  const refresh = useCallback(async () => setClip(await fetchCoachMoment(reference).catch(() => null)), [reference]);
  useEffect(() => { void refresh(); }, [refresh]);
  if (!clip) return <StructuredReplyArtifact inline content={attachment} example={example} />;
  return <CoachMomentReview reference={reference} clip={clip} refreshClip={refresh}
    recordingDock={recordingDock} attachment={attachment} example={example} includeHistory={includeHistory} replayOnly={replayOnly} />;
}

export default function CoachMoment({
  reference, artifact = null, example, project, recordingDock = null, includeHistory = false, replayOnly = false,
}: {
  reference: CoachMomentReference | null;
  artifact?: ChatArtifactContent | null;
  example?: ReactNode;
  project?: string;
  recordingDock?: HTMLDivElement | null;
  includeHistory?: boolean;
  replayOnly?: boolean;
}) {
  if (!reference || (project && project !== reference.arc_id) ||
      (reference.playback === false && !reference.practise && !reference.intervention)) {
    return <StructuredReplyArtifact inline content={artifact} example={example} />;
  }
  return <CoachMomentCard key={`${reference.arc_id}:${reference.take_session_id}:${reference.snippet_id}:${reference.intervention ?? ""}`}
    reference={reference} recordingDock={recordingDock} attachment={artifact} example={example} includeHistory={includeHistory} replayOnly={replayOnly} />;
}
