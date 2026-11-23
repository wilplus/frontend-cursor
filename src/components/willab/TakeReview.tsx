"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { fetchArcFeedback, type FeedbackKeyMoment } from "@/services/api/arcFeedback";
import { fetchIdealText, type DocumentSuggestion, type IdealTextResult } from "@/services/api/idealText";
import { fetchIdealTextRevisions, type IdealTextRevision } from "@/services/api/blockVariants";
import { fetchReviewTempo } from "@/services/api/reviewTempo";
import { readReviewCopy, saveReviewCopy, type ReviewCopy, type ReviewRevision } from "@/services/api/takeReview";
import type { TrainingArc, TrainingTake } from "@/services/api/trainings";
import type { ChatQueryArgs } from "@/services/api/chatQuery";
import { helperHeadlineOf, slideGroupsOf } from "@/lib/willab/pastIdealText";
import { helperWordRanges, missingHelperWords } from "@/lib/willab/answeredBookmark";
import { WILLAB_CONTENT_RAIL } from "@/lib/willab/layout";
import AiGeneratedNote from "./AiGeneratedNote";
import DeckSlideThumb from "./DeckSlideThumb";
import IdealTextOverlay from "./IdealTextOverlay";
import LoadingState from "./LoadingState";
import OverlayCloseButton from "./OverlayCloseButton";
import { PageHeader } from "./PageHeader";
import { RichText } from "./RichText";
import { useBackDismiss } from "./useBackDismiss";
import { HelpersLabel } from "./TranscriptReviewDeck";
import WalkPlayer from "./walk/WalkPlayer";

export type ReviewFocus = NonNullable<NonNullable<ChatQueryArgs["presentationContext"]>["review_focus"]>;
export type TakeReviewTarget = { take: TrainingTake; focus: ReviewFocus };
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
  return { revision, evidence: { ...evidence, moment }, live };
}

function focusFor(step: Step, moment: FeedbackKeyMoment | null): ReviewFocus {
  return {
    step,
    ...(moment ? { snippet_id: moment.snippetId } : {}),
    ...(moment?.slideIndex == null ? {} : { slide_index: moment.slideIndex }),
  };
}

function editable(step: Step, artifact: Artifact | null, saved: ReviewRevision | null, sections: string[]) {
  if (!artifact || step === "practise") return false;
  return step === "feedback" ? saved !== null : sections.length > 0 && (artifact.live || saved !== null);
}

function ReviewEngine({ arc, take, evidence, mode, onClose, onUnavailable }: {
  arc: string; take: TrainingTake; evidence: ReviewEvidence | undefined; mode: "practise" | "edit";
  onClose: () => void; onUnavailable: () => void;
}) {
  const practising = mode === "practise";
  const snippet = evidence?.moment?.snippetId ?? null;
  return (
    <IdealTextOverlay arcId={arc} reviewTake={take.sessionId} reviewTakeIndex={take.takeIndex}
      initialMode={practising ? "review" : "notebook"}
      reviewAt={practising ? { practise: true, take: take.sessionId, snippet } : null}
      takeReviewEdit={!practising} onPracticeUnavailable={practising ? onUnavailable : undefined}
      onClose={onClose} />
  );
}

export default function TakeReview({
  project, target, runCount, onClose, onAsk, onPracticeEnded, onNextTake,
}: {
  project: TrainingArc;
  target: TakeReviewTarget;
  runCount: number;
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
  const [engine, setEngine] = useState<"practise" | "edit" | null>(null);
  const [noPractice, setNoPractice] = useState(false);
  const [copy, setCopy] = useState<ReviewRevision | null>(null);
  const [draft, setDraft] = useState<ReviewCopy | null>(null);
  const [saveMessage, setSaveMessage] = useState("");
  const savingEdit = saveMessage === "Saving…";
  const saving = useRef(false);
  const anchor = useRef<HTMLElement | null>(null);

  useEffect(() => {
    let current = true;
    void loadArtifact(project.arcId, take, target.focus.snippet_id).then((result) => {
      if (current) {
        setArtifact(result);
        setFailed(false);
      }
    }, () => { if (current) setFailed(true); });
    void readReviewCopy(project.arcId, take.sessionId).then((result) => { if (current) setCopy(result); }).catch(() => undefined);
    return () => { current = false; };
  }, [project.arcId, take, refresh, target.focus.snippet_id]);

  useEffect(() => { anchor.current?.scrollIntoView?.({ block: "start" }); }, [artifact, step]);
  const moment = artifact?.evidence.moment ?? null;
  const groups = artifact?.revision ? slideGroupsOf(artifact.revision) : [];
  const sections = groups.map((group) => group.paragraphs.join("\n\n"));
  const savedIdeal = copy?.document.ideal_sections;
  const ideal = savedIdeal?.length === sections.length && !artifact?.live ? savedIdeal : sections;
  const feedback = copy?.document.feedback ?? moment?.commentText ?? "";
  const ask = (focus: ReviewFocus) => onAsk({ take, focus });
  const next = REVIEW_STEPS[REVIEW_STEPS.findIndex((entry) => entry.step === step) + 1];

  async function exit(action?: () => void) {
    if (saving.current) return;
    if (draft) {
      if (!copy) return;
      saving.current = true;
      setSaveMessage("Saving…");
      const result = await saveReviewCopy(project.arcId, take.sessionId, copy.revision, draft).catch(() => null);
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
  useBackDismiss(() => { if (!engine) void exit(onClose); });

  if (engine) {
    return <ReviewEngine arc={project.arcId} take={take} mode={engine} evidence={artifact?.evidence}
      onUnavailable={() => { setNoPractice(true); setEngine(null); }}
      onClose={() => {
        if (engine === "practise") onPracticeEnded();
        else setRefresh((v) => v + 1);
        setEngine(null);
      }} />;
  }

  function startEditing() {
    if (step === "feedback") setDraft({ feedback });
    if (step === "ideal") {
      if (artifact?.live) setEngine("edit");
      else setDraft({ ideal_sections: ideal });
    }
  }

  return (
    <article data-take-review data-review-step={step} className="absolute inset-0 z-40 flex flex-col bg-background">
      <PageHeader contentClassName="justify-between gap-3 px-4 py-2.5">
        <div className="min-w-0">
          <p className="break-words text-[17px] font-semibold">{project.topic}</p>
          <AiGeneratedNote kind="ideal-text" name={project.topic} take={take.takeIndex} />
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {draft ? <button className={LINK} type="button" disabled={savingEdit} onClick={() => void exit()}>Done</button> :
            editable(step, artifact, copy, ideal) ? <button className={LINK} type="button" onClick={startEditing}>Edit text</button> : null}
          <OverlayCloseButton onClick={() => void exit(onClose)} disabled={savingEdit} />
        </div>
      </PageHeader>
      <div className="scrollbar-none min-h-0 flex-1 overflow-y-auto">
        <div className={`${WILLAB_CONTENT_RAIL} space-y-4 px-4 py-5`}>
          <h2 className="text-xl font-semibold">{REVIEW_STEPS.find((item) => item.step === step)?.label}</h2>
          {saveMessage ? <p role="status" className="text-sm text-muted-foreground">{saveMessage}</p> : null}
          {!artifact && !failed ? <LoadingState placement="surface" /> : null}
          {failed ? <button type="button" className={BUTTON} onClick={() => setRefresh((v) => v + 1)}>Try again</button> : null}
          {step === "feedback" && artifact ? (
            <ReviewMoment feedback={feedback} draft={draft?.feedback} moment={moment}
              onEdit={(text) => setDraft({ feedback: text })}
              onAsk={() => void exit(() => ask(focusFor("feedback", moment)))} />
          ) : null}
          {step === "practise" && artifact ? <PractiseStep activity={artifact.evidence.activity}
            unavailable={noPractice} repeated={runCount > 0} onTry={() => setEngine("practise")}
            onAsk={() => ask(focusFor("practise", moment))} /> : null}
          {step === "ideal" && artifact ? <IdealStep revision={artifact.revision} groups={groups}
            text={ideal} draft={draft?.ideal_sections} slide={target.focus.slide_index} anchor={anchor}
            onEdit={(ideal_sections) => setDraft({ ideal_sections })}
            onAsk={(index) => void exit(() => ask(index === null ? { step: "ideal" } : { step: "ideal", slide_index: index }))} /> : null}
          {next ? <button type="button" className={BUTTON} disabled={savingEdit} onClick={() => void exit(() => setStep(next.step))}>{next.label}</button> :
            <button type="button" className={BUTTON} disabled={savingEdit} onClick={() => void exit(onNextTake)}>Continue recording</button>}
        </div>
      </div>
    </article>
  );
}

function PractiseStep({ activity, unavailable, repeated, onTry, onAsk }: {
  activity: string | null; unavailable: boolean; repeated: boolean; onTry: () => void; onAsk: () => void;
}) {
  return <div className="space-y-2">
    {activity ? <p className="font-semibold">{activity}</p> : null}
    {unavailable ? <p className="text-sm text-muted-foreground">No activity for this Take yet.</p> :
      <button className={BUTTON} type="button" onClick={onTry}>Try it</button>}
    {repeated ? <span className="ml-2 text-xs text-muted-foreground">Practised before</span> : null}
    <div><button className={LINK} type="button" onClick={onAsk}>Ask coach</button></div>
  </div>;
}

function IdealStep({ revision, groups, text, draft, slide, anchor, onEdit, onAsk }: {
  revision: IdealTextRevision | null; groups: ReturnType<typeof slideGroupsOf>;
  text: string[]; draft?: string[]; slide?: number; anchor: React.RefObject<HTMLElement | null>;
  onEdit: (sections: string[]) => void; onAsk: (index: number | null) => void;
}) {
  if (!revision || groups.length === 0) return <p className="text-sm text-muted-foreground">Ideal text isn’t available for this Take yet.</p>;
  return <div className="space-y-5">
    {groups.map((group, index) => (
      <ReviewSlide key={index} nodeRef={slide === group.slideIndex ? anchor : undefined}
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
    <div className="max-w-2xl space-y-3">
      {draft !== undefined ? <ReviewField label="Edit feedback" value={draft} onEdit={onEdit} /> :
        feedback ? <p className="whitespace-pre-wrap">{feedback}</p> : null}
      {moment ? (
        <div className="space-y-2 border-l border-border pl-3">
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

function ReviewSlide({ slide, revision, text, draft, nodeRef, onEdit, onAsk }: {
  slide: number | null; revision: IdealTextRevision; text: string; draft?: string;
  nodeRef?: React.RefObject<HTMLElement | null>; onEdit: (text: string) => void; onAsk: () => void;
}): ReactNode {
  const headline = helperHeadlineOf(revision, slide);
  return (
    <section ref={nodeRef} className="max-w-2xl space-y-2">
      {slide === null ? null : <>
        <h3 className="font-semibold">Slide {slide + 1}</h3>
        <DeckSlideThumb presentationRef={revision.presentationRef} pageIndex={slide} label={`Slide ${slide + 1}`} />
      </>}
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
