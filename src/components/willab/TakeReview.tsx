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
import type { PracticeDecision } from "@/lib/willab/practiceResume";
import type { LoungeMessage } from "@/services/api/loungeMessages";
import AiGeneratedNote from "./AiGeneratedNote";
import DeckSlideThumb from "./DeckSlideThumb";
import { EditableText } from "./FeedbackWalkCard";
import IdealTextOverlay from "./IdealTextOverlay";
import TypingDots from "./TypingDots";
import { RichText } from "./RichText";
import { useBackDismiss } from "./useBackDismiss";
import { HelpersLabel } from "./TranscriptReviewDeck";
import WalkPlayer from "./walk/WalkPlayer";
import { InlineWalkHost, scrollWithinProject } from "./walk/InlineWalkHost";
import TakeReviewPracticeHistory, { isSavedPracticeAttempt } from "./TakeReviewPracticeHistory";
import { ChatArtifactPanel } from "./chats/ChatArtifact";
import type { FeedbackWalkSlideRange } from "./useDeckFeedbackWalk";

export type ReviewFocus = NonNullable<NonNullable<ChatQueryArgs["presentationContext"]>["review_focus"]>;
export type TakeReviewTarget = {
  take: TrainingTake;
  focus: ReviewFocus;
  walkRange?: FeedbackWalkSlideRange;
  openWalk?: boolean;
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

type Engine = "walk" | "practise" | "edit" | "document";

function ReviewEngine({ arc, target, evidence, mode, recordingDock, savedSteps, practiceDecision, onClose, onUnavailable, onNextTake }: {
  arc: string;
  target: TakeReviewTarget;
  evidence: ReviewEvidence | undefined;
  mode: Engine;
  recordingDock: HTMLDivElement | null;
  savedSteps: readonly LoungeMessage[];
  practiceDecision?: PracticeDecision;
  onClose: () => void;
  onUnavailable: () => void;
  onNextTake: () => void;
}) {
  const { take, walkRange } = target;
  if (mode === "edit" || mode === "document") {
    return <IdealTextOverlay arcId={arc} reviewTake={take.sessionId} reviewTakeIndex={take.takeIndex}
      takeReviewEdit={mode === "edit"} onClose={onClose} onReadAloud={onNextTake}
      practiceDecision={practiceDecision} />;
  }
  return <InlineWalkHost.Provider value={{ recordingDock, savedSteps }}>
    <IdealTextOverlay arcId={arc} reviewTake={take.sessionId} reviewTakeIndex={take.takeIndex}
      initialMode="review" reviewSlideRange={walkRange} requireFeedbackWalk
      coachTake={mode === "walk" ? take.sessionId : undefined}
      reviewAt={mode === "practise" ? { practise: true, take: take.sessionId, snippet: evidence?.moment?.snippetId ?? null } : null}
      onPracticeUnavailable={onUnavailable} onClose={onClose} />
  </InlineWalkHost.Provider>;
}

export default function TakeReview({
  project, target, runs, messages, recordingDock, practiceDecision, exitRef, onClose, onAsk, onPracticeEnded, onNextTake,
}: {
  project: TrainingArc;
  target: TakeReviewTarget;
  runs: readonly ReviewRun[];
  messages: readonly LoungeMessage[];
  recordingDock: HTMLDivElement | null;
  practiceDecision?: PracticeDecision;
  exitRef: MutableRefObject<ReviewExit | null>;
  onClose: () => void;
  onAsk: (target: TakeReviewTarget) => void;
  onPracticeEnded: () => void;
  onNextTake: () => void;
}) {
  const { take } = target;
  const [step, setStep] = useState(target.focus.step);
  const [artifact, setArtifact] = useState<Artifact | null>(null);
  const [failed, setFailed] = useState(false);
  const [refresh, setRefresh] = useState(0);
  const [engine, setEngine] = useState<Engine | null>(() => target.openWalk ? "walk" : null);
  const [noPractice, setNoPractice] = useState(false);
  const [savedSteps, setSavedSteps] = useState<readonly LoungeMessage[]>([]);
  const { copy, draft, setDraft, saveMessage, savingEdit, exit } = useReviewEdits(project.arcId, take.sessionId, refresh, exitRef);
  const article = useRef<HTMLElement | null>(null);

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
    void readReviewSteps(project.arcId, take.sessionId).then((rows) => {
      if (current) setSavedSteps(rows);
    }).catch(() => undefined);
    return () => { current = false; };
  }, [project.arcId, take.sessionId, refresh, runs.length]);
  const history = useMemo(() => {
    const byId = new Map([...messages, ...savedSteps]
      .filter((message) => message.kind === "walk_step" && message.metadata?.arc_id === project.arcId &&
        message.metadata?.take_session_id === take.sessionId)
      .map((message) => [message.client_id, message]));
    return [...byId.values()].sort((a, b) => a.client_created_at.localeCompare(b.client_created_at));
  }, [messages, savedSteps, project.arcId, take.sessionId]);

  const loaded = artifact !== null;
  const moment = artifact?.evidence.moment ?? null;
  const groups = artifact?.revision ? slideGroupsOf(artifact.revision) : [];
  const sections = groups.map((group) => group.paragraphs.join("\n\n"));
  const savedIdeal = copy?.document.ideal_sections;
  const ideal = savedIdeal?.length === sections.length && !artifact?.live ? savedIdeal : sections;
  const feedback = copy?.document.feedback ?? moment?.commentText ?? "";
  const ask = (focus: ReviewFocus) => void exit(() => onAsk({ take, focus }));

  useEffect(() => { article.current?.focus({ preventScroll: true }); }, [target.focus]);
  useEffect(() => {
    setStep(target.focus.step);
    const node = target.focus.step === "ideal" && target.focus.slide_index !== undefined
      ? article.current?.querySelector<HTMLElement>('[data-review-slide="' + target.focus.slide_index + '"]')
      : article.current?.querySelector<HTMLElement>('[data-review-section="' + target.focus.step + '"]');
    scrollWithinProject(node ?? article.current);
  }, [target.focus, loaded]);

  function jump(next: Step) {
    void exit(() => {
      setStep(next);
      scrollWithinProject(article.current?.querySelector<HTMLElement>('[data-review-section="' + next + '"]'));
    });
  }

  function closeEngine() {
    setEngine(null);
    if (engine === "practise" || engine === "walk") onPracticeEnded();
    setRefresh((v) => v + 1);
  }

  useBackDismiss(() => void exit(onClose), () => {
    if (engine) {
      closeEngine();
      return true;
    }
    if (!draft && !savingEdit) return false;
    void exit(onClose);
    return true;
  });

  function startEditing(section: "feedback" | "ideal") {
    if (section === "feedback") setDraft({ feedback });
    else if (artifact?.live) setEngine("edit");
    else setDraft({ ideal_sections: ideal });
  }

  const engineView = engine ? <ReviewEngine arc={project.arcId} target={target} mode={engine}
    evidence={artifact?.evidence} recordingDock={recordingDock} savedSteps={history}
    practiceDecision={practiceDecision} onClose={closeEngine}
    onUnavailable={() => {
      if (engine === "practise") setNoPractice(true);
      closeEngine();
    }}
    onNextTake={() => void exit(onNextTake)} /> : null;
  const draftFeedback = draft?.feedback !== undefined;
  const draftIdeal = draft?.ideal_sections !== undefined;
  const done = () => void exit();
  const retry = () => setRefresh((v) => v + 1);

  const momentSection = <div data-review-section="feedback" aria-label="Feedback" className="space-y-1.5">
    <TakeReviewStatus project={project} take={take} loading={!artifact} failed={failed} onRetry={retry} />
    {artifact ? <>
      <ReviewMoment feedback={feedback} draft={draft?.feedback} moment={moment}
        onEdit={(text) => setDraft({ feedback: text })} onAsk={() => ask(focusFor("feedback", moment))} />
      <ReviewEditAction editing={draftFeedback} canEdit={copy !== null && !draftIdeal}
        busy={savingEdit} onEdit={() => startEditing("feedback")} onDone={done} />
    </> : null}
  </div>;
  const intervention = <>
      <nav aria-label="Take review" className="flex max-w-[320px] flex-wrap gap-2">
        {REVIEW_STEPS.map(({ step: next, label }) => (
          <button key={next} type="button" className={LINK + " rounded px-2"} disabled={savingEdit} onClick={() => jump(next)}>{label}</button>
        ))}
      </nav>
      {saveMessage ? <p role="status" className="text-sm text-muted-foreground">{saveMessage}</p> : null}

      {engine === "walk" ? <div className="w-full">{engineView}</div> : artifact ? (
        <button type="button" className={LINK} onClick={() => void exit(() => setEngine("walk"))}>Review feedback</button>
      ) : null}

      <div data-review-section="practise" aria-label="Practise">
        {artifact ? <PractiseStep evidence={artifact.evidence} unavailable={noPractice} repeated={runs.length > 0}
          trying={engine === "practise"} onTry={() => void exit(() => setEngine("practise"))} onSkip={() => jump("ideal")}
          onAsk={() => ask(focusFor("practise", moment))} /> : null}
        {engine === "practise" ? engineView : null}
      </div>
    </>;
  const output = reviewOutput({
    engine, runs, history, step, artifact, project, take, groups, ideal, draft, savingEdit, editable: copy !== null,
    onEdit: () => startEditing("ideal"), onDone: done, onDraft: (ideal_sections) => setDraft({ ideal_sections }),
    onAsk: ask, onOpen: () => void exit(() => setEngine("document")),
  });
  const footer = <>
    {!engine ? <button type="button" className={BUTTON + " w-fit"} disabled={savingEdit}
      onClick={() => void exit(onNextTake)}>Continue recording</button> : null}
    {engine === "edit" || engine === "document" ? engineView : null}
  </>;
  return <ChatArtifactPanel panelRef={article} data-take-review data-review-step={step}
    aria-label={"Take " + take.takeIndex + " review"} className="max-w-2xl"
    moment={momentSection} intervention={intervention} output={output} footer={footer}
    hideMinimise={engine !== null || savingEdit} onMinimise={() => void exit(onClose)} />;
}

function reviewOutput({
  engine, runs, history, step, artifact, project, take, groups, ideal, draft, savingEdit, editable,
  onEdit, onDone, onDraft, onAsk, onOpen,
}: {
  engine: Engine | null; runs: readonly ReviewRun[]; history: readonly LoungeMessage[];
  step: Step; artifact: Artifact | null; project: TrainingArc; take: TrainingTake;
  groups: ReturnType<typeof slideGroupsOf>; ideal: string[]; draft: ReviewCopy | null;
  savingEdit: boolean; editable: boolean;
  onEdit: () => void; onDone: () => void; onDraft: (sections: string[]) => void;
  onAsk: (focus: ReviewFocus) => void; onOpen: () => void;
}): ReactNode {
  const showRuns = engine !== "practise" && engine !== "walk" && (runs.length > 0 || history.some(isSavedPracticeAttempt));
  const hasIdeal = Boolean(artifact?.revision || artifact?.live);
  const showIdeal = artifact && (hasIdeal || step === "ideal");
  if (!showRuns && !showIdeal) return null;
  return <>
    {showRuns ? <TakeReviewPracticeHistory runs={runs} messages={history} /> : null}
    {showIdeal ? <div data-review-section="ideal" aria-label="Ideal text" className="space-y-1">
      <h3 className="font-semibold">Ideal text</h3>
      {hasIdeal ? <AiGeneratedNote kind="ideal-text" name={project.topic} take={take.takeIndex} /> : null}
      <IdealStep revision={artifact.revision} groups={groups} text={ideal} draft={draft?.ideal_sections}
        onEdit={onDraft}
        onAsk={(index) => onAsk(index === null ? { step: "ideal" } : { step: "ideal", slide_index: index })} />
      <div className="flex flex-wrap items-center gap-x-3">
        <ReviewEditAction editing={draft?.ideal_sections !== undefined}
          canEdit={ideal.length > 0 && draft?.feedback === undefined && (artifact.live || editable)}
          busy={savingEdit} onEdit={onEdit} onDone={onDone} />
        {artifact.live ? <button type="button" className={LINK} onClick={onOpen}>Open Ideal text</button> : null}
      </div>
    </div> : null}
  </>;
}

function TakeReviewStatus({ project, take, loading, failed, onRetry }: {
  project: TrainingArc; take: TrainingTake; loading: boolean; failed: boolean; onRetry: () => void;
}) {
  const latest = !project.takes.some((item) => item.takeIndex > take.takeIndex);
  const coverage = project.practiceCoverage;
  const range = project.practiceChunks.find((chunk) => chunk.latestSessionId === take.sessionId);
  const [rangeLabel, setRangeLabel] = useState<string | null>(null);
  return <>
    <p className="text-[13px] text-muted-foreground">
      <strong className="font-medium text-foreground">Take {take.takeIndex} is ready.</strong>
      {latest && coverage?.total ? <> You’ve practised {coverage.practised} of {coverage.total} {coverage.unit}.</> : null}
      {latest && !coverage?.total && project.practiceProgress > 0 ? <> Progress · {Math.round(project.practiceProgress)}%</> : null}
      {range ? <> · <EditableText value={rangeLabel ?? `Slides ${range.startSlide}–${range.endSlide}`}
        label="Edit slide range" onCommit={setRangeLabel} className="rounded underline-offset-2 hover:underline focus:outline-primary" />
        {range.attempts > 0 ? ` · ${range.attempts} ${range.attempts === 1 ? "attempt" : "attempts"}` : null}
      </> : null}
    </p>
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

function ReviewEditAction({ editing, canEdit, busy, onEdit, onDone }: {
  editing: boolean; canEdit: boolean; busy: boolean; onEdit: () => void; onDone: () => void;
}) {
  if (editing) return <button type="button" className={LINK} disabled={busy} onClick={onDone}>Done</button>;
  return canEdit ? <button type="button" className={LINK} onClick={onEdit}>Edit text</button> : null;
}

function PractiseStep({ evidence, unavailable, repeated, trying, onTry, onSkip, onAsk }: {
  evidence: ReviewEvidence; unavailable: boolean; repeated: boolean; trying: boolean;
  onTry: () => void; onSkip: () => void; onAsk: () => void;
}) {
  return <div className="space-y-1">
    {evidence.activity ? <p className="font-medium">{evidence.activity}</p> : null}
    {evidence.instruction ? <p>{evidence.instruction}</p> : null}
    {unavailable ? <p className="text-sm text-muted-foreground">No activity for this Take yet.</p> :
      trying ? null : <div className="flex flex-wrap items-center gap-x-3">
        <button className={BUTTON} type="button" onClick={onTry}>Try it</button>
        <button className={LINK} type="button" onClick={onSkip}>Skip</button>
        {repeated ? <span className="text-xs text-muted-foreground">Practised before</span> : null}
      </div>}
    <button className={LINK} type="button" onClick={onAsk}>Ask coach</button>
  </div>;
}

function IdealStep({ revision, groups, text, draft, onEdit, onAsk }: {
  revision: IdealTextRevision | null; groups: ReturnType<typeof slideGroupsOf>;
  text: string[]; draft?: string[];
  onEdit: (sections: string[]) => void; onAsk: (index: number | null) => void;
}) {
  if (!revision || groups.length === 0) return <p className="text-sm text-muted-foreground">Ideal text isn’t available for this Take yet.</p>;
  return <div className="space-y-5">
    {groups.map((group, index) => (
      <ReviewSlide key={index}
        slide={group.slideIndex} revision={revision} text={text[index]} draft={draft?.[index]}
        onEdit={(next) => onEdit((draft ?? text).map((part, i) => i === index ? next : part))}
        onAsk={() => onAsk(group.slideIndex)} />
    ))}
  </div>;
}

function ReviewMoment({ feedback, draft, moment, onEdit, onAsk }: {
  feedback: string; draft?: string; moment: FeedbackKeyMoment | null;
  onEdit: (text: string) => void; onAsk: () => void;
}) {
  return (
    <div className="max-w-2xl space-y-1.5">
      {draft !== undefined ? <ReviewField label="Edit feedback" value={draft} onEdit={onEdit} /> :
        feedback ? <p className="whitespace-pre-wrap">{feedback}</p> : null}
      {moment ? (
        <div className="space-y-1.5 border-t border-border pt-2">
          {moment.slideIndex !== null ? <p className="text-xs text-muted-foreground">Slide {moment.slideIndex + 1}</p> : null}
          <p>{moment.transcript}</p>
          {moment.audioRef ? <WalkPlayer seed={moment.snippetId} label="moment" src={moment.audioRef}
            startOffsetMs={moment.startOffsetMs} durationMs={moment.durationMs || null} look="bare" /> : null}
        </div>
      ) : <p className="text-sm text-muted-foreground">Feedback isn’t available for this Take yet.</p>}
      <button type="button" className={LINK} onClick={onAsk}>Ask coach</button>
    </div>
  );
}

function ReviewSlide({ slide, revision, text, draft, onEdit, onAsk }: {
  slide: number | null; revision: IdealTextRevision; text: string; draft?: string;
  onEdit: (text: string) => void; onAsk: () => void;
}): ReactNode {
  const headline = helperHeadlineOf(revision, slide);
  return (
    <section data-review-slide={slide ?? undefined} className="max-w-2xl space-y-2 border-t border-border pt-2">
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
      <button type="button" className={LINK} onClick={onAsk}>Ask coach</button>
    </section>
  );
}

function ReviewField({ label, value, onEdit }: { label: string; value: string; onEdit: (text: string) => void }) {
  return <textarea aria-label={label} className="block min-h-24 w-full rounded-lg border border-border bg-background p-2" value={value} onChange={(event) => onEdit(event.target.value)} />;
}
