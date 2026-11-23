"use client";

import { useEffect, useMemo, useRef, useState, type MutableRefObject, type ReactNode } from "react";
import { fetchArcFeedback, type FeedbackKeyMoment } from "@/services/api/arcFeedback";
import { fetchIdealText, type DocumentSuggestion, type IdealTextResult } from "@/services/api/idealText";
import { fetchIdealTextRevisions, type IdealTextRevision } from "@/services/api/blockVariants";
import { fetchReviewTempo } from "@/services/api/reviewTempo";
import { readReviewCopy, readReviewSteps, saveReviewCopy, type ReviewCopy, type ReviewRevision, type ReviewRun } from "@/services/api/takeReview";
import type { TrainingArc, TrainingTake } from "@/services/api/trainings";
import type { ChatQueryArgs } from "@/services/api/chatQuery";
import { helperHeadlineOf, slideGroupsOf } from "@/lib/willab/pastIdealText";
import { helperWordRanges, missingHelperWords } from "@/lib/willab/answeredBookmark";
import type { LoungeMessage } from "@/services/api/loungeMessages";
import { mergeTakeExchange } from "@/lib/willab/takeExchange";
import { isPersistedTerminalReplay, orderedProjectMessages } from "@/lib/willab/projectChat";
import { WILLAB_CONTENT_RAIL } from "@/lib/willab/layout";
import type { PresentationExportFormat } from "@/lib/willab/presentationDocument";
import AiGeneratedNote from "./AiGeneratedNote";
import DeckSlideThumb from "./DeckSlideThumb";
import IdealTextOverlay from "./IdealTextOverlay";
import IdealTextMenu from "./IdealTextMenu";
import PresentMode from "./PresentMode";
import ExportFormatDialog from "./ExportFormatDialog";
import TypingDots from "./TypingDots";
import { RichText } from "./RichText";
import { useBackDismiss } from "./useBackDismiss";
import { HelpersLabel } from "./TranscriptReviewDeck";
import WalkPlayer from "./walk/WalkPlayer";
import { InlineWalkHost, scrollWithinProject } from "./walk/InlineWalkHost";
import { isSavedPracticeAttempt } from "./TakeReviewPracticeHistory";
import { ConversationBubble, ConversationDocument } from "./chats/TakeConversation";
import TakeConversationMessage from "./chats/TakeConversationMessage";
import type { FeedbackWalkSlideRange } from "./useDeckFeedbackWalk";

export type ReviewFocus = NonNullable<NonNullable<ChatQueryArgs["presentationContext"]>["review_focus"]>;
export type TakeReviewTarget = {
  take: TrainingTake;
  focus: ReviewFocus;
  walkRange?: FeedbackWalkSlideRange;
  openWalk?: boolean;
  /** An archived exchange can be played back and discussed in the composer. */
  replay?: boolean;
  quote?: string;
};
export type ReviewExit = (afterSave: () => void) => void;
type Step = ReviewFocus["step"];

const BUTTON = "min-h-11 rounded-lg border border-border px-3 text-sm font-medium hover:bg-muted";
const LINK = "min-h-11 text-sm text-muted-foreground hover:underline";

type ReviewEvidence = {
  moment: FeedbackKeyMoment | null;
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
  const tempo = items.some((item) => item.oneFix === "tempo") ? await tempoEvidence(project, take, snippet) : null;
  if (tempo) return tempo;
  const candidates = snippet ? items.filter((item) => item.snippetId === snippet) : items;
  const candidate = candidates.find((item) => item.walkSlot === "weakest" || item.walkSlot === "between");
  const strongest = candidates.find((item) => item.highestMoment || item.walkSlot === "strongest") ?? candidates[0];
  const clip = result.ideal.keyMoments.find((item) => item.takeSessionId === take && (!snippet || item.snippetId === snippet));
  return {
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

type Engine = "walk" | "practise";

function ReviewEngine({ arc, target, evidence, mode, recordingDock, savedSteps, onClose }: {
  arc: string;
  target: TakeReviewTarget;
  evidence: ReviewEvidence | undefined;
  mode: Engine;
  recordingDock: HTMLDivElement | null;
  savedSteps: readonly LoungeMessage[];
  onClose: () => void;
}) {
  const { take, walkRange } = target;
  return <InlineWalkHost.Provider value={{ recordingDock, savedSteps, conversation: true }}>
    <IdealTextOverlay arcId={arc} reviewTake={take.sessionId} reviewTakeIndex={take.takeIndex}
      initialMode="review" reviewSlideRange={walkRange} requireFeedbackWalk
      coachTake={mode === "walk" ? take.sessionId : undefined}
      reviewAt={mode === "practise" ? { practise: true, take: take.sessionId, snippet: evidence?.moment?.snippetId ?? null } : null}
      onPracticeUnavailable={onClose} onClose={onClose} />
  </InlineWalkHost.Provider>;
}

export default function TakeReview({
  project, target, runs, messages, chat, recordingDock, exitRef, onClose, onAsk, onPracticeEnded, renderFooter,
}: {
  project: TrainingArc;
  target: TakeReviewTarget;
  runs: readonly ReviewRun[];
  messages: readonly LoungeMessage[];
  chat?: string;
  recordingDock: HTMLDivElement | null;
  exitRef: MutableRefObject<ReviewExit | null>;
  onClose: () => void;
  onAsk: (target: TakeReviewTarget) => void;
  onPracticeEnded: () => void;
  renderFooter?: (message: LoungeMessage) => ReactNode;
}) {
  const { take } = target;
  const [artifact, setArtifact] = useState<Artifact | null>(null);
  const [failed, setFailed] = useState(false);
  const [refresh, setRefresh] = useState(0);
  const [engine, setEngine] = useState<Engine | null>(() => target.openWalk ? "walk" : null);
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
  const seenWalk = history.some((row) =>
    row.kind === "walk_step" && row.role === "bot" && (row.body.trim() || row.metadata?.clip),
  );
  const hasAttempt = new Set(history.filter(isSavedPracticeAttempt).map((row) => row.id ?? row.client_id));
  const undrawnRuns = runs.filter((run) => !hasAttempt.has(run.id));

  useEffect(() => {
    article.current?.focus({ preventScroll: true });
    scrollWithinProject(article.current);
  }, [take.sessionId]);
  useEffect(() => {
    if (target.focus.step !== "ideal" || !artifact) return;
    const slide = target.focus.slide_index;
    const node = Array.from(article.current?.querySelectorAll<HTMLElement>("[data-review-slide]") ?? [])
      .find((entry) => entry.dataset.reviewSlide === String(slide));
    scrollWithinProject(node ?? article.current?.querySelector("[data-chat-document]"));
  }, [artifact, target.focus.step, target.focus.slide_index]);

  function closeEngine() {
    setEngine(null);
    onPracticeEnded();
    setRefresh((v) => v + 1);
  }

  useBackDismiss(() => void exit(onClose), () => {
    if (!engine) return false;
    closeEngine();
    return true;
  }, Boolean(engine));

  const refer = (focus: ReviewFocus, quote: string) => onAsk({ ...target, focus, quote });
  const row = (message: LoungeMessage) => <TakeConversationMessage key={message.client_id} message={message}
    project={project.arcId} recordingDock={recordingDock} replayOnly={target.replay}
    onRefer={(snippet, words) => refer({ step: "feedback", snippet_id: snippet }, words)}
    footer={renderFooter?.(message)} />;

  return <div ref={article} tabIndex={-1} data-take-review aria-label={"Take " + take.takeIndex + " review"}
    className="flex w-full min-w-0 flex-col gap-2 outline-none">
    <div className={WILLAB_CONTENT_RAIL}>
      <TakeReviewStatus project={project} take={take} replay={target.replay} loading={!artifact} failed={failed} onRetry={() => setRefresh((v) => v + 1)} />
    </div>
    {!seenWalk && moment && !engine ? <ConversationBubble>
      {copy?.document.feedback || moment.commentText ? <p className="whitespace-pre-wrap">{copy?.document.feedback ?? moment.commentText}</p> : null}
      {moment.transcript ? <button type="button" onClick={() => refer(focusFor("feedback", moment), moment.transcript)}
        className="min-h-11 whitespace-pre-wrap text-left hover:underline" title="Refer to this moment">{moment.transcript}</button> : null}
      {moment.audioRef ? <WalkPlayer seed={moment.snippetId} label="Original moment" src={moment.audioRef}
        startOffsetMs={moment.startOffsetMs} durationMs={moment.durationMs || null} look="bare" /> : null}
    </ConversationBubble> : null}
    {engine ? <div className={WILLAB_CONTENT_RAIL}>
      <ReviewEngine arc={project.arcId} target={target} mode={engine} evidence={artifact?.evidence}
        recordingDock={recordingDock} savedSteps={history.filter((message) => message.kind === "walk_step")} onClose={closeEngine} />
    </div> : before.map(row)}
    {!seenWalk && !engine && artifact?.evidence.instruction ? <ConversationBubble>
      <p>{artifact.evidence.instruction}</p>
      {!target.replay ? <button type="button" className={LINK} onClick={() => setEngine("practise")}>Practise</button> : null}
    </ConversationBubble> : null}
    {!engine ? undrawnRuns.map((run) => <ConversationBubble key={run.id} speaker>
      {run.kind === "tempo" ? "Sniper" : "Voice practice"} · <time dateTime={run.at}>{new Date(run.at).toLocaleString()}</time>
    </ConversationBubble>) : null}
    {!engine && artifact?.live ? <div data-review-section="ideal">
      <IdealTextOverlay key={take.sessionId} arcId={project.arcId} reviewTake={take.sessionId} reviewTakeIndex={take.takeIndex}
        inlineDocument onClose={onPracticeEnded} />
    </div> : null}
    {!engine && !artifact?.live && artifact?.revision ? <HistoricalDocument
      arcId={project.arcId} takeId={take.sessionId} revision={artifact.revision} copy={copy} draft={draft?.ideal_sections}
      status={saveMessage} saving={savingEdit} onEdit={(sections) => setDraft({ ideal_sections: sections })} onSave={() => void exit()} />
    : null}
    {!engine ? after.map(row) : null}
  </div>;
}

function HistoricalDocument({ arcId, takeId, revision, copy, draft, status, saving, onEdit, onSave }: {
  arcId: string;
  takeId: string;
  revision: IdealTextRevision;
  copy: ReviewRevision | null;
  draft?: string[];
  status: string;
  saving: boolean;
  onEdit: (sections: string[]) => void;
  onSave: () => void;
}) {
  const [copied, setCopied] = useState(false);
  const [chooser, setChooser] = useState(false);
  const [delivery, setDelivery] = useState<"present" | PresentationExportFormat | null>(null);
  const groups = slideGroupsOf(revision);
  const text = copy?.document.ideal_sections?.length === groups.length
    ? copy.document.ideal_sections : groups.map((group) => group.paragraphs.join("\n\n"));
  const words = text.join("\n\n");
  const pieces = text.flatMap((section, i) => section.split("\n\n").map((paragraph) => ({
    text: paragraph,
    slideIndex: groups[i].slideIndex,
    rootPhrase: helperHeadlineOf(revision, groups[i].slideIndex) ?? "",
  }))).map((piece, pieceKey) => ({
    ...piece, pieceKey, rootType: "flagship" as const, status: "settled" as const,
    takeSessionId: takeId, takeIndex: revision.takeIndex, snippetId: "", challenger: null,
  }));
  const actions = draft ? <button type="button" className={LINK} disabled={saving} onClick={onSave}>Done</button> :
    <IdealTextMenu arcId={arcId} saved={null} onSaved={() => undefined}
      onEdit={copy && text.length ? () => onEdit(text) : null}
      onExport={() => setChooser(true)} onPresent={() => setDelivery("present")}
      copied={copied} onCopy={() => void navigator.clipboard.writeText(words).then(() => setCopied(true), () => undefined)} />;
  return <div data-review-section="ideal">
    <ConversationDocument title="Ideal text" actions={actions}>
      <AiGeneratedNote kind="ideal-text" take={revision.takeIndex} />
      {status ? <p role="status" className="text-sm text-muted-foreground">{status}</p> : null}
      <div className="space-y-6">
        {groups.map((group, index) => <ReviewSlide key={index} slide={group.slideIndex} revision={revision}
          text={text[index]} draft={draft?.[index]}
          onEdit={(next) => onEdit((draft ?? text).map((part, i) => i === index ? next : part))} />)}
      </div>
    </ConversationDocument>
    {chooser ? <ExportFormatDialog onClose={() => setChooser(false)} onSelect={(format) => { setChooser(false); setDelivery(format); }} /> : null}
    {delivery ? <PresentMode text={words} pieces={pieces} presentationRef={revision.presentationRef ?? null}
      exportFormat={delivery === "present" ? null : delivery} onClose={() => setDelivery(null)} /> : null}
  </div>;
}

function TakeReviewStatus({ project, take, replay, loading, failed, onRetry }: {
  project: TrainingArc; take: TrainingTake; replay?: boolean; loading: boolean; failed: boolean; onRetry: () => void;
}) {
  const latest = !project.takes.some((item) => item.takeIndex > take.takeIndex);
  const coverage = project.practiceCoverage;
  const range = project.practiceChunks.find((chunk) => chunk.latestSessionId === take.sessionId);
  return <>
    {!replay ? <p className="text-[13px] text-muted-foreground">
      <strong className="font-medium text-foreground">Take {take.takeIndex} is ready.</strong>
      {latest && coverage?.total ? <> You’ve practised {coverage.practised} of {coverage.total} {coverage.unit}.</> : null}
      {latest && !coverage?.total && project.practiceProgress > 0 ? <> Progress · {Math.round(project.practiceProgress)}%</> : null}
      {range ? <> · Slides {range.startSlide}–{range.endSlide}
        {range.attempts > 0 ? ` · ${range.attempts} ${range.attempts === 1 ? "attempt" : "attempts"}` : null}
      </> : null}
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

function ReviewSlide({ slide, revision, text, draft, onEdit }: {
  slide: number | null; revision: IdealTextRevision; text: string; draft?: string;
  onEdit: (text: string) => void;
}): ReactNode {
  const headline = helperHeadlineOf(revision, slide);
  return (
    <section data-review-slide={slide ?? undefined} className="w-full space-y-2 border-t border-border pt-2">
      {slide === null ? null : <div className="flex items-center gap-2">
        <DeckSlideThumb compact presentationRef={revision.presentationRef} pageIndex={slide} label={"Slide " + (slide + 1)} />
        <h3 className="text-[13px] text-muted-foreground">Slide {slide + 1}</h3>
      </div>}
      {draft !== undefined ? <ReviewField label="Edit Ideal text" value={draft} onEdit={onEdit} /> : (
        <div className="space-y-3">
          <HelpersLabel phrases={missingHelperWords(text, headline)} />
          {text.split("\n\n").map((paragraph, index) => (
            <p key={index}><RichText text={paragraph} tint={helperWordRanges(paragraph, headline)} /></p>
          ))}
        </div>
      )}
    </section>
  );
}

function ReviewField({ label, value, onEdit }: { label: string; value: string; onEdit: (text: string) => void }) {
  return <textarea aria-label={label} className="block min-h-24 w-full rounded-lg border border-border bg-background p-2" value={value} onChange={(event) => onEdit(event.target.value)} />;
}
