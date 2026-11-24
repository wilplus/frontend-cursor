"use client";

import { useEffect, useMemo, useRef, useState, type MutableRefObject, type ReactNode } from "react";
import { fetchArcFeedback, type FeedbackKeyMoment } from "@/services/api/arcFeedback";
import { fetchIdealText, type DocumentSuggestion, type IdealTextResult } from "@/services/api/idealText";
import { fetchIdealTextRevisions, type IdealTextRevision } from "@/services/api/blockVariants";
import { fetchReviewTempo } from "@/services/api/reviewTempo";
import { useUiLocale } from "@/components/ui/UiLocaleProvider";
import { stableUuid } from "@/lib/willab/walkThread";
import { coachMomentFromMetadata } from "@/services/api/coachMoment";
import { readReviewCopy, readReviewSteps, saveReviewCopy, type ReviewCopy, type ReviewRevision, type ReviewRun } from "@/services/api/takeReview";
import type { TrainingArc, TrainingTake } from "@/services/api/trainings";
import type { ChatQueryArgs } from "@/services/api/chatQuery";
import type { LoungeMessage, LoungeMessageDraft } from "@/services/api/loungeMessages";
import { mergeTakeExchange, offersIdealText } from "@/lib/willab/takeExchange";
import { isPersistedTerminalReplay, orderedProjectMessages } from "@/lib/willab/projectChat";
import { WILLAB_CONTENT_RAIL } from "@/lib/willab/layout";
import IdealTextOverlay from "./IdealTextOverlay";
import { ArchivedIdealText } from "./IdealTextPastVersion";
import TypingDots from "./TypingDots";
import { useBackDismiss } from "./useBackDismiss";
import WalkPlayer from "./walk/WalkPlayer";
import { useBestSaid, useWalkVoiceOn } from "./walk/useWalkVoice";
import { InlineWalkHost, scrollWithinProject } from "./walk/InlineWalkHost";
import { isSavedPracticeAttempt } from "./TakeReviewPracticeHistory";
import { ConversationBubble } from "./chats/TakeConversation";
import TakeConversationMessage from "./chats/TakeConversationMessage";

export type ReviewFocus = NonNullable<NonNullable<ChatQueryArgs["presentationContext"]>["review_focus"]>;
export type TakeReviewTarget = {
  take: TrainingTake;
  focus: ReviewFocus;
  /** An archived exchange can be played back and discussed in the composer. */
  replay?: boolean;
  /** The current Take is unfolding in the chat. */
  live?: boolean;
  quote?: string;
  /** The reply whose link opened this view. Later replies can change the composer context. */
  openedFromAt?: string;
};
export type ReviewExit = (afterSave: () => void) => void;
type Step = ReviewFocus["step"];
export const REVIEW_STEPS = [
  { step: "feedback", label: "Feedback" },
  { step: "practise", label: "Practise" },
  { step: "ideal", label: "Ideal text" },
] as const;

const BUTTON = "min-h-11 rounded-lg border border-border px-3 text-sm font-medium hover:bg-muted";
const LINK = "min-h-11 text-sm text-muted-foreground hover:underline";

type ReviewEvidence = {
  moment: FeedbackKeyMoment | null;
  strength?: FeedbackKeyMoment | null;
  activity: string | null;
  instruction?: string | null;
};
type Artifact = {
  evidence: ReviewEvidence;
  revision: IdealTextRevision | null;
  live: boolean;
};

function momentFromSuggestion(item: DocumentSuggestion): FeedbackKeyMoment | null {
  if (!item.snippetId) return null;
  return {
    snippetId: item.snippetId,
    slideIndex: item.evidence?.slideIndex ?? null,
    recordingKind: "spoken",
    transcript: item.quote,
    audioRef: item.snippetAudioRef,
    startOffsetMs: item.startOffsetMs ?? 0,
    durationMs: item.durationMs ?? 0,
    commentText: item.rewriteMove ?? item.praiseLine,
  };
}

function strongestMoment(items: DocumentSuggestion[]): FeedbackKeyMoment | null {
  const best = items.find((item) => item.snippetId && (item.highestMoment || item.walkSlot === "strongest") &&
    (item.bookmarkTier ? item.bookmarkTier === "confident" :
      item.feedbackFamily === "great_formulation" || item.openCard === "praise"));
  if (!best) return null;
  const moment = momentFromSuggestion(best);
  return moment ? { ...moment, commentText: best.praiseReason?.paragraphs.join("\n\n") ?? best.praiseLine } : null;
}

async function tempoEvidence(project: string, take: string, snippet?: string): Promise<ReviewEvidence | null> {
  const tempo = await fetchReviewTempo(project, take);
  if (!tempo || tempo === "failed" || !tempo.snippetId || (snippet && tempo.snippetId !== snippet)) return null;
  return {
    activity: "Sniper",
    moment: {
      snippetId: tempo.snippetId, slideIndex: tempo.slideIndex ?? null,
      recordingKind: "spoken", transcript: tempo.said.stretch, audioRef: tempo.clip?.src ?? null,
      startOffsetMs: tempo.clip?.startOffsetMs ?? 0, durationMs: tempo.clip?.durationMs ?? 0,
      commentText: tempo.reading === "rushed" ? "You rushed here. Let it breathe." : "You slowed down here. Keep it moving.",
    },
  };
}

async function latestEvidence(
  project: string, take: string, result: IdealTextResult, snippet?: string,
): Promise<ReviewEvidence> {
  if (result.kind !== "single") return { moment: null, activity: null };
  const items = (result.suggestions ?? []).filter((item) => item.takeSessionId === take);
  const strength = snippet ? null : strongestMoment(items);
  const tempo = items.some((item) => item.oneFix === "tempo") ? await tempoEvidence(project, take, snippet) : null;
  if (tempo) return { ...tempo, strength };
  const candidates = snippet ? items.filter((item) => item.snippetId === snippet) : items;
  const candidate = candidates.find((item) => item.walkSlot === "weakest" || item.walkSlot === "between");
  const strongest = candidates.find((item) => item.highestMoment || item.walkSlot === "strongest") ?? candidates[0];
  const clip = result.ideal.keyMoments.find((item) => item.takeSessionId === take && (!snippet || item.snippetId === snippet));
  return {
    strength,
    moment: (candidate ? momentFromSuggestion(candidate) : strongest ? momentFromSuggestion(strongest) : null) ??
      (clip ? { snippetId: clip.snippetId, slideIndex: null, recordingKind: "spoken", transcript: clip.anchor,
        audioRef: clip.snippetAudioRef ?? null, startOffsetMs: clip.startOffsetMs ?? 0,
        durationMs: clip.durationMs ?? 0, commentText: null } : null),
    activity: candidate?.practiceExercise?.title ??
      (candidate?.walkSlot === "between" ? "Clearer version" : candidate ? "AI audio" : null),
    instruction: candidate?.practiceExercise?.instruction ?? null,
  };
}

function liveRevision(head: Extract<IdealTextResult, { kind: "single" }>, take: TrainingTake): IdealTextRevision {
  const pieces = head.pieces ?? [];
  const roots = new Map<number, string[]>();
  for (const piece of pieces) {
    if (piece.slideIndex != null && piece.rootPhrase) {
      roots.set(piece.slideIndex, [...(roots.get(piece.slideIndex) ?? []), piece.rootPhrase]);
    }
  }
  return {
    revision: head.version ?? 0, takeIndex: take.takeIndex, text: head.ideal.text,
    slides: pieces.map((piece) => piece.slideIndex ?? null), presentationRef: head.presentationRef,
    slideTitles: head.slideTitles ?? undefined, deckKnown: true,
    helperWords: [...roots].map(([slideIndex, phrases]) => ({ slideIndex, phrases: [...new Set(phrases)] })),
    createdAt: head.updatedAt, isHead: true,
  };
}

async function loadArtifact(project: string, take: TrainingTake, snippet?: string): Promise<Artifact> {
  const [doc, versions] = await Promise.all([fetchIdealText(project), fetchIdealTextRevisions(project)]);
  const live = doc.kind === "single" && doc.latestTakeSessionId === take.sessionId;
  const version = versions.kind === "ready"
    ? versions.revisions.find((row) => row.takeIndex === take.takeIndex) ?? null : null;
  const revision = live && doc.kind === "single"
    ? { ...(version ?? liveRevision(doc, take)), text: doc.ideal.text } : version;
  const evidence = await latestEvidence(project, take.sessionId, doc, snippet);
  if (evidence.moment || (live && !snippet)) return { revision, evidence, live };
  // The published per-Take fallback joins by session id. It must never
  // substitute the latest document or an adjacent recording.
  const packet = await fetchArcFeedback(project).catch(() => null);
  const moment = packet?.takes.find((row) => row.sessionId === take.sessionId)?.keyMoments
    .find((row) => !snippet || row.snippetId === snippet) ?? null;
  if (doc.kind === "error" && versions.kind === "error" && !moment) throw new Error("Take review unavailable");
  return { revision, evidence: { ...evidence, moment }, live };
}

function focusFor(step: Step, moment: FeedbackKeyMoment | null): ReviewFocus {
  return {
    step,
    ...(moment ? { snippet_id: moment.snippetId } : {}),
    ...(moment?.slideIndex == null ? {} : { slide_index: moment.slideIndex }),
  };
}

function ReviewPractice({ arc, take, evidence, recordingDock, savedSteps, onClose }: {
  arc: string;
  take: TrainingTake;
  evidence: ReviewEvidence | undefined;
  recordingDock: HTMLDivElement | null;
  savedSteps: readonly LoungeMessage[];
  onClose: () => void;
}) {
  return <InlineWalkHost.Provider value={{ recordingDock, savedSteps, conversation: true }}>
    <IdealTextOverlay arcId={arc} reviewTake={take.sessionId} reviewTakeIndex={take.takeIndex}
      initialMode="review" reviewSlideRange={take.recordedRange} requireFeedbackWalk
      reviewAt={{ practise: true, take: take.sessionId, snippet: evidence?.moment?.snippetId ?? null }}
      onPracticeUnavailable={onClose} onClose={onClose} />
  </InlineWalkHost.Provider>;
}

function useReviewOpening(takeId: string, evidence: ReviewEvidence | undefined, history: readonly LoungeMessage[]) {
  const strength = evidence?.strength ?? null;
  const moment = strength ?? evidence?.moment ?? null;
  const voiceOn = useWalkVoiceOn();
  const savedPraise = strength ? history.findLast((row) => row.role === "bot" && row.body.trim() &&
    row.metadata?.snippet_id === strength.snippetId && ["praise", "best"].includes(String(row.metadata?.step)))?.body : null;
  const praise = useBestSaid(takeId, savedPraise ? null : strength?.snippetId ?? null, voiceOn);
  return { strength, moment, praise, opening: savedPraise ?? praise.text ?? moment?.commentText ?? "" };
}

function isLiveIdealOffer(row: LoungeMessage): boolean {
  return row.metadata?.live_take_feedback === true && offersIdealText(row);
}

function liveFeedbackRows(rows: readonly LoungeMessage[]) {
  return rows.filter((row) => row.kind !== "cadence" && row.metadata?.bridge !== true &&
    (row.metadata?.next_take !== true || row.metadata?.live_take_feedback === true));
}

function liveOpening(
  arc: string, take: TrainingTake, strength: FeedbackKeyMoment | null, praise: string | null, polish: boolean,
): LoungeMessageDraft {
  const asked = polish ? "Jak ci to brzmi?" : "How does this sound to you?";
  const introduction = polish ? "Ten moment zabrzmiał pewnie." : "This moment came across confidently.";
  const words = praise || introduction;
  return {
    clientId: stableUuid(`live-take-opening:${arc}:${take.sessionId}`),
    kind: "walk_step", role: "bot",
    body: strength ? (words.includes("?") ? words : words + "\n\n" + asked)
      : polish ? "Do którego momentu chcesz wrócić?" : "Which moment would you like to go back to?",
    metadata: { arc_id: arc, take_session_id: take.sessionId, take_index: take.takeIndex, take_exchange: true,
      live_take_feedback: true, live_opening: true, project_chat: true, step: "praise",
      ...(strength ? { snippet_id: strength.snippetId, coach_moment: {
        arc_id: arc, take_session_id: take.sessionId, snippet_id: strength.snippetId, practise: false,
      } } : {}) },
  };
}

function useLiveOpening(
  target: TakeReviewTarget, project: TrainingArc, artifact: Artifact | null,
  rows: readonly LoungeMessage[], strength: FeedbackKeyMoment | null,
  praise: ReturnType<typeof useBestSaid>, remember?: (draft: LoungeMessageDraft) => Promise<unknown>,
) {
  const locale = useUiLocale();
  const sent = useRef(false);
  useEffect(() => {
    if (!target.live || !remember || !artifact || sent.current ||
      rows.some((row) => row.metadata?.live_opening === true) || (strength && !praise.settled)) return;
    sent.current = true;
    void remember(liveOpening(project.arcId, target.take, strength, praise.text, locale === "pl")).catch(() => {
      sent.current = false;
    });
  }, [target.live, target.take, project.arcId, artifact, rows, strength, praise, locale, remember]);
}

function reviewContextFocus(
  target: TakeReviewTarget, project: string, offer: LoungeMessage | undefined, lastMoment: LoungeMessage | undefined,
  moment: FeedbackKeyMoment | null, opening: FeedbackKeyMoment | null,
): ReviewFocus {
  const { focus, take, openedFromAt } = target;
  const openedIdealAt = focus.step === "ideal" ? openedFromAt ?? "" : "";
  const offeredIdealAt = offer?.client_created_at ?? "";
  const idealAt = openedIdealAt > offeredIdealAt ? openedIdealAt : offeredIdealAt;
  if (idealAt && (!lastMoment || idealAt >= lastMoment.client_created_at)) {
    return focus.step === "ideal" ? focus : { step: "ideal" };
  }
  if (focus.step === "ideal" && !idealAt) return focus;
  const selected = coachMomentFromMetadata(lastMoment?.metadata?.coach_moment);
  if (selected?.arc_id === project) {
    // The clip may come from another Take. Its reply stays in this exchange,
    // and the coach can recover the source from the saved turn.
    return selected.take_session_id === take.sessionId
      ? { step: selected.practise ? "practise" : "feedback", snippet_id: selected.snippet_id }
      : { step: "feedback" };
  }
  return focusFor(focus.step, focus.step === "practise" ? moment : opening);
}

function TakeReviewDocument({
  artifact, take, project, copy, draft, saveMessage, savingEdit, onPracticeEnded, onEdit, onSave,
}: {
  artifact: Artifact | null;
  take: TrainingTake;
  project: TrainingArc;
  copy: ReviewRevision | null;
  draft?: NonNullable<ReviewRevision["document"]["ideal_sections"]>;
  saveMessage: string;
  savingEdit: boolean;
  onPracticeEnded: () => void;
  onEdit: (sections: NonNullable<ReviewRevision["document"]["ideal_sections"]>) => void;
  onSave: () => void;
}) {
  if (!artifact) return null;
  if (artifact.live) return <div data-review-section="ideal">
    <IdealTextOverlay key={take.sessionId} arcId={project.arcId} reviewTake={take.sessionId}
      reviewTakeIndex={take.takeIndex} inlineDocument onClose={onPracticeEnded} />
  </div>;
  if (!artifact.revision) return null;
  return <div data-review-section="ideal">
    <ArchivedIdealText revision={artifact.revision} name={project.topic} take={take.takeIndex}
      review={{ arcId: project.arcId, takeId: take.sessionId, copy, draft, status: saveMessage, saving: savingEdit, onEdit, onSave }} />
  </div>;
}

export default function TakeReview({
  project, target, runs, messages, chat, recordingDock, exitRef, focusRef, onClose, onAsk, onPracticeEnded, renderFooter,
  rememberOpening,
}: {
  project: TrainingArc;
  target: TakeReviewTarget;
  runs: readonly ReviewRun[];
  messages: readonly LoungeMessage[];
  chat?: string;
  recordingDock: HTMLDivElement | null;
  exitRef: MutableRefObject<ReviewExit | null>;
  focusRef?: MutableRefObject<TakeReviewTarget | null>;
  onClose: () => void;
  onAsk: (target: TakeReviewTarget) => void;
  onPracticeEnded: () => void;
  renderFooter?: (message: LoungeMessage) => ReactNode;
  rememberOpening?: (draft: LoungeMessageDraft) => Promise<unknown>;
}) {
  const { take } = target;
  const [artifact, setArtifact] = useState<Artifact | null>(null);
  const [failed, setFailed] = useState(false);
  const [refresh, setRefresh] = useState(0);
  const [practising, setPractising] = useState(false);
  const [savedSteps, setSavedSteps] = useState<LoungeMessage[]>([]);
  const { copy, draft, setDraft, saveMessage, savingEdit, exit } = useReviewEdits(project.arcId, take.sessionId, refresh, exitRef);
  const article = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    let current = true;
    void loadArtifact(project.arcId, take, target.focus.snippet_id).then((result) => {
      if (current) {
        setArtifact(result);
        setFailed(false);
      }
    }, () => { if (current) setFailed(true); });
    return () => { current = false; };
  }, [project.arcId, take, refresh, target.focus.snippet_id]);

  useEffect(() => {
    let current = true;
    void readReviewSteps(project.arcId, take.sessionId, true, chat).then((rows) => {
      if (current) setSavedSteps(rows);
    }).catch(() => undefined);
    return () => { current = false; };
  }, [project.arcId, take.sessionId, chat, refresh, runs.length]);

  const history = useMemo(() => {
    const merged = mergeTakeExchange(savedSteps, messages, project.arcId, take.sessionId);
    return orderedProjectMessages(merged, project.arcId).filter((row) => !isPersistedTerminalReplay(row, merged));
  }, [messages, savedSteps, project.arcId, take.sessionId]);
  const endAt = [...messages, ...savedSteps].find((row) => row.kind === "walk_step" &&
    row.metadata?.step === "end" && row.metadata?.take_session_id === take.sessionId)?.client_created_at;
  const documentAt = history.findIndex((row) =>
    endAt ? row.client_created_at > endAt : row.metadata?.review_focus != null);
  const before = documentAt < 0 ? history : history.slice(0, documentAt);
  const after = documentAt < 0 ? [] : history.slice(documentAt);
  const moment = artifact?.evidence.moment ?? null;
  const { strength, moment: openingMoment, opening, praise } = useReviewOpening(take.sessionId, artifact?.evidence, history);
  useLiveOpening(target, project, artifact, history, strength, praise, rememberOpening);
  const inConversation = Boolean(target.live || history.some((item) => item.metadata?.live_take_feedback === true));
  const idealOffer = history.findLast(isLiveIdealOffer);
  const lastMoment = inConversation ? history.findLast((item) =>
    coachMomentFromMetadata(item.metadata?.coach_moment)?.arc_id === project.arcId) : undefined;
  const seenWalk = history.some((row) =>
    row.kind === "walk_step" && row.role === "bot" && (row.body.trim() || row.metadata?.clip),
  );
  const hasAttempt = new Set(history.filter(isSavedPracticeAttempt).map((row) => row.id ?? row.client_id));
  const undrawnRuns = runs.filter((run) => !hasAttempt.has(run.id));

  useEffect(() => {
    if (!focusRef) return;
    const focus = reviewContextFocus(target, project.arcId, idealOffer, lastMoment, moment, openingMoment);
    const active = { take, focus, live: inConversation };
    focusRef.current = active;
    return () => {
      if (focusRef.current === active) focusRef.current = null;
    };
  }, [focusRef, target, project.arcId, take, moment, openingMoment, idealOffer, lastMoment, inConversation]);

  useEffect(() => {
    article.current?.focus({ preventScroll: true });
    scrollWithinProject(article.current);
  }, [take.sessionId]);
  useEffect(() => {
    if (target.focus.step === "practise" && artifact) {
      scrollWithinProject(article.current?.querySelector('[data-review-section="practise"]'));
      return;
    }
    if (target.focus.step !== "ideal" || !artifact) return;
    const slide = target.focus.slide_index;
    const node = Array.from(article.current?.querySelectorAll<HTMLElement>("[data-review-slide]") ?? [])
      .find((entry) => entry.dataset.reviewSlide === String(slide));
    scrollWithinProject(node ?? article.current?.querySelector("[data-chat-document]"));
  }, [artifact, target.focus.step, target.focus.slide_index]);

  function closePractice() {
    setPractising(false);
    onPracticeEnded();
    setRefresh((v) => v + 1);
  }

  useBackDismiss(() => void exit(onClose), () => {
    if (!practising) return false;
    closePractice();
    return true;
  }, practising);

  const refer = (focus: ReviewFocus, quote: string) => onAsk({ ...target, focus, quote, live: inConversation });
  const row = (message: LoungeMessage, footer = renderFooter?.(message)) => <TakeConversationMessage key={message.client_id} message={message}
    project={project.arcId} recordingDock={recordingDock} replayOnly={target.replay}
    onRefer={(snippet, words) => refer({ step: "feedback", snippet_id: snippet }, words)}
    footer={footer} />;
  const document = <TakeReviewDocument artifact={artifact} take={take} project={project} copy={copy}
    draft={draft?.ideal_sections} saveMessage={saveMessage} savingEdit={savingEdit} onPracticeEnded={onPracticeEnded}
    onEdit={(sections) => setDraft({ ideal_sections: sections })} onSave={() => void exit()} />;

  if (inConversation) {
    const rows = liveFeedbackRows(history);
    const followUp = idealOffer?.metadata?.after_ideal_text;
    return <div ref={article} tabIndex={-1} data-take-review data-live-take-feedback
      className="flex w-full min-w-0 flex-col gap-2 outline-none">
      {rows.map((message) => message === idealOffer ? <div key={message.client_id} className="contents">
        {row(message, null)}
        {document}
        {typeof followUp === "string" ? <ConversationBubble><p className="whitespace-pre-wrap">{followUp}</p></ConversationBubble> : null}
        <div className={WILLAB_CONTENT_RAIL}>{renderFooter?.(message)}</div>
      </div> : row(message))}
      {!idealOffer && target.focus.step === "ideal" ? document : null}
      {failed && !rows.length ? <div className={WILLAB_CONTENT_RAIL}>
        <TakeReviewStatus project={project} take={take} replay failed loading={false} onRetry={() => setRefresh((v) => v + 1)} />
      </div> : null}
      {target.live && !failed && !rows.length ? <div className={WILLAB_CONTENT_RAIL}>
        <TypingDots label="Will is replying" />
      </div> : null}
      {idealOffer && target.live ? <div className={WILLAB_CONTENT_RAIL + " flex justify-end"}>
        <button type="button" className={LINK} onClick={onClose}>Minimise</button>
      </div> : null}
    </div>;
  }

  return <div ref={article} tabIndex={-1} data-take-review aria-label={"Take " + take.takeIndex + " review"}
    className="flex w-full min-w-0 flex-col gap-2 outline-none">
    <div className={WILLAB_CONTENT_RAIL}>
      <TakeReviewStatus project={project} take={take} replay={target.replay} loading={!artifact} failed={failed} onRetry={() => setRefresh((v) => v + 1)} />
    </div>
    {!seenWalk && !practising ? <ReviewOpening moment={openingMoment} text={copy?.document.feedback ?? opening} onRefer={refer} /> : null}
    {practising ? <div className={WILLAB_CONTENT_RAIL} data-review-section="practise">
      <ReviewPractice arc={project.arcId} take={take} evidence={artifact?.evidence}
        recordingDock={recordingDock} savedSteps={history.filter((message) => message.kind === "walk_step")} onClose={closePractice} />
    </div> : before.map((message) => row(message))}
    {!practising ? <ReviewPracticeOffer evidence={artifact?.evidence} target={target} seenWalk={seenWalk}
      onTry={() => setPractising(true)} /> : null}
    {!practising ? undrawnRuns.map((run) => <ConversationBubble key={run.id} speaker>
      {run.kind === "tempo" ? "Sniper" : "Voice practice"} · <time dateTime={run.at}>{new Date(run.at).toLocaleString()}</time>
    </ConversationBubble>) : null}
    {!practising ? document : null}
    {!practising ? after.map((message) => row(message)) : null}
  </div>;
}

function ReviewOpening({ moment, text, onRefer }: {
  moment: FeedbackKeyMoment | null;
  text: string;
  onRefer: (focus: ReviewFocus, quote: string) => void;
}) {
  if (!moment) return null;
  return <div data-review-section="feedback">
    <ConversationBubble>
      {text ? <p className="whitespace-pre-wrap">{text}</p> : null}
      {moment.transcript ? <button type="button" onClick={() => onRefer(focusFor("feedback", moment), moment.transcript)}
        className="min-h-11 whitespace-pre-wrap text-left hover:underline" title="Refer to this moment">{moment.transcript}</button> : null}
      {moment.audioRef ? <WalkPlayer seed={moment.snippetId} label="Original moment" src={moment.audioRef}
        startOffsetMs={moment.startOffsetMs} durationMs={moment.durationMs || null} look="bare" /> : null}
    </ConversationBubble>
  </div>;
}

function ReviewPracticeOffer({ evidence, target, seenWalk, onTry }: {
  evidence: ReviewEvidence | undefined;
  target: TakeReviewTarget;
  seenWalk: boolean;
  onTry: () => void;
}) {
  const invited = target.focus.step === "practise";
  if (!evidence?.activity || target.replay || (!invited && (seenWalk || evidence.strength || !evidence.instruction))) return null;
  return <div data-review-section="practise">
    <ConversationBubble>
      <p className="font-medium">{evidence.activity}</p>
      {evidence.instruction ? <p>{evidence.instruction}</p> : null}
      <button type="button" className={LINK} onClick={onTry}>{invited ? "Try it" : "Practise"}</button>
    </ConversationBubble>
  </div>;
}

function TakeReviewStatus({ project, take, replay, loading, failed, onRetry }: {
  project: TrainingArc; take: TrainingTake; replay?: boolean; loading: boolean; failed: boolean; onRetry: () => void;
}) {
  const latest = !project.takes.some((item) => item.takeIndex > take.takeIndex);
  const coverage = project.practiceCoverage;
  const range = take.recordedRange;
  return <>
    {!replay ? <p className="text-[13px] text-muted-foreground">
      <strong className="font-medium text-foreground">Take {take.takeIndex} is ready.</strong>
      {latest && coverage?.total ? <> You’ve practised {coverage.practised} of {coverage.total} {coverage.unit}.</> : null}
      {range ? <> · Slides {range.startSlide}–{range.endSlide}</> : null}
    </p> : null}
    {failed ? <button type="button" className={BUTTON} onClick={onRetry}>Try again</button> :
      loading ? <TypingDots label="Loading feedback" /> : null}
  </>;
}

function useReviewEdits(arcId: string, takeId: string, refresh: number, exitRef: MutableRefObject<ReviewExit | null>) {
  const [copy, setCopy] = useState<ReviewRevision | null>(null);
  const [draft, setDraft] = useState<ReviewCopy | null>(null);
  const [saveMessage, setSaveMessage] = useState("");
  const saving = useRef(false);
  useEffect(() => {
    let current = true;
    void readReviewCopy(arcId, takeId).then((result) => {
      if (current) setCopy(result);
    }).catch(() => undefined);
    return () => { current = false; };
  }, [arcId, takeId, refresh]);

  async function exit(action?: () => void) {
    if (saving.current) return;
    if (draft) {
      if (!copy) return;
      saving.current = true;
      setSaveMessage("Saving…");
      const result = await saveReviewCopy(arcId, takeId, copy.revision, draft).catch(() => null);
      saving.current = false;
      if (!result || result.conflict) {
        if (result) setCopy(result.revision);
        setSaveMessage("Couldn’t save. Try again.");
        return;
      }
      setCopy(result.revision);
      setDraft(null);
      setSaveMessage("");
    }
    action?.();
  }

  useEffect(() => {
    exitRef.current = (afterSave) => void exit(afterSave);
    return () => { exitRef.current = null; };
  });

  return { copy, draft, setDraft, saveMessage, savingEdit: saveMessage === "Saving…", exit };
}
