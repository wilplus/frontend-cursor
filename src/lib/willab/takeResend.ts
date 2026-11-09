import type { LabUploadInput, LabUploadResult } from "@/services/api/labRecording";
import type { LoungeMessage, LoungeMessageDraft } from "@/services/api/loungeMessages";
import { createProject } from "@/services/api/projects";
import { fetchTrainings, type TrainingArc } from "@/services/api/trainings";
import { fetchConsentChoices } from "@/services/api/consentChoices";
import { readoutSummaryDraft } from "@/components/willab/loungeReports";
import { keepRealTalkSlides } from "./firstTake";
import { applyNextTakeShare } from "./nextTakeShare";
import { writeProcessingTake, type ProcessingTake } from "./processingTake";
import { outboxOwner } from "./voiceNoteOutbox";
import {
  dropTake,
  expiredTake,
  isLive,
  sendTake,
  setTakeProject,
  takeAudio,
  takeOutcome,
  waitingTakes,
  type KeptTake,
} from "./takeOutbox";

/* -------------------------------------------------------------------------- */
/*  takeResend — a kept Take whose upload never finished goes up again          */
/*  (backend N553 item 2, N556 item 2 and 3).                                  */
/*                                                                            */
/*  One pass, oldest first, one Take at a time: only the person who recorded */
/*  it, signed in; through the same upload (sendTake → submitLabRecording)    */
/*  with the same upload key. Accepted, it shows as processing as any Take    */
/*  does: the processing marker, the share chosen for it, and its "Your       */
/*  Recording" line unless the thread already has one. Nothing new on screen. */
/*                                                                            */
/*  Not sent, and deleted: past 7 days; recording consent withdrawn; a newer  */
/*  Take of the same project already on the server (an older Take never       */
/*  becomes the Ideal Text, Never 5).                                         */
/* -------------------------------------------------------------------------- */

export interface ResendDeps {
  /** The signed-in person; null signed out (then only the 7 days run). */
  ownerId: string | null;
  /** The Lab opened: what is left waits for the next pass. */
  labOpen: () => boolean;
  messages: () => readonly Pick<LoungeMessage, "kind" | "metadata">[];
  append: (draft: LoungeMessageDraft) => Promise<unknown>;
  /** A Take is going up again (the record button waits, N556 item 2). */
  onSending: (sending: boolean) => void;
  /** Kept after this answer, with the answer's code (a policy update?). */
  onKept: (code: string | undefined) => void;
}

/** "more": a Take went up and another waits its turn. */
export type PassEnd = "done" | "more";

type Step = "next" | "sent" | "stop";

interface PassReads {
  recordingWithdrawn: () => Promise<boolean>;
  arcs: () => Promise<TrainingArc[] | null>;
}

function passReads(): PassReads {
  let consent: Promise<boolean> | null = null;
  let arcs: Promise<TrainingArc[] | null> | null = null;
  return {
    recordingWithdrawn: () =>
      (consent ??= fetchConsentChoices()
        .then((c) => c?.hasReceipt === true && c.sensitiveInformation === false)
        .catch(() => false)),
    arcs: () => (arcs ??= fetchTrainings().catch(() => null)),
  };
}

function hasRecordingLine(
  messages: readonly Pick<LoungeMessage, "kind" | "metadata">[],
  sessionId: string,
): boolean {
  return messages.some((m) => m.kind === "recording_summary" && m.metadata?.session_id === sessionId);
}

/** Whether a Take of this copy's project, recorded after it, is already on
 *  the server. null: the list is unread.
 *
 *  The server names the upload key of each Take: if one is this copy's, the
 *  copy arrived and only its answer was lost, so it goes (the server answers
 *  `duplicate`); otherwise any Take made after this one's Finish is newer.
 *
 *  A server that does not name the keys (before backend #1824): two Takes
 *  made after this one's Finish mean one is newer; a single one is newer
 *  when it already has its "Your Recording" line (its own device got the
 *  answer), and otherwise may be this very Take, whose answer never came. */
export function newerTakeOnServer(
  take: KeptTake,
  arcs: TrainingArc[] | null,
  messages: readonly Pick<LoungeMessage, "kind" | "metadata">[],
): boolean | null {
  if (!arcs) return null;
  const takes = arcs.find((a) => a.arcId === take.projectId)?.takes ?? [];
  if (takes.some((t) => t.uploadKey === take.key)) return false;
  const after = takes.filter((t) => t.createdAt && Date.parse(t.createdAt) > take.savedAt);
  if (takes.some((t) => t.uploadKey !== undefined)) return after.length > 0;
  if (after.length > 1) return true;
  return after.length === 1 && hasRecordingLine(messages, after[0].sessionId);
}

async function makeProject(take: KeptTake): Promise<string | null> {
  const u = take.upload;
  const created = await createProject({
    displayName: u.topic,
    presentationRef: u.presentationRef,
    setup: {
      topic: u.topic,
      audience: u.audience,
      target_length_seconds: u.targetLengthSeconds,
      domain_vocabulary: u.domainVocabulary,
      slides: u.slides,
      presentation_ref: u.presentationRef,
      strategic_context: u.strategicContext ?? null,
      presentation_mode: take.deckless ? "deckless" : "pdf",
    },
  });
  if (created.kind !== "ok") return null;
  await setTakeProject(take.key, created.projectId);
  return created.projectId;
}

function uploadOf(take: KeptTake, projectId: string, sound: { audio: Blob; document?: File }): LabUploadInput {
  const u = take.upload;
  return {
    audioBlob: sound.audio,
    projectId,
    uploadIdempotencyKey: take.key,
    durationSec: u.durationSec,
    topic: u.topic,
    audience: u.audience || undefined,
    targetLengthSeconds: u.targetLengthSeconds,
    domainVocabulary: u.domainVocabulary,
    slides: u.slides,
    presentationRef: u.presentationRef,
    strategicContext: u.strategicContext,
    contextDocument: sound.document,
    slideAdvances: u.slideAdvances,
    slideClockOffsetMs: u.slideClockOffsetMs,
    feeling: u.feeling,
  };
}

type Marker = Omit<ProcessingTake, "startedAt" | "phaseStartedAt" | "phase" | "status" | "progress"> &
  Partial<Pick<ProcessingTake, "phase" | "status" | "progress">>;

/** The processing marker the Lab writes for the same answer. */
function markerOf(result: LabUploadResult, projectId: string, take: KeptTake): Marker | null {
  if (result.kind === "processing") {
    return {
      sessionId: result.sessionId,
      arcId: result.arcId ?? projectId,
      takeIndex: result.takeIndex ?? take.takeIndex,
      progress: { stage: "processing_recording", percent: 5 },
    };
  }
  if (result.kind === "ideal_text_unconfirmed") {
    return {
      sessionId: result.sessionId,
      arcId: result.arcId,
      takeIndex: 1,
      status: "failed_ideal_text_unconfirmed",
      progress: { stage: "ideal_text", percent: null },
    };
  }
  if (result.kind !== "ok" || !result.sessionId) return null;
  return {
    sessionId: result.sessionId,
    arcId: result.arcId ?? projectId,
    takeIndex: result.takeIndex ?? take.takeIndex,
    phase: "document",
    progress: { stage: "document_assembly", percent: null },
  };
}

/** As any accepted Take: its share, its line, then the processing view. */
function showAsProcessing(take: KeptTake, marker: Marker, deps: ResendDeps): void {
  applyNextTakeShare(marker.sessionId);
  if (!hasRecordingLine(deps.messages(), marker.sessionId)) {
    void deps
      .append(
        readoutSummaryDraft({
          topic: take.upload.topic,
          recordingId: marker.sessionId,
          sessionId: marker.sessionId,
          arcId: marker.arcId ?? undefined,
          takeIndex: marker.takeIndex ?? undefined,
          feeling: take.upload.feeling,
        }),
      )
      .catch(() => undefined);
  }
  const now = Date.now();
  writeProcessingTake(take.ownerId, { ...marker, startedAt: now, phaseStartedAt: now });
}

function afterAnswer(take: KeptTake, projectId: string, result: LabUploadResult, deps: ResendDeps): Step {
  const marker = markerOf(result, projectId, take);
  if (marker) {
    showAsProcessing(take, marker, deps);
    return "sent";
  }
  if (takeOutcome(result) !== "kept") return "next";
  deps.onKept(result.kind === "error" ? result.code : undefined);
  return "stop";
}

/** The project the copy goes to, or why it does not go now. */
async function projectFor(
  take: KeptTake,
  deps: ResendDeps,
  reads: PassReads,
): Promise<{ projectId: string } | { step: Step }> {
  if (!take.projectId) {
    const made = await makeProject(take);
    return made ? { projectId: made } : { step: "stop" };
  }
  const newer = newerTakeOnServer(take, await reads.arcs(), deps.messages());
  if (newer === null) return { step: "stop" };
  if (!newer) return { projectId: take.projectId };
  await dropTake(take.key);
  return { step: "next" };
}

async function resendOne(take: KeptTake, deps: ResendDeps, reads: PassReads): Promise<Step> {
  // The person the server will see, read from the token this send carries:
  // a sign-in that changed since the pass began never sends another's Take.
  if ((await outboxOwner())?.id !== take.ownerId) return "stop";
  if (await reads.recordingWithdrawn()) {
    await dropTake(take.key);
    return "next";
  }
  const target = await projectFor(take, deps, reads);
  if ("step" in target) return target.step;
  const { projectId } = target;
  await keepRealTalkSlides(take.ownerId, projectId, {
    slides: take.upload.slides,
    presentationRef: take.upload.presentationRef,
  });
  const sound = await takeAudio(take);
  if (!sound) {
    await dropTake(take.key);
    return "next";
  }
  deps.onSending(true);
  try {
    return afterAnswer(take, projectId, await sendTake(uploadOf(take, projectId, sound)), deps);
  } finally {
    deps.onSending(false);
  }
}

async function pass(deps: ResendDeps): Promise<PassEnd> {
  const reads = passReads();
  const takes = await waitingTakes();
  for (let i = 0; i < takes.length; i += 1) {
    const take = takes[i];
    if (expiredTake(take)) {
      await dropTake(take.key);
      continue;
    }
    if (!deps.ownerId || take.ownerId !== deps.ownerId || isLive(take.key)) continue;
    if (deps.labOpen()) return "done";
    const step = await resendOne(take, deps, reads);
    if (step === "stop") return "done";
    if (step === "sent") return i < takes.length - 1 ? "more" : "done";
  }
  return "done";
}

let passing = false;

/** One pass over the kept Takes. Never throws; a pass already running is
 *  not doubled. */
export async function resendKeptTakes(deps: ResendDeps): Promise<PassEnd> {
  if (passing) return "done";
  passing = true;
  try {
    return await pass(deps);
  } catch {
    return "done";
  } finally {
    passing = false;
  }
}
