"use client";

import { Fragment, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode, type SetStateAction } from "react";
import ChatComposer, { type ChatComposerProps, type ComposerFileAction } from "./chats/ChatComposer";
import { ChatArtifactScope } from "./chats/ChatArtifact";
import { useComposerVoice } from "./chats/useComposerVoice";
import { ChatPracticeContext, useSpeakingPractice } from "./chats/ChatPractice";
import LoungeTakeConversation, { type TakeCitation } from "./LoungeTakeConversation";
import { isChatPracticeTurn, takeSessionOf } from "@/lib/willab/takeExchange";
import type { PlanLounge } from "./plan/usePlanLounge";
import RecordNextTakeLink from "./chats/RecordNextTakeLink";
import { fetchTrainings } from "@/services/api/trainings";
import { unarchiveProject } from "@/services/api/projectArchive";
import { keepNextTakeShare, readPrivateTakeShare } from "@/lib/willab/nextTakeShare";
import { clearPracticeResume } from "@/lib/willab/practiceResume";
import { PLAN_COPY } from "@/lib/willab/planCopy";
import { Button } from "@/components/ui/button";
import Linkified from "./Linkified";
import dynamic from "next/dynamic";
import SnippetWavePlayer from "./SnippetWavePlayer";
import LoungeAiVoiceBubble, { aiVoiceOfMeta } from "./LoungeAiVoiceBubble";
import TakeConversationMessage, { hasTakeReplyContent } from "./chats/TakeConversationMessage";
import { linkedSavedWordings } from "./CoachWordingCard";
import { coachWording } from "@/services/api/coachWording";
import { CHUNK_SHEET_COPY, WALK_COPY } from "./idealEditCopy";
import {
  ChatQueryRequestError,
  type ChatHistoryEntry,
  type ChatQueryResponse,
} from "@/services/api/chatQuery";
import { warmIdealTextOpen } from "@/services/api/idealText";
import { coachMomentFromMetadata, type CoachMomentReference } from "@/services/api/coachMoment";
import { chatArtifactContent } from "@/lib/willab/chatArtifact";
import { type LoungeMessage, type LoungeMessageDraft } from "@/services/api/loungeMessages";
import { useLoungeThreadCtx } from "./LoungeThreadContext";
import { conversationBubbleClass } from "./chats/TakeConversation";
import { ChatScroll, useWorkspaceSidebar } from "./chats/ChatWorkspace";
import type { MemberChatContent } from "./chats/ChatThread";
import {
  isRetiredLoungeMessage,
  loungeToHistory,
  splitBotMessage,
  speakingCoachReplyText,
  withoutCoachTranscriptFooter,
} from "./willabHelpers";
import { useLabReadoutLive } from "./useLabReadoutLive";
import { useDocumentSettle } from "./useDocumentSettle";
import {
  useFailedTakeRecheck,
  probeTakeVerdict,
  type FailedTakeVerdict,
} from "./useFailedTakeRecheck";
import { useUserId } from "./useUserId";
import {
  readProcessingTake,
  clearProcessingTake,
  markProcessingTakeFailed,
  markProcessingTakeIdealTextUnconfirmed,
  transitionProcessingTakeToDocument,
  updateProcessingTakeProgress,
  writeProcessingTake,
  type ProcessingPhase,
  type ProcessingTake,
  type ProcessingTakeProgress,
} from "@/lib/willab/processingTake";
import {
  retryIdealTextGeneration,
  retryLabProcessing,
} from "@/services/api/labRecording";
import { stageLabUpload } from "./labUploadStage";
import { validateAudioUpload } from "./audioUploadValidation";
import ReportCard, {
  reportDateLabel,
  type FeedbackBubbleTarget,
  type IdealTextRetryTarget,
} from "./ReportCard";
import { latestIdealBubbleIds, versionBubblesWithReviewCard } from "./unreadFeedback";
import IdealTextCard from "./IdealTextCard";
import { onTakeWordWatched } from "@/services/api/coachFeedbackSeen";
import { newCoachFeedbackFor, openedNewCoachFeedback } from "@/lib/willab/newCoachFeedback";
import { idealTextReadyDraft, idealTextUnconfirmedDraft } from "./loungeReports";
import { FLOW_COPY } from "./flowCopy";
import { PROCESSING_STAGES } from "./ProcessingWait";
import LoadingState from "./LoadingState";
import type { IdealTextLaunchMode } from "./IdealTextOverlay";
import { WILLAB_CONTENT_RAIL } from "@/lib/willab/layout";
import { resolvePastIdealText, type IdealTextPast } from "@/lib/willab/pastIdealText";
import { startOpenTrace } from "@/lib/willab/openTrace";
import { chatDrawsStep, chatWalks, doorOf, feedbackWalkDoor, inPairs, latestShareLine, shareLineDraft, shareLines, walkAnswerRow, walkPairs, type ChatWalk, type ShareLineChange } from "@/lib/willab/walkThread";
import type { WalkStepTarget } from "@/lib/willab/feedbackWalkModel";
import {
  clearExploreArc,
  readExploreArc,
  writeExploreArc,
} from "@/lib/willab/exploreArc";
import { clearInsightsReady } from "./sendStatus";
import { COACH_BUBBLE_ATTR, showCoachBubble, useCoachBubbleFocus } from "./useCoachBubbleFocus";
import { isLabOverlay, type WillabEvent, type WillabState } from "./useWillabFlow";
import { useUserProfile } from "./useUserProfile";
import { TopUpBubble, TopUpSlot, useTopUpOffer } from "./LoungeTopUpCard";
import {
  useWhatsAppOffer,
  WhatsAppOfferActions,
  type WhatsAppOffer,
} from "./WillabWhatsAppPrompt";
import { useUiLocale } from "@/components/ui/UiLocaleProvider";
import { uiText } from "@/lib/uiLocale";
import { offersUpdateSlides, SlidesAskSlot, useSlidesAsk } from "./UpdateSlides";
import { NewProjectAskSlot, useNewProjectAsk } from "./OneProjectQuestion";
import NoticeBar from "./NoticeBar";
import {
  afterTakeOrder,
  askShowing,
  heldFor,
  heldMessage,
} from "./afterTake";
import { postAfterTake } from "@/services/api/afterTake";
import OfferBubble from "./OfferBubble";
import { NotebookIntro, PrivacyLine, isNotebookAsk, isPrivacyLineRow, isSpotted } from "./NotebookPrivacy";
import {
  offerDraft,
  readOfferType,
  newestAsk,
  type OfferType,
} from "./loungeOffers";
import { screenHistory } from "./loungeScreen";
import {
  chipLabel,
  coerceSuggestedAction,
  coerceSuggestedActions,
  type ChipAction,
} from "./loungePrompts";
import {
  FEEDBACK_CHECK_LABEL,
  feedbackCheckOpen,
  feedbackCheckTarget,
} from "./feedbackCheck";
import { postFeedbackCheck, type FeedbackCheckChoice } from "@/services/api/feedbackCheck";
import {
  useVoiceNotebook,
  VoiceNoteBubble,
  VoiceNoteFixBar,
  VoiceNoteThread,
  SalesSteps,
  salesAskOf,
  type VoiceNotebook,
} from "./useVoiceNotebook";
import SundayLens, { SundayHeadBubble } from "./SundayLens";
import { sundayAskOf, sundayHeadOf, sundayWaiting } from "@/lib/willab/sundayNote";
import { LifeGoalBubble, lensAskOf, lifeGoalOf, quarterAskOf, changeAskOf, useLifeGoals } from "./LoungeLifeGoals";
import { YourWhyBubble, useYourWhy, yourWhyLineOf, yourWhyOpenOf } from "./LoungeYourWhy";
import type { WhyLine } from "@/services/api/yourWhy";
import {
  StrengthAgainBubble,
  StrengthHeadBubble,
  strengthAgainOf,
  strengthAskOf,
  strengthHeadOf,
  useStrengths,
} from "./LoungeStrengths";
import { answerSundayNote, type SalesStep } from "@/services/api/voiceNotebook";
import { postWillQuestion, transcribeChatAnswer, type SpokenChatAnswer } from "@/services/api/willQuestion";
import { keepChatReplyAudio } from "@/lib/willab/voiceNoteOutbox";
import {
  CHAT_FAILURE_BODY,
  isPersistedTerminalReplay,
  isProjectMessage,
  isReplayedTerminalReply,
  offersNextTake,
  openProjectQuestion,
  projectIdOf,
  projectConversationHistory,
  projectMessageStaysInLounge,
  typedProjectErrorMetadata,
  typedProjectTurnMetadata,
} from "@/lib/willab/projectChat";
import { useChatTurnOutbox, type PendingChatTurn } from "./useChatTurnOutbox";
import { ChatTurnRetry } from "./ChatTurnRetry";
import WillQuestionBubble, {
  AnswerPair,
  ChatLink,
  ChatLinks,
  TapRow,
  SOMETHING_ELSE,
  willQuestionOf,
  type WillQuestionTarget,
} from "./WillQuestion";
import { isWillVoice, useKeyLineHear, WillVoiceBubble, type KeyLineHear } from "./WillVoiceAnswer";
import { JoinSetupBubble, joinSetupOf, useJoinSetup, type JoinSetup } from "./chats/JoinSetup";
import BundleQueue from "./chats/BundleQueue";
import type { AnswerFor } from "@/lib/willab/chatAnswer";
import { ChatSetupBubble, chatSetupCanBegin, chatSetupOf, useAssistantInWill, useChatSetup, willSetupWaiting, type ChatSetup } from "./chats/ChatSetup";
import { sayToWill } from "./chats/hostsetup/hostSetupDoor";
import OwnChatLinks from "./chats/OwnChatLinks";
import { PlaceOnly, PlaceOpening, emptyHelloIn, ownChatLinksIn, placeholderIn, rememberPlace, setOpenPlace, shownIn, speakingFirst, typedHint, useOpenOwnChat, useOpenPlace, withHint, wordsAlways, type LoungePlace } from "./chats/loungePlace";
import { requestOpenSpeaker } from "@/lib/willab/openSpeaker";
import type { RecordingProgress } from "@/services/api/recordingProgress";
import {
  announceDiscoveriesFromPersistedMessages,
  productActionFromMetadata,
  productSpec,
} from "@/lib/productDiscovery";
import ProcessingResumeOverlay from "./ProcessingResumeOverlay";
import { useWaitScreen } from "./useWaitScreen";
import { useKeepPlaceAbove, useLandOnProcessing, usePinThreadBottom } from "./usePinThreadBottom";
import { clearerPieces, type ClearerPiece } from "@/lib/willab/clearerPieces";
import { usePlanLounge, type PlanStart } from "./plan/usePlanLounge";
import { isFirstTakeArc } from "@/lib/willab/firstTake";
import { planRowFor, type PlanRowCtx } from "./plan/PlanRows";
import { WayInTop } from "./plan/WayIn";
import { firstTakeArcOf } from "@/lib/willab/wayIn";
import { DayLine, dayLinesFor } from "./plan/dayLines";
import { hostRowsAround } from "./chats/hostChatMessages";
import TypingDots, { ChatRecordingStatus, CHUNK_DELAY_MS, TypingGlyph } from "./TypingDots";
import { afterChatBoot } from "@/lib/chatBoot";
import { CHAT_LENS_DOCK, CHAT_LENS_THREAD } from "./chats/ChatLens";
import type { TakeInProject } from "@/lib/willab/takeInProject";
import { CLOSE, NOT_NOW } from "@/lib/willab/leaveWords";
import { useTakeResend } from "./useTakeResend";
import {
  isActiveProcessingState,
  isTerminalProcessingState,
  processingBubbleVisible,
} from "@/lib/willab/processingBubble";

// Opened on a tap, never on first paint: loaded then, off the boot bundle.
const CoachWalkEntry = dynamic(() => import("./coachwalk/CoachWalkEntry"), { ssr: false });
// What needs you, for the chat builder's ring (backend N629): off the boot bundle.
const WillBuild = dynamic(() => import("./chats/WillBuild"), { ssr: false, loading: () => null });
const ConfidencePracticeOverlay = dynamic(() => import("./ConfidencePracticeOverlay"), { ssr: false });
// Off the boot bundle, warmed after the thread paints (founder 2026-10-16):
// the Life panel's chat card. `warmOverlays` below fetches its chunk once the
// thread is in, so a tap finds it ready.

/** The cards that brought results on their own (N691 item 4). */
const RESULT_CARD_KINDS: ReadonlySet<string> = new Set(["insight", "feedback", "best_presentation_ready"]);

const LifeChatCard = dynamic(
  () => import("@/components/life/LifeChatLayer").then((m) => m.LifeChatCard),
  { ssr: false },
);
function warmOverlays(): void {
  void import("@/components/life/LifeChatLayer");
}

/* -------------------------------------------------------------------------- */
/*  Lounge — the always-mounted science-chat home (§3 / §6a / §7)             */
/*                                                                            */
/*  Replaces the LoungeStub: a persistent thread (useLoungeThread — server     */
/*  when signed in, localStorage when not), a librarian bot over the existing  */
/*  /v2/chat/query endpoint (we read `.answer`; the funnel-only flags are      */
/*  ignored), the single-active status region (§6a: parked / review / ready),  */
/*  and the entry into the Lab. Audio, KPIs and labels live in the Lab — the   */
/*  Lounge is text-only and never judges (§7 librarian-not-judge).            */
/*                                                                            */
/*  Coach-mode addition (§F.1): when the signed-in user's profile carries     */
/*  `is_coach: true`, the chat thread also surfaces review-queue rows as       */
/*  inbound bubbles, chronologically interleaved with regular messages.        */
/*  Non-coach users see exactly the same Lounge as before.                    */
/* -------------------------------------------------------------------------- */

/** Discriminated union of items rendered in the Lounge thread. Carries the
 *  sort key + react key explicitly so the merge stays type-safe. */
type ThreadItem = {
  kind: "message";
  sortKey: string;
  reactKey: string;
  message: LoungeMessage;
};

type ProcessingResume = {
  sessionId: string;
  arcId: string | null;
  serverState: "processing" | null;
  takeIndex: number | null;
  status: "analyzing" | "failed";
  startedAt: number;
  progress: ProcessingTakeProgress | null;
  phase: ProcessingPhase;
  phaseStartedAt: number;
};

function readoutProgress(
  userId: string | null,
  sessionId: string,
  progress: ProcessingTakeProgress | null,
): ProcessingTakeProgress | null {
  return progress
    ? updateProcessingTakeProgress(userId, sessionId, progress)
    : null;
}

function resumeForActiveReadout(
  current: ProcessingResume | null,
  marker: ProcessingTake,
  state: string | null,
  progress: ProcessingTakeProgress | null,
): ProcessingResume | null {
  if (!isActiveProcessingState(state)) return current;
  if (current?.sessionId === marker.sessionId) {
    return {
      ...current,
      serverState: "processing",
      progress: progress ?? current.progress,
    };
  }
  return {
    sessionId: marker.sessionId,
    arcId: marker.arcId,
    serverState: "processing",
    takeIndex: marker.takeIndex,
    status: "analyzing",
    startedAt: marker.startedAt,
    progress: progress ?? marker.progress,
    phase: marker.phase,
    phaseStartedAt: marker.phaseStartedAt,
  };
}

/** Which take's failed note is on screen, if any. Under the Lab the Lab owns
 *  the wait, so no recheck runs there. Pure, so the sheet's own function does
 *  not grow a branch for it (complexity ratchet). */
function failedNoteSession(
  labOpen: boolean,
  resume: { sessionId: string; status: "analyzing" | "failed" } | null,
): string | null {
  if (labOpen || !resume || resume.status !== "failed") return null;
  return resume.sessionId;
}

/** A Take is being worked: the analysis phase or the document phase. */
function takeAnalysing(
  resume: {
    status: "analyzing" | "failed";
    serverState: "processing" | null;
    phase: ProcessingPhase;
  } | null,
  settling: boolean,
): boolean {
  return (
    resume?.status === "analyzing" &&
    (resume.serverState === "processing" || resume.phase === "document")
  ) || settling;
}

/** The composer waits for a Take still landing, and for the history's
 *  first answer: before it, a new device would offer "Start your first
 *  recording" to a speaker with Takes. Never longer than that one read (its
 *  timeout, bootPrefetch.ts): once a read went unanswered the bar is free,
 *  and the history is read again behind the dots (useLoungeThread). */
function recordBarHeld(takeInFlight: boolean, thread: { loading: boolean; unanswered: boolean }, wayInWaits = false): boolean {
  // "Record Take 2" stays faded until the way in's walk is done (N592 item 3).
  return takeInFlight || wayInWaits || (thread.loading && !thread.unanswered);
}

/** The processing bubble at the bottom of the thread: only an accepted Take
 *  whose server readout still says processing, except the way in's Take 1,
 *  whose wait is the thin row on top (N453 item 1). */
function bottomProcessing(
  resume: Parameters<typeof processingBubbleVisible>[0],
  firstTakeWayIn: boolean,
): boolean {
  return processingBubbleVisible(resume, { firstTakeWayIn });
}

function showsLoungeProcessing(projectChatActive: boolean, projectMarker: boolean, speakingProject: boolean, firstTakeWayIn: boolean) {
  return !projectChatActive && !projectMarker && (!speakingProject || firstTakeWayIn);
}

function LoungeProcessingFailure({ active, retrying, onRetry }: { active: boolean; retrying: boolean; onRetry: () => void }) {
  if (!active) return null;
  return <>
    <p className="mb-1.5 flex items-center justify-center gap-2 rounded-full bg-destructive/10 px-4 py-1.5 text-center text-[13px] text-destructive">
      {FLOW_COPY.failed}
    </p>
    <p className="mb-1.5 px-4 text-center text-[12px] leading-relaxed text-muted-foreground">
      {FLOW_COPY.failedNext}
    </p>
    <Button type="button" variant="outline" disabled={retrying} onClick={onRetry}
      className="mb-2 h-10 w-full rounded-full">
      {retrying ? "Restarting…" : "Try processing again"}
    </Button>
  </>;
}

/** The oldest and the newest message's client_id, or null for none. */
function threadEnds(messages: readonly Pick<LoungeMessage, "client_id">[]): { oldest: string | null; newest: string | null } {
  return { oldest: messages.at(0)?.client_id ?? null, newest: messages.at(-1)?.client_id ?? null };
}

/** Will's bubble when a chat turn fails. A signed-out visitor before their
 *  first Take is refused by the processing gate (no agreement yet, so their
 *  words may not reach the AI): Will says hello and points to the first
 *  recording (founder 2026-10-29). Anything else is a real failure. */
export function chatFailureReply(err: unknown, signedIn: boolean, hasProject: boolean) {
  const refused =
    err instanceof ChatQueryRequestError && (err.status === 401 || err.status === 403);
  if (refused && !signedIn && !hasProject) {
    return {
      role: "bot" as const,
      kind: "text" as const,
      body: FLOW_COPY.firstTakeHello,
      metadata: { suggested_action: "start_first_recording" },
    };
  }
  return {
    role: "bot" as const,
    kind: "text" as const,
    body: CHAT_FAILURE_BODY,
  };
}

type ProjectQuestionTurn = {
  row: LoungeMessage;
  arcId: string;
  takeSessionId: string;
};

function projectQuestionTurn(question: LoungeMessage | null): ProjectQuestionTurn | null {
  const arcId = question?.metadata?.arc_id;
  const takeSessionId = question?.metadata?.take_session_id;
  if (!question || typeof arcId !== "string" || typeof takeSessionId !== "string") return null;
  return { row: question, arcId, takeSessionId };
}

function chatReplyBody(response: ChatQueryResponse, fallback: string | null): string | null {
  if (response.bubbles && response.bubbles.length > 0) return response.bubbles.join("\n\n");
  return response.answer?.trim() || fallback;
}

function chatReplyMetadata(response: ChatQueryResponse): Record<string, unknown> {
  const suggested = coerceSuggestedAction(response.suggested_action);
  const suggestedActions = coerceSuggestedActions(response.suggested_actions);
  const productAction = productActionFromMetadata({ product_action: response.product_action });
  const moment = coachMomentFromMetadata(response.row_metadata?.coach_moment);
  const artifact = chatArtifactContent(response.row_metadata?.chat_artifact);
  const wording = coachWording(response.row_metadata?.coach_wording);
  return {
    ...(suggestedActions.length > 0
      ? { suggested_actions: suggestedActions }
      : suggested
        ? { suggested_action: suggested }
        : {}),
    ...(offersNextTake(response) ? { suggested_action: "record_again" } : {}),
    ...(productAction ? { product_action: productAction } : {}),
    ...(moment ? { coach_moment: moment } : {}),
    ...(artifact ? { chat_artifact: artifact } : {}),
    ...(wording ? { coach_wording: wording } : {}),
  };
}


type PreparedVoice = { scope: string; answer: SpokenChatAnswer };
export type LoungeDrafts = Map<string, { value: string; voice?: PreparedVoice }>;

function useLoungeDraft(scope: string, shared?: LoungeDrafts) {
  const [local] = useState<LoungeDrafts>(() => new Map());
  const [, redraw] = useState(0);
  const drafts = shared ?? local;
  const setDraft = useCallback((update: SetStateAction<string>) => {
    const current = drafts.get(scope);
    const next = typeof update === "function" ? update(current?.value ?? "") : update;
    if (next) drafts.set(scope, { value: next, voice: next.trim() ? current?.voice : undefined });
    else drafts.delete(scope);
    redraw((version) => version + 1);
  }, [drafts, scope]);
  function prepare(voice: PreparedVoice) {
    drafts.set(scope, { value: voice.answer.text, voice });
    redraw((version) => version + 1);
  }
  const field = useRef<HTMLTextAreaElement | null>(null);
  const focus = () => {
    const input = field.current;
    if (!input || input.disabled) return;
    input.focus({ preventScroll: true });
    input.setSelectionRange(input.value.length, input.value.length);
    input.scrollIntoView?.({ block: "nearest" });
  };
  const current = drafts.get(scope);
  return { value: current?.value ?? "", voice: current?.voice, setDraft, prepare, field, focus };
}

function LoungeComposerStatus({ uploadError, voice }: { uploadError: string | null; voice?: ReturnType<typeof useComposerVoice> }) {
  if (!uploadError && !voice?.error) return null;
  return <p role="alert" className="pb-1 text-sm text-destructive">
    {uploadError || voice?.error}
    {!uploadError && voice?.retry ? <button type="button" onClick={() => void voice.retry?.()} className="ml-1 underline">Try again</button> : null}
  </p>;
}

function composerFileActions({
  speaking, projectsVisible, onProjects, onUpload, onSlides, onStartTake, onError, startLabel,
}: {
  speaking: boolean;
  projectsVisible: boolean;
  onProjects: () => void;
  onUpload: () => void;
  onSlides?: () => void;
  onStartTake?: () => void;
  onError: (error: string | null) => void;
  startLabel: string;
}): ComposerFileAction[] {
  const files: ComposerFileAction[] = [];
  if (speaking) files.push({
    label: "Upload a recording", accept: "audio/*", sendFile: (file) => {
      const error = validateAudioUpload(file);
      onError(error);
      if (error) return false;
      stageLabUpload(file);
      onUpload();
      return true;
    },
  });
  if (projectsVisible) {
    files.push({ label: "Your projects", open: onProjects });
    if (onSlides) files.push({ label: "Update slides", open: onSlides });
  }
  if (onStartTake) files.push({ label: startLabel, open: onStartTake });
  return files;
}

function ReviewCitation({ citation, showTake, onClear }: {
  citation?: TakeCitation | null; showTake: boolean; onClear?: () => void;
}) {
  if (!citation || (!showTake && !citation.quote)) return null;
  const label = citation.quote ?? (citation.takeIndex ? `Take ${citation.takeIndex}` : "Feedback");
  return <div className="flex items-center gap-2 border-l-2 border-border pl-3 text-xs text-muted-foreground">
    <p className="min-w-0 flex-1 truncate">{label}</p>
    <button type="button" aria-label="Clear review context" className="size-11 shrink-0" onClick={onClear}>×</button>
  </div>;
}

function LoungeComposer({
  place, openChat, draft, plan, keyLine, notebook, held, busy, onSend, onProjects, onUpload, onSlides, onStartTake,
  citation, clearCitation, voice, memberComposer,
}: {
  place: LoungePlace | null;
  openChat: string | null;
  draft: ReturnType<typeof useLoungeDraft>;
  plan: PlanLounge;
  keyLine: KeyLineHear;
  notebook: VoiceNotebook;
  held: boolean;
  busy: boolean;
  onSend: () => Promise<boolean>;
  onProjects: () => void;
  onUpload: () => void;
  onSlides?: () => void;
  onStartTake?: () => void;
  citation?: TakeCitation | null;
  clearCitation?: () => void;
  voice?: ReturnType<typeof useComposerVoice>;
  memberComposer?: ChatComposerProps;
}) {
  const [uploadError, setUploadError] = useState<string | null>(null);
  const locale = useUiLocale();
  const speaking = !openChat && !wordsAlways(place);
  const hear = speaking && !citation?.focus ? plan.hear ?? keyLine.hear : null;
  const guidedRecording = speaking ? plan.recording ?? keyLine.recording : undefined;
  const notebookRecording = notebook.recording ? {
    elapsedMs: notebook.note.elapsedMs,
    discard: notebook.note.cancel,
    stop: notebook.note.send,
    attrs: { "data-voice-note-stop": "" },
  } : undefined;
  const mic = hear ? { label: PLAN_COPY.recordAnswer, start: hear.onTap, attrs: { "data-will-hear": "" } } : voice?.mic;
  const files = composerFileActions({
    speaking, projectsVisible: speaking && !held && !hear && !guidedRecording,
    onProjects, onUpload, onSlides, onStartTake, onError: setUploadError,
    startLabel: uiText(locale, "startNewProject"),
  });
  if (notebook.fixing && !openChat) return <VoiceNoteFixBar notebook={notebook} />;
  const composer: ChatComposerProps = memberComposer ?? {
    inputLabel: "Message Will",
    placeholder: placeholderIn(place),
    onSend,
    busy: busy || voice?.sending,
    voiceRequired: !citation?.focus && Boolean(hear || keyLine.sending && speaking),
    mic,
    recording: voice?.recording ?? guidedRecording ?? notebookRecording,
    voiceDraft: voice?.voiceDraft,
    above: <ReviewCitation citation={citation} showTake={Boolean(openChat)} onClear={clearCitation} />,
  };
  return <ChatComposer {...composer} files={[...(composer.files ?? []), ...files]}
    transcribing={voice?.sending && !busy}
    status={<LoungeComposerStatus uploadError={uploadError} voice={voice} />}
    className="-mx-2" inputRef={draft.field} value={draft.value} onValue={draft.setDraft} />;
}

/** The slides' line once they are ready: about the project's deck, so the
 *  speaking chat's (N636 item 1). */
function slidesReadyDraft(line: string, arcId: string | null | undefined) {
  return { role: "bot" as const, kind: "text" as const, body: line, ...(arcId ? { metadata: { arc_id: arcId } } : {}) };
}

function memberInput(member: MemberChatContent | undefined, reviewing: boolean, draft: ReturnType<typeof useLoungeDraft>) {
  if (!member || reviewing) return undefined;
  const { onSend, ...props } = member.composer;
  return { ...props, onSend: onSend ? async (value: string) => {
    if (await onSend(value) === false) return false;
    draft.setDraft((current) => current === value ? "" : current);
    return true;
  } : undefined };
}

function memberConversationState(
  member: MemberChatContent | undefined, citation: TakeCitation | null, scope: string, onStart?: () => void,
) {
  const available = member && !member.blocked && !member.composer.busy;
  const review = available ? citation : null;
  return {
    reviewing: Boolean(review),
    onStart: available && !member.answering && !review ? onStart : undefined,
    useTakeComposer: !member || Boolean(review),
    draftScope: review ? JSON.stringify([scope, review.takeId]) : scope,
  };
}

function loungeTurnScope(question: LoungeMessage | null, citation: TakeCitation | null, practice: CoachMomentReference | null) {
  if (practice) return {
    scopedQuestion: null, arcId: practice.arc_id, takeId: practice.take_session_id,
    reviewFocus: { step: "practise" as const, snippet_id: practice.snippet_id },
  };
  const questionProject = projectQuestionTurn(question);
  const scopedQuestion = !citation || (!citation.focus && questionProject?.takeSessionId === citation.takeId) ? question : null;
  return {
    scopedQuestion,
    arcId: citation?.arcId ?? questionProject?.arcId,
    takeId: citation?.takeId ?? questionProject?.takeSessionId,
    reviewFocus: citation && !scopedQuestion ? citation.focus ?? { step: "feedback" as const } : undefined,
  };
}

function MemberConversationFrame({ member, children }: { member?: MemberChatContent; children: ReactNode }) {
  return <>{member?.header}{children}{member?.overlays}</>;
}

function LoungeMessageRows({
  member, waiting, place, empty, hidesEmpty, rows, hostRowsAfter,
}: {
  member?: MemberChatContent;
  waiting: boolean;
  place: LoungePlace | null;
  empty: boolean;
  hidesEmpty: boolean;
  rows: () => ReactNode;
  hostRowsAfter: () => ReactNode;
}) {
  return <>
    <PlaceOpening place={place} />
    {waiting || member?.messages === null ? <LoadingState placement="surface" /> :
      !member && emptyHelloIn(place, empty) ? <LoungeEmptyState hidden={hidesEmpty} /> : rows()}
    {hostRowsAfter()}
    {member && !member.blocked ? member.followUps : null}
  </>;
}

export default function Lounge({
  state,
  onStart,
  onStartNewProject,
  onStartInProject,
  onOpenProject,
  onOpenTakeInProject,
  projectChatActive = false,
  onProjectTakeReady,
  onStartPlanRecording,
  dispatch,
  coachLink = false,
  linkTake = null,
  recordingProgress = null,
  waitHandedOver,
  onWaitHandedOverShown,
  onRecordAnswer,
  member,
  chatDrafts,
}: {
  state: WillabState;
  member?: MemberChatContent;
  chatDrafts?: LoungeDrafts;
  /** "Record one answer" in the queue of bundles (backend N584), handed to
   *  the recording screens as a chat's "Record your answer" is. */
  onRecordAnswer?: (answer: AnswerFor) => void;
  onStart: () => void;
  /** Bypass project selection after the user explicitly chose a fresh project. */
  onStartNewProject?: () => void;
  /** Scenario B (founder 2026-07-22) — recording from INSIDE a project: the
   *  project is already known, so the picker is skipped entirely and the Lab
   *  opens straight onto the prefilled setup. */
  onStartInProject?: () => void;
  /** Open one project conversation from a durable project card/deep link. */
  onOpenProject?: (arcId: string | null) => void;
  /** A Take's Ideal Text, or its feedback, in its project chat (backend N691
   *  item 2): the Ideal Text has no screen of its own. */
  onOpenTakeInProject?: (arcId: string, pick: TakeInProject) => void;
  projectChatActive?: boolean;
  onProjectTakeReady?: (arcId: string, sessionId: string, scoped: boolean) => void;
  /** The plan's "Start your first recording" (the-plan.md E5): the set-up
   *  with the topic filled in from the voice message, no feelings check; or,
   *  on a first-Take plan, the five questions at once (backend N401), and
   *  after that Take the real talk's set-up (`afterFirstTake`). */
  onStartPlanRecording?: (topic: string | null, start?: PlanStart) => void;
  /** What happened; useWillabFlow's table decides the state. */
  dispatch: (event: WillabEvent) => void;
  /** `/chat?take=` or a coach's older link (backend N691 item 3): once the
   *  thread has painted, the chat shows the coach's bubble for `linkTake`,
   *  else the newest one. */
  coachLink?: boolean;
  linkTake?: string | null;
  /** Seed from the upload response; reserved for future per-take state. */
  recordingProgress?: RecordingProgress | null;
  /** The Take the Lab just handed over: its wait stays on screen here
   *  (founder 2026-10-21, useWaitScreen). */
  waitHandedOver?: string | null;
  onWaitHandedOverShown?: () => void;
}) {
  const uiLocale = useUiLocale();
  const userId = useUserId();
  const thread = useLoungeThreadCtx();
  const place = useOpenPlace();
  // The speaker's own chat open now (backend N700): the thread draws its rows.
  const ownChat = useOpenOwnChat();
  const sidebar = useWorkspaceSidebar();
  const openChat = member?.id ?? null;
  const showTakeArtifacts = Boolean(openChat) || place !== "speaking" || onProjectTakeReady === undefined;
  const viewScope = useContext(ChatArtifactScope);
  const composerScope = JSON.stringify(["lounge", userId, place, openChat, viewScope]);
  const outbox = useChatTurnOutbox(thread, userId, JSON.stringify(["lounge", place, openChat]));
  const { messages } = outbox;
  const savedWordings = useMemo(() => linkedSavedWordings(messages), [messages]);
  const { reload } = thread;
  const [citation, setCitation] = useState<TakeCitation | null>(null);
  const [readyHostedTake, setReadyHostedTake] = useState<string | null>(null);
  const memberState = memberConversationState(member, citation, composerScope, onStartNewProject);
  const { draftScope } = memberState;
  const draft = useLoungeDraft(draftScope, chatDrafts);
  const [recordingDock, setRecordingDock] = useState<HTMLDivElement | null>(null);
  const { value: draftText, setDraft: setDraftText, focus: focusComposer } = draft;
  const currentCitation = useRef(citation);
  const currentComposerScope = useRef(draftScope);
  const recordRequestPending = useRef(false);
  currentCitation.current = citation;
  currentComposerScope.current = draftScope;
  useEffect(() => { setCitation(null); }, [composerScope]);
  // FE-5 — the Life Panel's # layer. `enabled` is false for every user who has
  // not consented AND completed setup, which is everyone until they opt in, so
  // for them nothing below mounts and this component behaves exactly as it did
  // before the panel existed. Anonymous visitors make no request for it at all.
  // Sending is untouched either way: routing happens on the backend, and the
  // composer still posts the same /v2/chat/query.
  useEffect(() => afterChatBoot(warmOverlays), []);
  const [thinkingHere, setBotThinking] = useState(false);
  const botThinking = outbox.busy(thinkingHere);
  const prepareOnStop = !wordsAlways(place);
  const chatPractice = useSpeakingPractice(messages, place, openChat, citation, memberState.reviewing);
  const voiceScope = JSON.stringify([draftScope, citation?.takeId, citation?.focus, chatPractice.replyId]);
  const stagedVoice = draft.voice?.scope === voiceScope ? draft.voice : null;
  function hostedPractice(replyId?: string) {
    return openChat && replyId && replyId === chatPractice.replyId ? chatPractice.reference : null;
  }
  const reviewVoice = useComposerVoice({
    enabled: thread.signedIn && memberState.useTakeComposer,
    held: botThinking || !outbox.ready,
    maxSeconds: 120,
    prepareOnStop,
    ready: chatPractice.ready,
    practiceReplyId: chatPractice.replyId,
    onStream: chatPractice.listen,
    label: "Record your answer",
    scope: voiceScope,
    onSend: async (audio, duration, turnId, practiceReplyId) => {
      if (!outbox.isCurrent()) return false;
      const linked = practiceReplyId ? null : projectQuestionTurn(openProjectQuestion(shownMessages));
      const practice = hostedPractice(practiceReplyId);
      const target = practice ? { arcId: practice.arc_id, takeId: practice.take_session_id }
        : citation ?? (linked ? { arcId: linked.arcId, takeId: linked.takeSessionId } : undefined);
      const spoken = await transcribeChatAnswer(audio, duration, target, prepareOnStop ? {
        turnId, projectId: target?.arcId, snippetId: practice?.snippet_id ?? citation?.focus?.snippet_id,
        ...(practiceReplyId ? { practiceReplyId } : {}),
      } : undefined);
      if (!spoken || currentCitation.current !== citation || currentComposerScope.current !== draftScope || !outbox.isCurrent()) return false;
      if (prepareOnStop) {
        if (!turnId) return false;
        const answer = { ...spoken, turnId, audio };
        if (practiceReplyId) {
          return Boolean(spoken.receipt) && await handleSend({ ...answer, practiceReplyId });
        }
        draft.prepare({ scope: voiceScope, answer });
        return true;
      }
      return handleSend({ ...spoken, turnId });
    },
  });
  // F2/F7 — the offer (one of Will's asks) whose action pair is open in
  // the footer (replacing the record button). null → the record button shows.
  // The offers themselves persist as thread bubbles (loungeOffers); this only
  // tracks which one is currently "armed".
  const [activeOffer, setActiveOffer] = useState<OfferType | null>(null);
  // The out-of-tokens ask: Will's message in the thread, the plans in the
  // footer (LoungeTopUpCard.tsx).
  const topUp = useTopUpOffer({ state, threadLoading: thread.loading });
  // E3 — coach-only student roster overlay.
  // U1 (native scroll): scroll the thread CONTAINER, and stick to the bottom
  // only when the user is already there. The old code called scrollIntoView on
  // a bottom sentinel on every new message + every bot-typing toggle, which
  // (a) could pan the whole page / iOS viewport, and (b) yanked the user back
  // down whenever they'd scrolled up to read history — the non-native feel.
  const scrollRef = useRef<HTMLDivElement | null>(null);
  // THE WHOLE PAGE SCROLLS THE CHAT (founder 2026-10-12): a wheel on the
  // white margins either side of the column scrolls the thread too.
  useEffect(() => forwardMarginWheel(() => scrollRef.current), []);
  const atBottomRef = useRef(true);
  const didInitScrollRef = useRef(false);
  // U3 — baseline of message ids present on first load (historical). A bot
  // message NOT in this set, rendered as the last thread item, is a freshly-
  // arrived reply → it reveals sequentially (animate). Set once, post first load.
  const baselineRef = useRef<Set<string> | null>(null);

  // §F.0 / §F.1 — coach-mode surface. is_coach is the RENDER gate (the BE
  // role-gates each endpoint independently via require_admin_or_coach, so a
  // tampered FE flag wouldn't get past the upstream wall). Non-coach users
  // see exactly the same Lounge as today.
  const { isCoach } = useUserProfile();
  // The coach's walk (founder 2026-09-30; on since group 4) is the coach's
  // one door, under the thread. The per-student bubbles, the roster, the
  // take-review overlay and the arc-level delivery that once hung off this
  // hub are gone (founder 2026-09-30, B3 to B6; P2-19).

  const hostMessages = useMemo(() => member?.messages ?? [], [member?.messages]);
  const threadItems = useMemo<ThreadItem[]>(() => {
    // #10 — dedupe by client_id: the BE thread is the source of truth and its
    // idempotent client_ids are the identity. A double-insert (retry, optimistic
    // + server echo) must never render twice (also keeps React keys unique).
    const seenIds = new Set<string>();
    const items: ThreadItem[] = [];
    for (const m of messages) {
      if (isRetiredLoungeMessage(m)) continue;
      if (isPersistedTerminalReplay(m, messages)) continue;
      // Project-specific Takes, feedback and questions live in that project's
      // chat. Will keeps only cross-project patterns, principles and mindset.
      if (!openChat && isProjectMessage(m) && (!showTakeArtifacts || !projectMessageStaysInLounge(m))) continue;
      if (m.client_id) {
        if (seenIds.has(m.client_id)) continue;
        seenIds.add(m.client_id);
      }
      items.push({
        kind: "message",
        sortKey: m.client_created_at,
        reactKey: m.client_id,
        message: m,
      });
    }
    // SD — the audit-progress line ("N more takes to the full training") is
    // retired with the 3-take arc: takes are open-ended now.
    items.sort((a, b) => a.sortKey.localeCompare(b.sortKey));
    // One action at a time (founder 2026-10-20): the message after a Take
    // waits, undrawn, under its ask; the card comes first.
    return afterTakeOrder(items);
  }, [messages, showTakeArtifacts, openChat]);
  // The thread in the order it is drawn (founder 2026-10-20): what the
  // chat reads as "the newest" is what shows last.
  const drawn = useMemo(() => threadItems.map((item) => item.message), [threadItems]);
  // A Take's walk is one bubble, the Feedback walk, at its first step's place
  // (founder 2026-10-26, N192, B3): its other steps stay stored (B1) and are
  // drawn in the walk only. Who heard the Take is one line on its recording
  // (G1), and the summary is the walk's last step (D4).
  const walks = useMemo(() => chatWalks(drawnOf(threadItems)), [threadItems]);
  const walkAt = useMemo(() => new Map(walks.map((walk) => [walk.at, walk])), [walks]);
  const shares = useMemo(() => shareLines(drawnOf(threadItems)), [threadItems]);
  // The latest Take's line opens the sharing screen to change it (N309 item 5).
  const shareChange = useMemo(() => latestShareLine(drawnOf(threadItems)), [threadItems]);
  const summaries = useMemo(() => summaryByTake(drawnOf(threadItems)), [threadItems]);
  // The review that still waits (founder lock 2026-10-12, section 1): the
  // newest walk step names its project and is not the review's end. Its
  // Feedback walk wears the outline; the bar offers no "Continue review"
  // (backend N532).
  const reviewToContinue = useMemo(() => continueReviewArc(threadItems), [threadItems]);
  // One Ideal Text bubble per Take (founder 2026-10-14).
  const drawnItems = useMemo(() => {
    const hidden = versionBubblesWithReviewCard(threadItems);
    const closing = closingTakesOf(drawnOf(threadItems));
    return threadItems.filter(
      (item) => !hidden.has(item.message.client_id) && chatShows(item.message, walkAt, closing) && shownIn(item.message, place, openChat),
    );
  }, [threadItems, walkAt, place, openChat, ownChat]);
  // Each Take's Ideal Text card right under its Feedback walk, one pair
  // (founder 2026-10-26, N202); a walk that still runs has no card yet.
  const pairs = useMemo(() => walkPairs(drawnOf(drawnItems), walks, reviewToContinue), [drawnItems, walks, reviewToContinue]);
  const shownItems = useMemo(() => inPairs(drawnItems, (item) => item.message.client_id, pairs), [drawnItems, pairs]);
  const takeConversations = useMemo(() => {
    const groups = new Map<string, { arcId: string; takeId: string; rows: LoungeMessage[]; anchor?: string }>();
    if (!openChat) return groups;
    for (const { message } of threadItems) {
      const takeId = takeSessionOf(message);
      const arcId = projectIdOf(message);
      if (!takeId || !arcId || message.metadata?.take_exchange === false ||
          isChatPracticeTurn(message) || !shownIn(message, place, openChat)) continue;
      const group = groups.get(takeId) ?? { arcId, takeId, rows: [] };
      if (group.arcId !== arcId) continue;
      group.rows.push(message);
      groups.set(takeId, group);
    }
    for (const { message } of shownItems) {
      const group = groups.get(takeSessionOf(message) ?? "");
      if (group && !group.anchor) group.anchor = message.client_id;
    }
    return groups;
  }, [openChat, place, shownItems, threadItems]);
  const hostRows = useMemo(
    () => hostRowsAround(hostMessages, shownItems.map((item) => item.message.client_created_at)),
    [hostMessages, shownItems],
  );
  // A small grey day line before each day's first message, in a chat that
  // spans several days (the-plan.md G3, backend N169).
  const dayLines = useMemo(
    () =>
      dayLinesFor(
        shownItems.map((item) => ({
          at: item.message.client_created_at,
          ownLine: typeof (item.message.metadata as Record<string, unknown> | null | undefined)?.day_line === "string",
        })),
      ),
    [shownItems],
  );
  const pairedCards = useMemo(() => new Set(pairs.cardOf.values()), [pairs]);
  // Each project's latest Ideal Text bubble wears the unread-feedback dot
  // (founder 2026-09-25, Q39 B): of the cards drawn, not one held back.
  const latestIdealIds = useMemo(
    () => latestIdealBubbleIds(threadItems.filter((item) => !pairs.held.has(item.message.client_id))),
    [threadItems, pairs],
  );
  // The step it waits on wears the orange outline (same section).
  const waitingStep = useMemo(() => waitingStepId(threadItems, reviewToContinue), [threadItems, reviewToContinue]);
  // Each bubble's Take, and each project's newest: an older Take's steps are
  // history ("🔒 Take N" on its helper words, section 2.3).
  const olderTake = useMemo(() => olderTakeOf(threadItems), [threadItems]);
  // Once opened, a bubble loses its orange outline (founder 2026-10-14).
  const [seenUpdates, setSeenUpdates] = useState<ReadonlySet<string>>(readSeenUpdates);
  // The coach's word rings while the server says it is new (founder
  // 2026-10-19, N80), and opens alone in its lens.
  const coachUpdates = useCoachUpdates(messages);
  // The coach's door with nothing on its page shows the coach's bubble (WIL-93).
  useCoachBubbleFocus();
  const stepWaits = (m: LoungeMessage) =>
    coachUpdates.waits(m, !seenUpdates.has(m.client_id) && waitingStep === m.client_id);
  // A Feedback walk wears the outline while one of its steps waits: the step
  // the review waits on, or the walk's own copy of a coach's word not yet
  // seen (B10, D5). Those are what its tap marks seen.
  const walkWaits = (walk: ChatWalk): LoungeMessage[] =>
    threadItems
      .map((item) => item.message)
      .filter((m) => takeIdOf(m) === walk.take && m.kind === "walk_step" && !chatDrawsStep(m) && stepWaits(m));
  // Helper words a later pick replaced: an older Take's review leaves them out.
  const olderNewWords = useMemo(() => clearerNewWordsOf(threadItems), [threadItems]);
  // An older Take's review, reopened from one of its bubbles: its steps as
  // they were, read only.

  // U6 — opening the in-thread insight card is the single "mark read" path now
  // that the top banner is gone: open the overlay, and if we were in the unread
  // insights_ready state, clear the flag + return the status machine to idle
  // (exactly what the banner's "Read ›" button used to do).

  // C8 — every quick-action CTA lands in ONE place: the Trainings library
  // (trainings / audit). audit previously routed to /audits; it now opens the
  // Trainings library like the rest so the chips don't scatter. No record chip
  // (but a signed-out visitor's first one, start_first_recording):
  // the bot points at the permanent record button in words. (arc_checkout, the
  // $25 pay note, was retired with the paywall — only $5 moments is paid now.)
  function onChip(action: ChipAction): void {
    const project = readExploreArc(userId);
    if (action === "create_new_project") {
      postAnswerBubble(chipLabel(action, uiLocale));
      // Starting a project is concurrent with every project already kept.
      newProjectAsk.begin(() => {
        clearExploreArc(userId);
        (onStartNewProject ?? onStart)();
      });
      return;
    }
    if (action === "replace_pdf") {
      // The backend only offers this before Take 1; repeat the guard locally so
      // a stale, persisted button cannot reopen deck mutation after a take.
      if (project && Math.max(0, project.nextTakeIndex - 1) === 0) {
        postAnswerBubble(chipLabel(action, uiLocale));
        dispatch("setup_requested");
      }
      return;
    }
    if (action === "edit_current_slide") {
      if (project?.arcId) {
        postAnswerBubble(chipLabel(action, uiLocale));
        openIdealText(project.arcId, "notebook");
      }
      return;
    }
    if (action === "start_first_recording") {
      if (project) (sidebar?.show ?? onStart)();
      else (onStartNewProject ?? onStart)();
      return;
    }
    if (action === "feedback_skip") {
      const target = feedbackCheckTarget(drawn, "missing");
      if (target) void answerFeedbackCheck(target, "skip");
      return;
    }
    if (sidebar) sidebar.show();
    else if (onOpenProject) onOpenProject(null);
    else onStart();
  }

  /** An older Ideal Text card opens the Take it was made from, in the
   *  project chat, with that Take's text (backend N375, N691 item 2). */
  function openPastIdealText(arcId: string, past: IdealTextPast): void {
    void resolvePastIdealText(arcId, past).then((opened) => {
      const takeIndex = opened.kind === "past" ? opened.revision.takeIndex : past.by === "take" ? past.n : null;
      onOpenTakeInProject?.(arcId, { takeIndex, step: "ideal" });
    });
  }

  /** The Ideal Text ("notebook") or the Take's feedback ("review") opens in
   *  the project chat (backend N691 items 1 and 2), on the Take a step names,
   *  else the newest. */
  function openIdealText(
    arcId: string,
    mode: IdealTextLaunchMode = "notebook",
    at: WalkStepTarget | null = null,
  ): void {
    startOpenTrace(at?.step ? `${mode}, step ${at.step}` : mode);
    openedNewCoachFeedback(arcId);
    if (state === "insights_ready") {
      clearInsightsReady();
      dispatch("insights_opened");
    }
    onOpenTakeInProject?.(arcId, { sessionId: at?.take ?? null, step: mode === "review" ? "feedback" : "ideal" });
  }

  // The one link (backend N691 item 3): the chat opens on the coach's
  // bubble for the Take the link names, else the newest, once the thread has
  // painted. No screen opens; the bubble is the way in.
  const coachLinkShownRef = useRef(false);
  useEffect(() => {
    if (coachLinkShownRef.current || !coachLink) return;
    return afterChatBoot(() => {
      coachLinkShownRef.current = true;
      showCoachBubble(linkTake ?? null);
    });
  }, [coachLink, linkTake]);

  // Wave-3 — no standing / every-visit offer. The proactive strong-sides nudge
  // fires once at the post-send moment (A-4 / B-2); otherwise the bot stays
  // quietly standing by. Intent-driven buttons come from the BE (B-1).

  // Voice input has been removed from the Lounge (product call): only
  // the **official recording** holds the mic. (The one exception, founder
  // 2026-10-20: the founder's voice notebook, useVoiceNotebook; a private note,
  // never a Take.) Off-task chat is
  // text-only — keeps the Lounge composer visually distinct from the
  // Lab's "Start official recording" CTA so users never confuse the
  // calm off-stage surface with the high-stakes on-stage one. The
  // Web Speech machinery (`useSpeechInput`) was deleted in the
  // founder-approved dead-code sweep; recover it from git history if
  // a future surface (e.g. an accessibility opt-in) wants it back.

  // Jump to bottom once the thread finishes loading — always open at the latest
  // message. Re-pin after the next frame + a short delay so async content
  // (slide images, report cards) that grows the thread doesn't leave us short
  // of the true bottom.
  useEffect(() => {
    if (didInitScrollRef.current || thread.loading || messages.length === 0) {
      return;
    }
    didInitScrollRef.current = true;
    const el = scrollRef.current;
    if (!el) return;
    const toBottom = () => {
      el.scrollTop = el.scrollHeight;
    };
    toBottom();
    requestAnimationFrame(toBottom);
    const t = setTimeout(toBottom, 150);
    return () => clearTimeout(t);
  }, [thread.loading, messages.length]);

  // FE-4 — the "practice mode" state that made the record CTA read "Record the
  // next take" and skip the project choice is gone with the shortcut it drove.
  // A cached arc says where the LAST take went, which is not an answer to
  // where this one should go.

  // When the user asks to upload a file, the footer's record button becomes a
  // file picker (deckless upload). Tracks the LATEST intent so it reverts once
  // the user moves on. Detection is FE-side (the bot doesn't classify it).
  // Bug 1 — a picked file that fails the audio/size guard shows inline under
  // the button instead of silently opening the Lab with a doomed upload.

  /** A Take's feedback, from its recording bubble or its Ideal Text card,
   *  opens in its project chat (backend N691 item 1): no screen of its own. */
  const openFeedback = (target: FeedbackBubbleTarget) =>
    onOpenTakeInProject?.(target.arcId, {
      sessionId: target.takeSessionId,
      takeIndex: target.takeIndex,
      step: "feedback",
    });
  const [confidencePracticeId, setConfidencePracticeId] = useState<
    string | null
  >(null);

  // Async analysis (delivery layer) — a take left mid-analysis keeps finishing
  // server-side; resume its persisted marker and subscribe until terminal:
  // push-first via the readout SSE bridge, with the original 5s poll as the
  // automatic fallback tier inside useLabReadoutLive. Re-arms whenever the Lab
  // overlay CLOSES (state-driven, not mount-only — the Lounge is
  // always-mounted, so a marker written mid-session must be picked up the
  // moment the user comes back from the Lab). While the Lab is open it owns
  // the live subscription, so this stands down.
  const [processingResume, setProcessingResume] =
    useState<ProcessingResume | null>(null);
  // A presentation key, not a second lifecycle owner. The job observer below
  // stays mounted in the Lounge while this exact session is shown full-screen.
  const [openedProcessingSessionId, setOpenedProcessingSessionId] = useState<
    string | null
  >(null);
  const processingTriggerRef = useRef<HTMLButtonElement | null>(null);
  // The Take being processed is the speaking way in's Take 1 (backend N453,
  // N592), from the plan as last read: its wait is the thin row on top of
  // the chat, and its walk waits for the speaker's tap. `wayInReadyArc`: its
  // project, once its feedback is ready.
  const wayInTakeRef = useRef(false);
  const [wayInReadyArc, setWayInReadyArc] = useState<string | null>(null);
  // The one wait on screen, from the Lab's hand-off to the walk (founder
  // 2026-10-21: "make it stay"; "it still loads the walk").
  const waitScreen = useWaitScreen({
    userId,
    signedIn: thread.signedIn === true,
    labOpen: isLabOverlay(state) || projectChatActive,
    handedOver: waitHandedOver,
    onHandedOverShown: onWaitHandedOverShown,
    resume: processingResume,
    openedSessionId: openedProcessingSessionId,
    show: (view) => {
      setProcessingResume(view);
      // The way in's Take 1 (backend N453 item 1): the thin row on top of
      // the chat stands in for the full wait.
      if (!wayInTakeRef.current) setOpenedProcessingSessionId(view.sessionId);
    },
  });
  const [retryingProcessing, setRetryingProcessing] = useState(false);
  const [resumeWatch, setResumeWatch] = useState<{
    sessionId: string;
    takeIndex: number | null;
    startedAt: number;
  } | null>(null);
  const idealTextFailurePublishRef = useRef(new Set<string>());
  const publishIdealTextUnconfirmed = useCallback(
    async (target: {
      sessionId: string;
      arcId: string;
      takeIndex: number | null;
    }) => {
      if (!target.arcId || target.takeIndex !== 1) return;
      if (idealTextFailurePublishRef.current.has(target.sessionId)) return;
      idealTextFailurePublishRef.current.add(target.sessionId);
      try {
        // EVIDENCE BEFORE THE CLAIM (founder 2026-09-24). This card is
        // durable and it is what the speaker reads, so it may not rest on a
        // timer alone — the document cap expiring in this tab says nothing
        // about whether the backend made the document.
        const verdict = await probeTakeVerdict(target.sessionId);
        if (verdict === "recovered") {
          // The take is done. There was never a failure to publish.
          clearProcessingTake(userId, target.sessionId);
          setProcessingResume(null);
          setResumeWatch(null);
          await reload().catch(() => undefined);
          return;
        }
        if (verdict === "running") {
          // Still working. The cap released the screen; that is all it may
          // do. PUT THE MARKER BACK -- syncMarker re-enters this path every
          // 500ms while the marker reads terminal, so returning without
          // repairing it would poll the readout twice a second. Same repair
          // the failed-note recheck makes on the same verdict.
          const marker = readProcessingTake(userId);
          if (marker?.sessionId === target.sessionId) {
            const now = Date.now();
            writeProcessingTake(userId, {
              ...marker,
              status: "processing",
              phase: "analysis",
              startedAt: now,
              phaseStartedAt: now,
              progress: { stage: "processing_recording", percent: 0 },
            });
          }
          return;
        }

        const existing = readProcessingTake(userId);
        if (existing?.sessionId === target.sessionId) {
          markProcessingTakeIdealTextUnconfirmed(userId, target.sessionId);
        } else {
          const now = Date.now();
          writeProcessingTake(userId, {
            sessionId: target.sessionId,
            arcId: target.arcId,
            takeIndex: 1,
            startedAt: now,
            phaseStartedAt: now,
            phase: "analysis",
            status: "failed_ideal_text_unconfirmed",
            progress: { stage: "ideal_text", percent: null },
          });
        }
        setResumeWatch(null);
        try {
          await thread.append(
            idealTextUnconfirmedDraft({
              sessionId: target.sessionId,
              arcId: target.arcId,
              takeIndex: 1,
            }),
          );
          // Clear only after the session-keyed card has been durably
          // appended. If delivery fails, the terminal marker survives and
          // this observer retries instead of letting the failure disappear.
          clearProcessingTake(userId, target.sessionId);
          setProcessingResume(null);
        } catch {
          await reload().catch(() => undefined);
        }
      } finally {
        idealTextFailurePublishRef.current.delete(target.sessionId);
      }
    },
    [reload, thread, userId],
  );
  useEffect(() => {
    if (isLabOverlay(state)) {
      // The LabOverlay owns the live subscription while open. Entering the
      // Lab is also the ACT that retires a failure note (W6): the note's
      // second line points at recording again, and this is that path.
      setProcessingResume((prev) => (prev?.status === "failed" ? null : prev));
      setResumeWatch(null);
      return;
    }
    const syncMarker = () => {
      const marker = readProcessingTake(userId);
      if (!marker) {
        // W6 (founder 2026-08-10) — a FAILED note survives idle state changes.
        // It used to be wiped here by the first state flip after the 10s timer
        // was removed, which re-created the vanishing it was meant to fix: a
        // failed take must stay on screen until the user acts on it (opens the
        // Lab) or a fresh take replaces it below.
        setProcessingResume((prev) =>
          prev?.status === "failed" ? prev : null,
        );
        setResumeWatch(null);
        return;
      }
      if (marker.status === "failed_ideal_text_unconfirmed") {
        if (marker.projectChat) return;
        if (marker.arcId && marker.takeIndex === 1) {
          void publishIdealTextUnconfirmed({
            sessionId: marker.sessionId,
            arcId: marker.arcId,
            takeIndex: 1,
          });
        } else {
          clearProcessingTake(userId, marker.sessionId);
        }
        return;
      }
      const status = marker.status === "failed" ? "failed" : "analyzing";
      setProcessingResume((previous) => {
        // A marker found on navigation or reload is only a durable pointer to
        // an accepted Take. It is not, by itself, proof that the job is still
        // active: a completed/failed/cancelled job can leave that pointer
        // behind until the readout observer reconciles it. Keep an already
        // displayed session optimistic, but never create a fresh bubble from
        // stale localStorage before the server has answered for this session.
        if (
          status === "analyzing" &&
          previous?.sessionId !== marker.sessionId
        ) {
          return null;
        }
        const unchanged =
          previous?.sessionId === marker.sessionId &&
          previous.arcId === marker.arcId &&
          previous.takeIndex === marker.takeIndex &&
          previous.status === status &&
          previous.startedAt === marker.startedAt &&
          // PHASE IS PART OF "unchanged". The analysis → document transition
          // can happen with the stage and percent identical on both sides, and
          // without this the screen would keep the old phase's label for the
          // rest of the job — the exact mislabel this carries the phase to fix.
          previous.phase === marker.phase &&
          previous.progress?.stage === marker.progress?.stage &&
          previous.progress?.percent === marker.progress?.percent;
        return unchanged
          ? previous
          : {
              sessionId: marker.sessionId,
              arcId: marker.arcId,
              serverState:
                marker.phase === "analysis" &&
                previous?.sessionId === marker.sessionId
                  ? previous.serverState
                  : null,
              takeIndex: marker.takeIndex,
              status,
              startedAt: marker.startedAt,
              progress: marker.progress,
              phase: marker.phase,
              phaseStartedAt: marker.phaseStartedAt,
            };
      });
      if (marker.status === "failed" || marker.phase === "document") {
        // The readout is done in document phase; there is no analysis stream
        // to watch. The settle hook below owns the remaining wait.
        setResumeWatch(null);
        return;
      }
      setResumeWatch((previous) =>
        previous?.sessionId === marker.sessionId &&
        previous.takeIndex === marker.takeIndex &&
        previous.startedAt === marker.startedAt
          ? previous
          : {
              sessionId: marker.sessionId,
              takeIndex: marker.takeIndex,
              startedAt: marker.startedAt,
            },
      );
    };
    syncMarker();
    // Same-tab writes do not emit `storage`; the cheap local marker check also
    // covers those. Cross-tab replacements are picked up immediately.
    const markerPoll = window.setInterval(syncMarker, 500);
    window.addEventListener("storage", syncMarker);
    return () => {
      window.clearInterval(markerPoll);
      window.removeEventListener("storage", syncMarker);
    };
  }, [state, userId, publishIdealTextUnconfirmed]);
  function handleUnconfirmedReadout(marker: ProcessingTake) {
    if (marker.projectChat) {
      markProcessingTakeIdealTextUnconfirmed(userId, marker.sessionId);
      setResumeWatch(null);
    } else if (marker.arcId && marker.takeIndex === 1) {
      void publishIdealTextUnconfirmed({ sessionId: marker.sessionId, arcId: marker.arcId, takeIndex: 1 });
    }
  }
  useLabReadoutLive(
    // Gate from the rendered flow state, not from the effect-lagging local
    // state. A real Lab mount therefore tears this transport down in the same
    // commit before the Lab can subscribe. The local resume overlay does not
    // change flow state, so this one watcher continues without reconnecting.
    !isLabOverlay(state) ? (resumeWatch?.sessionId ?? null) : null,
    (r) => {
      if (!resumeWatch) return;
      const currentMarker = readProcessingTake(userId);
      // A late response for session A must not mutate session B's marker OR
      // the currently displayed progress/failure state. A terminal analysis
      // has already moved to the document phase, so it is monotonic too: no
      // late processing/failure envelope may pull it backwards.
      if (
        currentMarker?.sessionId !== resumeWatch.sessionId ||
        currentMarker.phase !== "analysis" ||
        currentMarker.status !== "processing"
      ) {
        return;
      }
      const latestProgress = readoutProgress(
        userId,
        resumeWatch.sessionId,
        r.processing,
      );
      setProcessingResume((current) =>
        resumeForActiveReadout(
          current,
          currentMarker,
          r.state,
          latestProgress,
        ),
      );
      const hasContent =
        r.readout.snippets.length > 0 ||
        r.readout.instantChunks.length > 0 ||
        r.readout.fullTranscriptChunks.length > 0;
      if (r.state === "failed_ideal_text_unconfirmed") {
        handleUnconfirmedReadout(currentMarker);
        return;
      }
      if (r.state === "failed") {
        markProcessingTakeFailed(userId, resumeWatch.sessionId);
        const failedMarker = readProcessingTake(userId);
        setProcessingResume({
          sessionId: resumeWatch.sessionId,
          arcId:
            failedMarker?.sessionId === resumeWatch.sessionId
              ? failedMarker.arcId
              : null,
          serverState: null,
          takeIndex: resumeWatch.takeIndex,
          status: "failed",
          startedAt: resumeWatch.startedAt,
          progress:
            failedMarker?.sessionId === resumeWatch.sessionId
              ? failedMarker.progress
              : null,
          phase:
            failedMarker?.sessionId === resumeWatch.sessionId
              ? failedMarker.phase
              : "analysis",
          phaseStartedAt:
            failedMarker?.sessionId === resumeWatch.sessionId
              ? failedMarker.phaseStartedAt
              : resumeWatch.startedAt,
        });
        setResumeWatch(null);
        // W6 (founder 2026-08-10) — the failure note used to clear itself
        // after 10 seconds. A failed take that vanishes from the screen is
        // halfway to a failed take that never happened: look away for ten
        // seconds and there is no evidence anything went wrong. It now stays
        // until the user ACTS — opening the Lab (the retry path, which this
        // note's second line points at) clears it via the state effect above,
        // and a fresh analysing marker replaces it. Same copy, longer life.
        return;
      }
      if (isTerminalProcessingState(r.state)) {
        // The readout is the server's terminal truth. A stale local marker
        // must not survive a ready, cancelled, abandoned, or other terminal
        // response merely because that response carries no readout content.
        // `ready`/`readout_ready` still enter the existing document-settle
        // phase when the project has a canonical text to confirm.
        const keepsDocumentWait =
          r.state === "ready" ||
          r.state === "readout_ready" ||
          hasContent;
        const marker = readProcessingTake(userId);
        if (keepsDocumentWait && marker?.sessionId === resumeWatch.sessionId && marker.arcId) {
          const cached = readExploreArc(userId);
          writeExploreArc(
            userId,
            marker.arcId,
            (marker.takeIndex ?? 0) + 1,
            cached?.arcId === marker.arcId ? cached.deck : undefined,
            marker.sessionId,
          );
        }
        if (keepsDocumentWait && marker?.arcId) {
          // Every spoken Take owns a durable review version. Hold until the
          // served Ideal Text proves that exact 1.0/2.0/3.0 state landed.
          transitionProcessingTakeToDocument(userId, resumeWatch.sessionId);
          setProcessingResume((current) =>
            current?.sessionId === resumeWatch.sessionId &&
            current.status === "analyzing"
              ? {
                  ...current,
                  serverState: null,
                  progress: { stage: "document_assembly", percent: null },
                }
              : current,
          );
        } else {
          clearProcessingTake(userId, resumeWatch.sessionId);
          setProcessingResume(null);
        }
        setResumeWatch(null);
      }
    },
    5000,
  );

  // SPEC-lockin-loop §1 — the document-phase authority. Probes the served
  // ideal text while a take's document assembles and clears the marker on
  // evidence the new text landed (or the bounded cap). Disabled under the
  // Lab, which owns its own settle watch there.
  const documentSettle = useDocumentSettle({
    enabled: !isLabOverlay(state),
    onSettled: (take) => {
      setProcessingResume((prev) => (prev?.status === "failed" ? prev : null));
      if (openChat) {
        setReadyHostedTake(take.sessionId);
        void reload().catch(() => undefined);
        return;
      }
      if (projectChatActive) {
        void reload().catch(() => undefined);
        return;
      }
      if (place === "speaking" && take.arcId && onProjectTakeReady && (take.projectChat || !wayInTakeRef.current)) {
        onProjectTakeReady(take.arcId, take.sessionId, take.projectChat === true);
        void reload().catch(() => undefined);
        return;
      }
      if (take.projectChat) {
        void reload().catch(() => undefined);
        return;
      }
      // A guest left the Lab while the text was being made: post the "your
      // text is ready" bubble the server posts only for an account
      // (founder live test 2026-10-05).
      if (!thread.signedIn && take.arcId) {
        void thread.append(idealTextReadyDraft({
          arcId: take.arcId,
          version: take.takeIndex,
        }));
      }
      // The reload brings the Take's bubble; the journey message is no longer
      // posted (the closing summary takes over, lock 2026-10-12, section 3).
      // THE REVIEW OPENS BY ITSELF when the Take's feedback is ready, even if
      // the speaker left the processing screen for the chat (section 1). The
      // wait stays over it until the walk is on screen (founder 2026-10-21).
      // FROM THE TAKE STRAIGHT INTO THE WALK (founder 2026-11-01, N319 item
      // 10): the walk opens at once, its wait over it from this Take's own
      // marker, and the chat fills in underneath; it is never shown between.
      // The way in's Take 1 (N453 item 7, N592 item 1): the row on top turns
      // orange and the speaker opens the walk when done.
      if (take.arcId && wayInTakeRef.current) setWayInReadyArc(take.arcId);
      else if (take.arcId) {
        waitScreen.coverWalk(take);
        openIdealText(take.arcId, "review");
      }
      void reload().catch(() => undefined);
    },
    onExpired: (take) => {
      if (!take.projectChat && take.arcId && take.takeIndex === 1) {
        void publishIdealTextUnconfirmed({
          sessionId: take.sessionId,
          arcId: take.arcId,
          takeIndex: 1,
        });
      }
      /* RELEASE THE SCREEN, which `onSettled` does and this did not.
       *
       * FOUNDER 2026-09-21: the wait sat on "Building your Ideal Text" for
       * ten minutes after a job that `processing_jobs` shows finished in
       * twenty seconds — waited 3s, ran 20s, completed, no error. The
       * backend was never slow.
       *
       * `takeInFlight` is `status === "analyzing" || documentSettle.pending`.
       * The ready path swaps only `progress` and leaves `status` at
       * "analyzing", so the analysis clause carries the screen through the
       * whole document phase. `expire` then sets the HOOK's marker terminal
       * — `pending` goes false — and that clause is still true, with nothing
       * left that can clear it. Not a slow release: no release. Ten minutes
       * is simply when he gave up watching.
       *
       * So expiry ends the wait the same way settling does. "failed" rather
       * than null because it IS the terminal state — `publishIdealText-
       * Unconfirmed` above has just said so — and the failure note is built
       * to stay until the speaker acts (W6), where a silent clear would
       * leave them looking at a document that never arrived with nothing
       * saying why. */
      setProcessingResume((prev) =>
        prev?.sessionId === take.sessionId && prev.status === "analyzing"
          ? { ...prev, status: "failed", progress: null }
          : prev,
      );
    },
  });
  // The ONE in-flight predicate: the analysis phase (chip + resume watch)
  // or the document phase (settle hook). Record holds and the ideal text
  // blocks on the SAME truth, so the two can never disagree about whether
  // a take is being worked.
  const analysing = takeAnalysing(processingResume, documentSettle.pending);
  // A Take kept on this device whose upload never finished goes up again
  // (backend N553 item 2, N556): while it does, Record waits with its signed
  // line, as for any Take still landing.
  const resending = useTakeResend({ userId, labOpen: isLabOverlay(state), busy: analysing, thread });
  const takeInFlight = [analysing, resending].some(Boolean);

  // One's own chat (backend N582, the chat builder's ring): Will's offer,
  // the builder's way in, and whether "Set up my chat ›" can begin it.
  const assistant = useAssistantInWill(thread.signedIn, reload);
  // The plan in the Lounge (docs/flows/the-plan.md): its rows, its answers
  // in the thread with the Lounge's bar under them (N319 item 1), its sheets.
  // Off unless the ring row reaches.
  const plan = usePlanLounge({
    signedIn: thread.signedIn,
    thread,
    setThinking: setBotThinking,
    onStartRecording: onStartPlanRecording,
    recordHeld: takeInFlight,
    onOpenFeedback: () => openFirstTakeFeedback(),
    onJoinQuestions: () => void joinSetup.again().then(followAnswer),
    // In the ring's speaking chat these two go to Will's chat (N636 item 3).
    ownChatLinks: ownChatLinksIn(place),
    onSetUpChat: assistant.builder ? () => void chatSetup.begin().then(followAnswer) : undefined,
    onWords: focusComposer,
  });
  wayInTakeRef.current = plan.firstTakeWayIn;
  const showLoungeProcessing = showsLoungeProcessing(projectChatActive, Boolean(readProcessingTake(userId)?.projectChat),
    place === "speaking" && Boolean(processingResume?.arcId), plan.firstTakeWayIn);
  const loungeResume = showLoungeProcessing ? processingResume : null;
  /** "Open your feedback ›", or the orange row on top: Take 1's walk. */
  function openFirstTakeFeedback(): void {
    const arc = wayInReadyArc ?? firstTakeArcOf(messages);
    if (arc) openIdealText(arc, "review");
  }
  const closeProcessingOverlay = useCallback(() => {
    setOpenedProcessingSessionId(null);
    requestAnimationFrame(() =>
      processingTriggerRef.current?.focus({ preventScroll: true }),
    );
  }, []);

  // The open view is pinned to one job identity. Completion, failure, or a
  // replacement marker closes it instead of silently showing another take.
  useEffect(() => {
    if (!openedProcessingSessionId) return;
    if (
      !processingResume ||
      processingResume.sessionId !== openedProcessingSessionId ||
      processingResume.status !== "analyzing"
    ) {
      closeProcessingOverlay();
    }
  }, [openedProcessingSessionId, processingResume, closeProcessingOverlay]);

  /** A FAILED NOTE IS CLEARED BY EVIDENCE, NOT BY TIME (founder 2026-09-21).
   *  While the red note is on screen, useFailedTakeRecheck asks the server
   *  whether the take really failed. W6 keeps the note across idle state
   *  flips; this is not an idle flip — it is the server contradicting it.
   *    recovered → the job finished behind our back: clear the marker, drop
   *                the note, reload so the Take's card shows.
   *    running   → the queue sweep requeued it: put the marker back into the
   *                analysing state and let syncMarker resume the watch.
   *    otherwise → the note stays, exactly as W6 says. */
  function onFailedTakeVerdict(
    sessionId: string,
    verdict: FailedTakeVerdict,
  ): void {
    const marker = readProcessingTake(userId);
    if (verdict === "recovered") {
      clearProcessingTake(userId, sessionId);
      setProcessingResume(null);
      void reload();
      return;
    }
    if (verdict === "running" && marker?.sessionId === sessionId) {
      const now = Date.now();
      writeProcessingTake(userId, {
        ...marker,
        status: "processing",
        phase: "analysis",
        startedAt: now,
        phaseStartedAt: now,
        progress: { stage: "processing_recording", percent: 0 },
      });
    }
  }
  useFailedTakeRecheck({
    sessionId: failedNoteSession(isLabOverlay(state), processingResume),
    onVerdict: onFailedTakeVerdict,
  });

  /** THE CARD MUST NOT OUTLIVE THE FAILURE EITHER (founder 2026-09-24).
   *
   *  The rule above was written for the local note. The Lounge card is
   *  DURABLE, and it is the one the founder was looking at: "we couldn't
   *  create your Ideal Text" sitting directly under the card announcing that
   *  the ideal text is ready. Nothing on any path ever withdrew it.
   *
   *  Same rule, same evidence. While such a card is the newest thing said
   *  about this project's document, ask the server about its take; when the
   *  server says the take is done, the backend has already retracted the card
   *  on that same read, so reloading the thread is all this has to do.
   *
   *  Bounded on purpose: only the NEWEST ideal-text card is watched, so an
   *  honest old failure the speaker has moved on from is not re-probed for
   *  the life of the thread. */
  const unconfirmedCardSession = useMemo<string | null>(() => {
    for (let i = messages.length - 1; i >= 0; i--) {
      const m = messages[i];
      if (m.kind !== "ideal_text") continue;
      const md = m.metadata as Record<string, unknown> | null | undefined;
      if (!md || md.variant !== "ideal_text_unconfirmed") return null;
      return typeof md.take_session_id === "string"
        ? md.take_session_id
        : null;
    }
    return null;
  }, [messages]);
  useFailedTakeRecheck({
    sessionId: unconfirmedCardSession,
    onVerdict: (_sessionId, verdict) => {
      if (verdict === "recovered") void reload();
    },
  });

  /** Re-open the durable backend job against the original stored audio. */
  const retryPreservedProcessing = async () => {
    if (retryingProcessing) return;
    const marker = readProcessingTake(userId);
    if (!marker || marker.status !== "failed") return;
    setRetryingProcessing(true);
    const restarted = await retryLabProcessing(marker.sessionId);
    setRetryingProcessing(false);
    if (!restarted) return;
    const now = Date.now();
    writeProcessingTake(userId, {
      ...marker,
      status: "processing",
      phase: "analysis",
      startedAt: now,
      phaseStartedAt: now,
      progress: { stage: "processing_recording", percent: 0 },
    });
    setProcessingResume({
      sessionId: marker.sessionId,
      arcId: marker.arcId,
      serverState: "processing",
      takeIndex: marker.takeIndex,
      status: "analyzing",
      startedAt: now,
      progress: { stage: "processing_recording", percent: 0 },
      // Mirrors the marker written immediately above: this retry re-enters
      // audio analysis, so the recording labels are the true ones here.
      phase: "analysis",
      phaseStartedAt: now,
    });
    setResumeWatch({
      sessionId: marker.sessionId,
      takeIndex: marker.takeIndex,
      startedAt: now,
    });
  };

  /** The Take 1 card's primary action. This starts the dedicated document job;
   *  unlike retryPreservedProcessing it never re-enters audio analysis. */
  const retryIdealTextFromCard = async (
    target: IdealTextRetryTarget,
  ): Promise<boolean> => {
    const restarted = await retryIdealTextGeneration(target.takeSessionId);
    if (!restarted) return false;
    const now = Date.now();
    writeProcessingTake(userId, {
      sessionId: target.takeSessionId,
      arcId: target.arcId,
      takeIndex: 1,
      startedAt: now,
      status: "processing",
      phase: "analysis",
      phaseStartedAt: now,
      progress: { stage: "ideal_text", percent: null },
    });
    setProcessingResume({
      sessionId: target.takeSessionId,
      arcId: target.arcId,
      serverState: "processing",
      takeIndex: 1,
      status: "analyzing",
      startedAt: now,
      progress: { stage: "ideal_text", percent: null },
      // Mirrors its marker. This job "never re-enters audio analysis", and the
      // `ideal_text` stage already resolves above the audio labels — but the
      // marker says analysis, so this says analysis. One source of truth.
      phase: "analysis",
      phaseStartedAt: now,
    });
    setResumeWatch({
      sessionId: target.takeSessionId,
      takeIndex: 1,
      startedAt: now,
    });
    setOpenedProcessingSessionId(target.takeSessionId);
    return true;
  };

  // Auto-open an offer in the footer, respecting priority so that when several
  // fire at the same post-send moment the most urgent wins the slot (the others
  // remain clickable bubbles in the thread). An explicit bubble tap bypasses
  // this and opens that offer directly.
  const openOffer = useCallback((type: OfferType) => {
    // SD/FE-4 — the joke onboarding is deleted; a legacy joke bubble in an old
    // thread stays visible but inert.
    if (type === "joke") return;
    const rank: Record<OfferType, number> = {
      joke: 2, whatsapp: 0, feedback_check: 0,
      voice_notebook: 0, sunday_note: 0, life_goals: 0, life_goals_quarter: 0, life_goals_change: 0,
      sales_step: 0, your_why: 0, strengths: 0,
    };
    setActiveOffer((prev) => (prev && rank[prev] >= rank[type] ? prev : type));
  }, []);

  // FE-1 — the eviction-proof source of an arc's prior session id: the newest
  // recording-summary bubble for that arc (server-backed for signed-in). Seeded
  // into the explore arc at the "record next take" sites so the Lab can restore
  // the deck from the server when localStorage lost it.
  const latestArcSessionId = useCallback(
    (arcId: string): string | undefined => {
      for (let i = messages.length - 1; i >= 0; i--) {
        const m = messages[i];
        if (m.kind !== "recording_summary") continue;
        const md = m.metadata as Record<string, unknown> | null | undefined;
        if (md && md.arc_id === arcId && typeof md.session_id === "string") {
          return md.session_id;
        }
      }
      return undefined;
    },
    [messages],
  );

  // The settle stamp: a recording_summary minted AFTER the thread settled is
  // the "just recorded this session" signal. The joke onboarding and the
  // install offer that used to arm here are deleted (SD/FE-4, N391).
  const settleTimeRef = useRef<string | null>(null);
  // FE-4 fix — a synchronous in-flight guard for runSend. React state alone
  // leaves a window where a fast double-tap re-enters and double-sends.
  const sendingRef = useRef(false);

  useEffect(() => {
    if (thread.loading) return;
    if (settleTimeRef.current === null) {
      settleTimeRef.current = new Date().toISOString();
    }
  }, [thread.loading]);

  // ONE ACTION AT A TIME (founder 2026-10-20, afterTake.ts): the message
  // after a Take waits under the Take's one ask and is let go when the ask
  // closes. The backend lets it go itself after a tap on the question or a
  // typed turn; the forms (Save, Not now, See prices...) ask for it here.
  const waiting = useMemo(() => heldMessage(messages), [messages]);
  const lettingGoRef = useRef(false);
  const letGo = useCallback(async () => {
    if (lettingGoRef.current) return;
    lettingGoRef.current = true;
    try {
      await thread.idle(); // under what the ask's close just wrote
      if (await postAfterTake()) await reload().catch(() => undefined);
    } finally {
      lettingGoRef.current = false;
    }
  }, [thread, reload]);
  // WIL-74 — the question after a Take's summary opens its pair while it is
  // the newest message, once per Take; the record button is back on a tap.
  const feedbackArmedRef = useRef<string | null>(null);
  const threadLoading = thread.loading;
  useEffect(() => {
    if (threadLoading) return;
    const open = feedbackCheckOpen(drawn);
    if (!open || feedbackArmedRef.current === open.takeSessionId) return;
    feedbackArmedRef.current = open.takeSessionId;
    openOffer("feedback_check");
  }, [threadLoading, drawn, openOffer]);

  // The second offer (founder 2026-10-12): a WhatsApp number for "The feedback
  // from your coach is in!", asked at the end of a Take from Take 2.
  const whatsapp = useWhatsAppOffer({ append: thread.append });
  const slidesAsk = useSlidesAsk();
  const newProjectAsk = useNewProjectAsk();

  // The founder's voice notebook (Will learning plan, step 1, 2026-10-20).
  const notebook = useVoiceNotebook({
    signedIn: thread.signedIn,
    userId,
    threadLoading,
    held: plan.holdsPrinciples,
    drawn,
    openOffer,
    reload,
  });
  // Life goals (Will learning plan, step 3, N172): the ask's Start, a
  // ladder's ›, or a reply that opens the lens.
  const lifeGoals = useLifeGoals({ signedIn: thread.signedIn, reload });
  // Your why (N255) and strengths (N241): their asks, the day's rows, lenses.
  const why = useYourWhy({ signedIn: thread.signedIn, reload });
  const strengths = useStrengths({ signedIn: thread.signedIn, reload });
  // The Sunday note's lens, opened on one note (N158 L3, L8).
  const [sunday, setSunday] = useState<{ id: string; nonce: number } | null>(null);
  const openSunday = useCallback((id: string) => setSunday({ id, nonce: Date.now() }), []);

  // A message still waiting while no ask is in front of the speaker would
  // never show (a typed turn the backend could not store, say): let it go,
  // once per message.
  const unstuckRef = useRef<string | null>(null);
  useEffect(() => {
    if (threadLoading || botThinking || !waiting || heldFor(waiting) === "admin") return;
    if (askShowing(drawn, activeOffer !== null) || unstuckRef.current === waiting.client_id) return;
    unstuckRef.current = waiting.client_id;
    void letGo();
  }, [threadLoading, botThinking, waiting, drawn, activeOffer, letGo]);

  // The newest message, not the count: older messages put above the thread
  // are not a new bubble (usePinThreadBottom).
  const ends = threadEnds(messages);
  const newestMessage = useMemo(
    () => hostMessages.length ? JSON.stringify([ends.newest, hostMessages.at(-1)?.id]) : ends.newest,
    [ends.newest, hostMessages],
  );
  useEffect(() => {
    // Stick to bottom only if the user hasn't scrolled up. Scroll the container
    // itself (not a sentinel) so the page/viewport never moves. A form opening
    // in the footer shortens the thread: the ask stays in sight above it.
    if (!atBottomRef.current) return;
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [newestMessage, botThinking, thread.writing, activeOffer]);

  // A NEW BUBBLE IS ALWAYS SHOWN (founder 2026-09-28), even when the thread
  // was scrolled up, and See next steps lands on the newest one. Only a new
  // message moves the thread; reading history otherwise stays where it is:
  // "Load earlier messages" puts them above the bubble being read.
  const pinBottom = usePinThreadBottom(scrollRef, newestMessage, thread.loading, didInitScrollRef);
  const keepPlace = useKeepPlaceAbove(scrollRef, ends.oldest);
  // THE CHAT FOLLOWS THE NEWEST BUBBLE AFTER AN ANSWER (founder 2026-11-01,
  // N319 item 9): a tap, a typed message, a voice answer or the continue tap
  // lands the thread on the newest bubble even when it was scrolled up;
  // bubbles that arrive on their own move it as above.
  const followAnswer = useCallback(() => {
    atBottomRef.current = true;
    pinBottom();
  }, [pinBottom]);
  // THE PROCESSING BUBBLE IS SHOWN (founder lock 2026-10-12, section 1):
  // it is not a message, so no new message brings it into view. When it
  // comes, and when the wait's ✕ shows the chat, the thread lands on it
  // (founder 2026-11-09: closing the wait left it below the screen).
  useLandOnProcessing(processingResume, followAnswer);
  /** The bubble's tap: the full wait, once the Take has a session (until the
   *  upload answers there is nothing to open yet). */
  function openProcessing(resume: { sessionId: string; status: string } | null): void {
    if (resume?.status === "analyzing") setOpenedProcessingSessionId(resume.sessionId);
  }
  const shownMessages = useMemo(() => shownItems.map((item) => item.message), [shownItems]);
  // The box only when Will asks for words (N483 item 2): "Something else",
  // his follow-up with no answers to tap, or "What was missing?".
  // Will's setup question that waits (backend N503): typed words answer it,
  // and "What should change?" keeps the box open.
  // Will's other setup, one's own chat (backend N582, the chat builder's
  // ring): the same box, the same taps.
  const joinSetup = useJoinSetup(reload, setBotThinking, thread.own);
  const chatSetup = useChatSetup(reload, setBotThinking, thread.own);
  // For whoever has the new setup, Will's chat asks none of the earlier
  // builder's questions (backend N632 item 1).
  const setupWaits = willSetupWaiting(shownMessages, joinSetup, chatSetup, assistant.retired);
  // Will's key line asks to be said (backend N544): "Record your answer" in
  // the mic captures it in the shared composer.
  const keyLine = useKeyLineHear({
    shown: shownMessages,
    held: botThinking,
    onSending: setBotThinking,
    onSent: async () => {
      await reload();
      followAnswer();
    },
  });
  // U3 — capture the historical baseline once the thread first loads, so only
  // messages that arrive AFTER it (new bot replies) animate.
  useEffect(() => {
    if (baselineRef.current === null && messages.length > 0) {
      baselineRef.current = new Set(messages.map((m) => m.client_id));
    }
  }, [messages]);

  // Track whether the thread is parked at the bottom. Within 80px counts as
  // "at bottom" (sub-pixel rounding + a partially-visible last bubble).
  function handleThreadScroll() {
    const el = scrollRef.current;
    if (!el) return;
    atBottomRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
  }

  // §6c: when the coach publishes (status flips to insights_ready), pull the
  // thread so the BE-appended "insights ready" ping shows in-chat at once — the
  // status card already flips live. The BE is the sole writer; we only re-read.
  useEffect(() => {
    if (state === "insights_ready") void reload();
  }, [state, reload]);

  /** "Start your first recording": the plan's first Take when there is a
   *  plan, else a new project (N483 item 2). */
  async function recordNext(arcId: string) {
    if (recordRequestPending.current || takeInFlight || !thread.signedIn) return;
    recordRequestPending.current = true;
    const stillHere = () => outbox.isCurrent() && currentComposerScope.current === composerScope;
    try {
      const projects = await fetchTrainings({ includeArchived: true });
      const project = projects?.find((item) => item.arcId === arcId);
      if (!project || project.deletion || !stillHere()) return;
      const latest = project.takes.reduce<((typeof project.takes)[number]) | undefined>(
        (last, take) => !last || take.takeIndex > last.takeIndex ? take : last, undefined,
      );
      const takeIndex = Math.max(project.takeCount, latest?.takeIndex ?? 0);
      if (!takeIndex) return;
      if (project.archived && !await unarchiveProject(arcId)) return;
      if (!stillHere()) return;
      if (isFirstTakeArc(userId, arcId, takeIndex) && onStartPlanRecording) {
        onStartPlanRecording(plan.topic, { afterFirstTake: true });
        return;
      }
      const share = await readPrivateTakeShare();
      if (!stillHere()) return;
      keepNextTakeShare(null);
      clearPracticeResume(userId, arcId);
      if (share) void thread.append(shareLineDraft(WALK_COPY.shareOnlyMe, share, arcId)).catch(() => undefined);
      writeExploreArc(userId, arcId, takeIndex + 1, undefined, latest?.sessionId ?? latestArcSessionId(arcId));
      (onStartInProject ?? onStart)();
    } finally {
      recordRequestPending.current = false;
    }
  }

  function recordOffer(message: LoungeMessage, arcId?: string) {
    if (message.role !== "bot" || !thread.signedIn || !offersNextTake(message.metadata)) return null;
    const shownAt = shownMessages.findIndex((item) => item.client_id === message.client_id);
    const previousTake = !openChat && shownAt > 0 ? restingTake(shownMessages.slice(0, shownAt)) : null;
    const target = arcId ?? projectIdOf(message) ?? previousTake?.arcId;
    return target ? <RecordNextTakeLink offer={message.metadata} onRecord={() => { void recordNext(target); }} /> : null;
  }

  async function handleSend(spoken?: SpokenChatAnswer): Promise<boolean> {
    const submittedDraft = spoken?.text ?? draftText;
    const q = submittedDraft.trim();
    if (!q || botThinking || sendingRef.current || !outbox.ready) return false;
    if (spoken?.audio && spoken.turnId && userId) {
      sendingRef.current = true;
      try {
        await keepChatReplyAudio(spoken, userId);
      } finally {
        sendingRef.current = false;
      }
      if (!outbox.isCurrent()) return false;
      const question = spoken.practiceReplyId ? null : openProjectQuestion(shownMessages);
      setDraftText("");
      await sendTypedTurn(beginTypedTurn(q, question, submittedDraft, spoken));
      return true;
    }
    if (!spoken) setDraftText("");
    // Free words under a Take's open Will question are a real chat turn. The
    // tap endpoint accepts only its fixed choices and otherwise answers with
    // a generic acknowledgement; typed words need the contextual model path.
    const typedQuestion = openProjectQuestion(shownMessages);
    if (citation) {
      await sendTypedTurn(beginTypedTurn(q, typedQuestion, submittedDraft, spoken));
      return true;
    }
    const retry = spoken ? undefined : outbox.turns.findLast((turn) =>
      !turn.user.metadata?.will_voice && turn.request.question === q && turn.question?.client_id === typedQuestion?.client_id);
    if (retry) {
      await sendTypedTurn(retry);
      return true;
    }
    // The way in waits for these words: "Something else", or Will's last
    // question after the walk (backend N573, N592 item 2).
    if (!typedQuestion && plan.say(q)) {
      followAnswer();
      return true;
    }
    if (!typedQuestion && setupWaits) {
      // Refused or not sent: the words go back into the box, never lost.
      if ((await setupWaits.say(q)) === false) setDraftText(q);
      followAnswer();
      return true;
    }
    // A host who set up their chat asks to change it: its parts open again
    // (backend N618 item 8). No call for anyone without a set-up chat.
    if (!typedQuestion && await sayToWill(q)) return true;
    if (sendingRef.current) {
      if (!spoken) setDraftText(submittedDraft);
      return false;
    }
    await sendTypedTurn(beginTypedTurn(q, typedQuestion, submittedDraft, spoken));
    return true;
  }

  // ── R4-2 · LOCKED INVARIANT ────────────────────────────────────────────────
  // Every quick-reply ANSWER a user gives by TAPPING A BUTTON (the joke pills,
  // any "about WillpowerLab" answer buttons, and every future offer button)
  // MUST post through postAnswerBubble. thread.append is the exact persistent
  // path a TYPED message uses — server `lounge_messages` when signed in,
  // localStorage when guest — so a tapped answer survives reload identically to
  // a typed one. Do NOT post an answer via appendLocalOnly (that is bot-turn
  // only, for turns the BE persists) or any non-persisted path. New answer
  // buttons: route the label through here, full stop.
  // WIL-74 — "Did this feedback help you?": the backend keeps the tap and
  // writes it with the signed reply, then the thread reads it back. The
  // typing dots while it does, as for Will's question and a typed answer
  // (B8; founder 2026-11-10: "nothing happens for a moment").
  async function answerFeedbackCheck(
    target: { arcId: string; takeSessionId: string },
    choice: FeedbackCheckChoice,
  ): Promise<void> {
    setBotThinking(true);
    followAnswer();
    try {
      if (await postFeedbackCheck(target.arcId, target.takeSessionId, choice)) await reload();
    } finally {
      setBotThinking(false);
    }
    followAnswer();
  }

  // N82 — Will's one question after a Take: the backend keeps the tap and
  // writes it with the reply, then the thread reads it back. The typing
  // dots while it does, as for a typed answer (B8).
  async function answerWillQuestion(target: WillQuestionTarget, choice: string): Promise<void> {
    // "Something else", the first of his answers, opens the box (N483 item 2).
    if (choice === SOMETHING_ELSE) return focusComposer();
    if (botThinking || sendingRef.current) return;
    sendingRef.current = true;
    const optimistic = thread.own(choice);
    setBotThinking(true);
    try {
      const accepted = await postWillQuestion(target.arcId, target.takeSessionId, choice);
      if (!accepted) throw new Error("Will question was not accepted");
      optimistic.settle();
      await reload();
    } catch (err) {
      // The choice endpoint owns successful rows but cannot take an idempotency
      // key. If it did not accept the turn, replace the transient row with one
      // frontend-owned recoverable row and keep the question open.
      optimistic.drop();
      const hint = typedHint(place, target.arcId, openChat);
      thread.appendRecoverable(withHint({
        role: "user",
        kind: "text",
        body: choice,
        metadata: {
          take_session_id: target.takeSessionId,
          will_question_step: "answer",
        },
      } as LoungeMessageDraft, hint));
      thread.appendRecoverable(withHint(
        {
          ...chatFailureReply(err, thread.signedIn, true),
          metadata: typedProjectErrorMetadata({
            arcId: target.arcId,
            takeSessionId: target.takeSessionId,
            place,
          }),
        },
        hint,
      ));
    } finally {
      setBotThinking(false);
      sendingRef.current = false;
    }
    followAnswer();
  }

  function postAnswerBubble(label: string) {
    // An answer to the speaking chat's own question stays there (N636 item 1).
    const hint = typedHint(place, readExploreArc(userId)?.arcId, openChat);
    void thread.append(withHint({ role: "user", kind: "text", body: label } as LoungeMessageDraft, hint)).then((m) => {
      if (m) rememberPlace(m.client_id, place);
    });
  }

  // What a reply did to the asks (founder 2026-10-20). A number typed under
  // the WhatsApp ask was saved: the reply says so, and the form closes.
  // Without its country code, the form opens with it, to fix. A turn that
  // passed the Take's ask: the message after the Take is under the reply
  // now, so the form closes and the thread is read again.
  function settleAsks(resp: ChatQueryResponse, typed: string): void {
    const saved = resp.row_metadata?.whatsapp;
    if (saved === "saved") {
      whatsapp.refresh();
      setActiveOffer((open) => (open === "whatsapp" ? null : open));
    }
    if (saved === "invalid") whatsapp.setDraft(typed);
    // A full number: the form opens on its code, nothing saved until the
    // code is typed (backend N235).
    const number = resp.row_metadata?.phone;
    if (saved === "check" && typeof number === "string") whatsapp.checkNumber(number);
    // A new deck stays in this project (N257): Will's `update_slides` puts
    // the upload card in place of the message box, never a chip.
    if (offersUpdateSlides(resp.suggested_actions)) slidesAsk.open();
    const lens = lensAskOf(resp.row_metadata);
    if (lens) lifeGoals.openLens(lens);
    if (yourWhyOpenOf(resp.row_metadata)) why.openLens({ mode: "sit" });
    if (resp.after_take) {
      setActiveOffer(null);
      void reload().catch(() => undefined);
    }
  }

  function currentPresentationContext() {
    const activeProject = readExploreArc(userId);
    return {
      has_current_project: activeProject !== null,
      completed_takes: activeProject ? Math.max(0, activeProject.nextTakeIndex - 1) : 0,
      has_pdf: Boolean(activeProject?.deck?.presentationRef),
    };
  }

  function regularScreenHistory(screen: LoungeMessage[]): ChatHistoryEntry[] {
    if (!thread.signedIn) return loungeToHistory(screen);
    return screenHistory(screen, {
      walkOf: (message) => {
        const walk = walkAt.get(message.client_id);
        return walk ? { take: walk.takeIndex, summary: summaries.get(walk.take) ?? null } : null;
      },
      cardOf: (message) => reviewCardOf(message, threadItems),
      coachWaits: (message) =>
        latestIdealIds.has(message.client_id) &&
        newCoachFeedbackFor(typeof message.metadata?.arc_id === "string" ? message.metadata.arc_id : null),
    });
  }

  function openReplyActions(response: ChatQueryResponse, q: string, screen: LoungeMessage[]) {
    const chatOffer = readOfferType({ offer: response.offer });
    settleAsks(response, q);
    if (chatOffer) {
      if (newestAsk(screen) !== chatOffer) thread.appendLocalOnly(offerDraft(chatOffer));
      setActiveOffer(chatOffer);
    }
    const takeCard = response.take_card;
    if (showTakeArtifacts && takeCard && typeof takeCard.arc_id === "string" && takeCard.arc_id) {
      thread.appendLocalOnly(idealTextReadyDraft({
        arcId: takeCard.arc_id,
        version: typeof takeCard.version === "number" ? takeCard.version : null,
        topic: takeCard.topic ?? undefined,
      }));
    }
  }

  function beginTypedTurn(q: string, question: LoungeMessage | null, draft: string, spoken?: SpokenChatAnswer) {
    const { scopedQuestion, arcId, takeId, reviewFocus } = loungeTurnScope(question, citation, hostedPractice(spoken?.practiceReplyId));
    const turnPlace = openChat ? null : place;
    const hint = typedHint(turnPlace, arcId, openChat);
    const scope = arcId && takeId ? {
      ...typedProjectTurnMetadata({
        arcId, takeSessionId: takeId,
        questionClientId: scopedQuestion?.client_id ?? "", role: "answer", place: turnPlace,
      }),
      ...(reviewFocus ? { review_focus: reviewFocus } : {}),
      ...(citation ? { take_exchange: true } : {}),
    } : null;
    const metadata = { ...hint, ...scope, ...(spoken ? {
      will_voice: true, duration_ms: spoken.durationMs, ...(spoken.audio && spoken.receipt ? { voice_clip: true } : {}),
      ...(spoken.practiceReplyId ? { chat_practice_reply_id: spoken.practiceReplyId } : {}),
    } : {}) };
    const pendingIds = new Set(outbox.turns.map((t) => t.user.client_id));
    const screen = shownMessages.filter((m) => !pendingIds.has(m.client_id));
    const history = arcId
      ? projectConversationHistory(messages.filter((m) => !pendingIds.has(m.client_id)), arcId)
      : regularScreenHistory(screen);
    const turn = outbox.begin(draft, { role: "user", kind: "text", body: q, clientId: spoken?.turnId, metadata }, scopedQuestion, {
      question: q, history, historySource: thread.signedIn ? "screen" : undefined,
      projectId: arcId, sessionId: takeId, place: turnPlace, persist: thread.signedIn,
      voiceReceipt: spoken?.receipt,
      presentationContext: { ...currentPresentationContext(), ...(reviewFocus ? { review_focus: reviewFocus } : {}) },
    });
    rememberPlace(turn.user.client_id, place);
    return turn;
  }

  async function sendTypedTurn(turn: PendingChatTurn) {
    if (sendingRef.current || outbox.isSending(turn)) return;
    sendingRef.current = true;
    setDraftText((draft) => draft === turn.draft ? "" : draft);
    setBotThinking(true);
    setActiveOffer((open) => open === "feedback_check" ? null : open);
    atBottomRef.current = true;
    const { projectId, sessionId } = turn.request;
    const reviewFocus = turn.request.presentationContext?.review_focus;
    const project = projectId && sessionId ? { arcId: projectId, takeSessionId: sessionId } : null;
    try {
      const result = await outbox.deliver(turn, (response) => {
        const body = chatReplyBody(response, project ? null : "I know nothing about that, at least yet 😏");
        if (!body || isReplayedTerminalReply(body, messages, response)) throw new Error("Missing contextual reply");
        const projectMeta = project ? typedProjectTurnMetadata({
          arcId: project.arcId, takeSessionId: project.takeSessionId,
          questionClientId: turn.question?.client_id ?? "", role: "reply", place: openChat && reviewFocus ? null : place,
        }) : null;
        return {
          role: "bot", kind: "text", body,
          metadata: { ...typedHint(openChat && reviewFocus ? null : place, project?.arcId, openChat), ...chatReplyMetadata(response),
            ...projectMeta, ...response.row_metadata, ...(reviewFocus ? { review_focus: reviewFocus } : {}) },
        };
      });
      if (!result || !outbox.isCurrent()) return;
      setDraftText((draft) => draft === turn.draft ? "" : draft);
      rememberPlace(result.reply.client_id, place);
      if (thread.signedIn) {
        announceDiscoveriesFromPersistedMessages([result.reply]);
        if (project) await reload();
        else openReplyActions(result.response, turn.user.body, shownMessages);
      }
    } catch (err) {
      if (!outbox.isPending(turn)) return;
      const failure = chatFailureReply(err, thread.signedIn, readExploreArc(userId) !== null);
      if (failure.metadata?.suggested_action === "start_first_recording") {
        await thread.append(withHint(failure, typedHint(place, null, openChat)));
        outbox.forget(turn);
      } else {
        if (!turn.user.metadata?.voice_clip) setDraftText((draft) => draft || turn.draft);
      }
    } finally {
      sendingRef.current = false;
      setBotThinking(false);
      followAnswer();
    }
  }

  // One drawn item of the thread: Will's setup for the one who shares
  // (backend N503), a walk step (the review's end card), a summary, or any
  // other bubble.
  const drawSetup = (item: ThreadItem, i: number, setup: JoinSetup) => (
    <JoinSetupBubble
      key={item.reactKey}
      message={item.message}
      setup={setup}
      open={i === shownItems.length - 1}
      onTap={(picked) => joinSetup.tap(item.message.client_id, picked).then(followAnswer)}
      onAgain={() => joinSetup.again().then(followAnswer)}
      onWords={focusComposer}
    />
  );
  const drawChatSetup = (item: ThreadItem, i: number, setup: ChatSetup) => (
    <ChatSetupBubble
      key={item.reactKey}
      message={item.message}
      setup={setup}
      open={i === shownItems.length - 1}
      onTap={(picked) => chatSetup.tap(item.message.client_id, picked).then(followAnswer)}
      builder={assistant.builder}
      onBegin={chatSetupCanBegin(shownMessages) ? () => void chatSetup.begin().then(followAnswer) : undefined}
    />
  );
  const drawItem = (item: ThreadItem, i: number) => {
    const failed = outbox.turns.find((turn) => turn.user.client_id === item.message.client_id && !outbox.isSending(turn));
    if (failed) return (
      <Fragment key={item.reactKey}>
        {drawThreadItem(item, i)}
        <ChatTurnRetry disabled={botThinking || outbox.readingHistory} onRetry={() => void sendTypedTurn(failed)} />
      </Fragment>
    );
    const setup = joinSetupOf(item.message);
    if (setup) return drawSetup(item, i, setup);
    // The earlier builder's rows, once the new setup took over, are Will's
    // plain lines: no taps, no way in (N632 item 1).
    const own = chatSetupOf(item.message, assistant.retired);
    return own ? drawChatSetup(item, i, own) : drawThreadItem(item, i);
  };

  // One shown row: a Take's Feedback walk with its card as one pair (N202),
  // else the row as drawn.
  /** A host's chat's own messages newer than its newest row (N648 item 8). */
  const hostRowsAfter = () => member ? hostRows.after.map(member.row) : null;

  const drawShown = (item: ThreadItem, i: number) => {
    const id = item.message.client_id;
    const take = item.message.metadata?.take_exchange !== false && !isChatPracticeTurn(item.message)
      ? takeConversations.get(takeSessionOf(item.message) ?? "") : undefined;
    if (take) {
      if (take.anchor !== id) return null;
      return <LoungeTakeConversation key={composerScope + ":" + take.takeId} arcId={take.arcId} takeId={take.takeId}
        rows={take.rows} chat={openChat ?? undefined} openOnArrival={readyHostedTake === take.takeId}
        recordingDock={recordingDock} savedWordings={savedWordings}
        onCitation={(next) => {
          if (next) setReadyHostedTake((current) => current === next.takeId ? null : current);
          setCitation((current) => next ?? (current?.takeId === take.takeId ? null : current));
          if (next?.quote) focusComposer();
        }} onReload={() => { void reload(); }}
        renderFooter={(message) => {
          const failed = outbox.turns.find((turn) => turn.user.client_id === message.client_id && !outbox.isSending(turn));
          if (failed) return <ChatTurnRetry disabled={botThinking || outbox.readingHistory} onRetry={() => void sendTypedTurn(failed)} />;
          return recordOffer(message, take.arcId);
        }} />;
    }
    const walk = walkAt.get(id);
    if (!walk) return drawItem(item, i);
    const cardId = pairs.cardOf.get(id);
    const next = shownItems[i + 1];
    const card = cardId && next?.message.client_id === cardId ? next : null;
    const bubble = (
      <FeedbackWalkBubble
        key={item.reactKey}
        walk={walk}
        older={olderTake(item.message.metadata)}
        waits={walkWaits(walk)}
        live={reviewToContinue}
        paired={card !== null}
        onOpened={(seen) => seen.forEach((m) => setSeenUpdates(keepSeenUpdate(m)))}
        onOpenIdealText={openIdealText}
      />
    );
    return card ? (
      <div key={item.reactKey} data-walk-pair="" className="flex flex-col gap-[3px]">
        {bubble}
        {drawItem(card, i + 1)}
      </div>
    ) : (
      bubble
    );
  };
  const drawThreadItem = (item: ThreadItem, i: number) =>
    item.message.kind === "walk_step" ? (
      <WalkStepBubble
        key={item.reactKey}
        message={item.message}
        card={reviewCardOf(item.message, threadItems)}
        latest={latestIdealIds.has(item.message.client_id)}
        newWords={olderNewWords.get(item.message.client_id)}
        waiting={stepWaits(item.message)}
        lockedTake={olderTake(item.message.metadata)}
        onOpened={() => setSeenUpdates(keepSeenUpdate(item.message))}
        onOpenIdealText={openIdealText}
        onOpenPastIdealText={openPastIdealText}
      />
    ) : isSummaryLike(item.message.metadata) ? (
      <SummaryBubble key={item.reactKey} message={item.message} />
    ) : isOwnVoiceNote(item.message, notebook) ? (
      <VoiceNoteBubble key={item.reactKey} body={item.message.body} clientId={item.message.client_id} notebook={notebook}>
        <Linkified text={item.message.body} />
      </VoiceNoteBubble>
    ) : (
      <Bubble
        key={item.reactKey}
        message={item.message}
        showTakeArtifacts={showTakeArtifacts}
        recordingDock={recordingDock}
        shareLine={shares.get(item.message.client_id) ?? null}
        shareChange={shareChange?.recording === item.message.client_id ? shareChange : null}
        onOpenBestPresentation={(arcId) =>
          openIdealText(arcId)
        }
        onOpenTranscripts={(arcId) => {
          if (!arcId && sidebar) sidebar.show();
          else if (onOpenProject) onOpenProject(arcId ?? null);
          else onStart();
        }}
        onOpenFeedback={openFeedback}
        onOpenIdealText={openIdealText}
        onOpenPastIdealText={openPastIdealText}
        // A plan row's sheet is the speaking chat's: its tap opens that chat first.
        planRows={speakingFirst(plan.rows, place)}
        latestForArc={latestIdealIds.has(item.message.client_id)}
        onRetryIdealText={retryIdealTextFromCard}
        onOpenConfidencePractice={setConfidencePracticeId}
        onChip={onChip}
        recordOffer={recordOffer(item.message)}
        activeOffer={activeOffer}
        onOpenOffer={setActiveOffer}
        willOpen={i === shownItems.length - 1}
        willBusy={botThinking}
        onWillAnswer={answerWillQuestion}
        onOpenLifeGoal={(goalId) => lifeGoals.openLens({ mode: "see", goalId })}
        onOpenSunday={openSunday}
        onOpenWhy={(line) => why.openLens({ mode: "change", line })}
        onOpenStrength={strengths.openLens}
        sundayWaiting={(id) => sundayWaiting(messages, id)}
        animate={
          i === shownItems.length - 1 &&
          baselineRef.current !== null &&
          !baselineRef.current.has(item.message.client_id)
        }
      />
    );

  return (
    <MemberConversationFrame member={member}>
    {/* Like WhatsApp (founder 2026-10-30): the thread runs down to the
       composer. An empty slot takes no room (hidden; never the thread, which
       is empty while it loads), and the thread's -mb-1 leaves 8px of the
       gap under it: what scrolls stops 8px above the bar, as the bar keeps
       8px from the sides and the bottom (N505). The column is the shared
       1080px app canvas, aligned with the logo and hamburger. */}
    <ChatPracticeContext.Provider value={chatPractice}>
    <div data-member-take-chat={member?.id}
      className={`${WILLAB_CONTENT_RAIL} relative flex min-h-0 flex-1 flex-col gap-3 overflow-hidden px-2 [&>:empty:not([data-thread])]:hidden`}>
      {/* The lenses draw into the thread and the composer's slot (ChatLens);
          where they mount takes no room in the column. */}
      <div className="absolute">
        {lifeGoals.lens}
        {why.lens}
        {strengths.lens}
        <SundayLens
          noteId={sunday?.id ?? null}
          nonce={sunday?.nonce ?? 0}
          onClose={() => {
            setSunday(null);
            void reload();
          }}
        />
      </div>
      {/* Notifications: one at a time, in a bar at the top, never in the
          buttons under the chat (founder 2026-11-03, backend N391). */}
      <NoticeBar signedIn={thread.signedIn} whatsapp={whatsapp} />
      {assistant.sheet}
      {/* The speaking way in's Take 1 (backend N453 items 1 and 7, N592): a
          thin row on top of the chat while it is processed, in place of the
          full wait; orange once its walk is ready. */}
      <WayInTop
        on={plan.firstTakeWayIn}
        resume={loungeResume}
        readyArc={wayInReadyArc}
        walkReady={plan.wayInWalkReady}
        label={PROCESSING_STAGES[0]}
        onOpen={openFirstTakeFeedback}
      />
      {/* Founder 2026-07-30 — the status region above the thread is GONE, and
          with it the last top banner. U5 moved the sent confirmation into the
          thread and U6 did the same for insights ready; the parked card was
          the one left, and it announced "Ideal text N.0 is waiting for you"
          directly above the thread's own ideal-text card, which says the same
          thing about the same document and opens it. Two banners for one
          document, one of them outside the conversation the product is. */}
      <ChatScroll ref={scrollRef} data-thread data-rhythm onScroll={handleThreadScroll}
        className={thread.loading ? "-mb-1" : "-mb-1 [&>:first-child]:mt-auto"}>
        {member?.introduction}
        {thread.hasMore && (
          <button
            type="button"
            data-load-older
            onClick={() => void thread.loadOlder(keepPlace)}
            disabled={thread.loadingOlder}
            className="mx-auto text-[12px] text-muted-foreground hover:text-foreground disabled:opacity-50"
          >
            {thread.loadingOlder ? "Loading…" : "Load earlier messages"}
          </button>
        )}

        <LoungeMessageRows member={member} waiting={outbox.waitingForHistory} place={place}
          empty={threadItems.length === 0} hidesEmpty={plan.holdsEmpty} hostRowsAfter={hostRowsAfter}
          rows={() => shownItems.map((item, i) => {
            const line = dayLines.get(i);
            // Keep the Take's component mounted when a day label or a host
            // message is later inserted next to it.
            return <Fragment key={item.reactKey}>
              {member ? hostRows.before[i].map(member.row) : null}
              {line ? <DayLine text={line} /> : null}
              {pairedCards.has(item.message.client_id) ? null : drawShown(item, i)}
            </Fragment>;
          })} />

        {/* The questions people asked, bundled, for the chat builder's ring
            (backend N584 item 2); nothing without it. */}
        <BundleQueue signedIn={thread.signedIn} onRecord={onRecordAnswer} />

        {/* What needs you, for the chat builder's ring (backend N629 item 1);
            nothing without it, where the setup's read is 404. */}
        <PlaceOnly place={place} in={["will"]}>{thread.signedIn ? <WillBuild onBack={() => setOpenPlace("speaking")} /> : null}</PlaceOnly>
        <OwnChatLinks place={place} messages={messages} onJoinQuestions={() => void joinSetup.again().then(followAnswer)} />

        {/* The plan's answers under Will's question, the after-walk way
            (N319 item 1): tap answers on the right, or the 1 to 10 scale. */}
        <PlaceOnly place={place} in={["speaking"]}>
          {plan.asks}
          {keyLine.notNow}
        </PlaceOnly>

        {/* While a Take processes (founder lock 2026-10-12, section 1): a
            bubble in the chat with the typing dots (founder 2026-10-20, in
            place of the breathing mark); its tap opens the processing view. */}
        {bottomProcessing(loungeResume, plan.firstTakeWayIn) ? (
          <div className="mr-auto flex max-w-[88%] items-end gap-1.5">
            <button
              ref={processingTriggerRef}
              type="button"
              aria-haspopup="dialog"
              data-processing-bubble=""
              onClick={() => openProcessing(loungeResume)}
              className="flex items-center gap-2.5 rounded-[16px] bg-muted px-3 py-2 text-left text-[15px] leading-[1.45] text-foreground"
            >
              <TypingGlyph />
              <span>{PROCESSING_STAGES[0]}</span>
            </button>
          </div>
        ) : null}

        {/* Out of tokens — the paid plans as tappable chips, one tap to
            Stripe. FIRST of the in-thread cards on purpose: being unable to
            continue outranks an optional profile question. Stacking is
            allowed and needs no logic (founder ruling) — if someone qualifies
            for two cards they render as two bubbles, each with its own gate,
            neither knowing the other exists. */}
        <TopUpBubble offer={topUp} />

        <VoiceNoteThread notebook={notebook} />
        {plan.pending}
        {/* A lens's bubbles, when one is open (ChatLens, backend N691 item 5). */}
        <div {...{ [CHAT_LENS_THREAD]: "" }} className="flex flex-col empty:hidden" />
        <ThreadDots thinking={botThinking} writing={thread.writing} processingVoice={outbox.processingVoice} />
      </ChatScroll>

      {/* The coach's one door (founder 2026-09-30, A1): the walk. Coaches can
          still record, so this sits above the record CTA, not instead of it. */}
      {isCoach && <CoachWalkEntry />}

      {/* Async analysis (delivery layer): a take left mid-analysis (closed tab /
          locked phone) keeps finishing server-side — this chip resumes a calm
          indicator from the persisted marker and clears itself when done. */}
      <LoungeProcessingFailure active={loungeResume?.status === "failed"} retrying={retryingProcessing}
        onRetry={() => void retryPreservedProcessing()} />

      {/* The record-button slot. While an offer is "armed" (freshly triggered,
          or re-opened by tapping its thread bubble) its action pair REPLACES the
          black record button; resolving it returns the record button (U2). The
          offer's prompt + outcome live in the thread as durable bubbles. */}
      <NewProjectAskSlot ask={newProjectAsk}>
      <SlidesAskSlot ask={slidesAsk} onReady={(line) => void thread.append(slidesReadyDraft(line, readExploreArc(userId)?.arcId))}>
      <TopUpSlot offer={topUp}>
      {activeOffer ? (
        <OfferActions
          type={activeOffer}
          whatsapp={whatsapp}
          onFeedbackCheck={(choice) => {
            const target = feedbackCheckTarget(messages, "ask");
            if (target) void answerFeedbackCheck(target, choice);
          }}
          onNotebook={notebook.answer}
          onSundayNote={(choice) => {
            const id = sundayAskOf(messages);
            if (!id) return;
            if (choice === "investigate") openSunday(id);
            else void answerSundayNote(id, "dismiss").then(() => reload());
          }}
          onLifeGoals={lifeGoals.answerAsk}
          onLifeGoalsQuarter={(choice) => lifeGoals.answerQuarter(quarterAskOf(messages), choice)}
          onLifeGoalsChange={(choice) => lifeGoals.answerChange(changeAskOf(messages), choice)}
          onSalesStep={(step) => notebook.answerSales(salesAskOf(messages), step)}
          onYourWhy={why.answerAsk}
          onStrengths={(choice) => strengths.answerAsk(strengthAskOf(messages), choice)}
          onResolve={() => {
            // A Take's ask closed: its message comes under it (the question's
            // taps let it go on the backend, "No" keeps it waiting).
            if (activeOffer !== "feedback_check" && waiting) void letGo();
            setActiveOffer(null);
          }}
        />
      ) : null}
      </TopUpSlot>
      </SlidesAskSlot>
      </NewProjectAskSlot>

      <PlaceOnly place={place} in={["speaking"]}>
        {plan.dock}
        {plan.sheets}
        {plan.barMiddle}
      </PlaceOnly>
      {/* A lens's taps or field, in the composer's place while it asks. */}
      <div {...{ [CHAT_LENS_DOCK]: "" }} className="peer empty:hidden" />
      <div ref={setRecordingDock} className="peer empty:hidden" />
      <div className="peer-[:not(:empty)]:hidden">
        <LoungeComposer key={composerScope}
          place={place} openChat={openChat} draft={draft} plan={plan} keyLine={keyLine} notebook={notebook}
          held={recordBarHeld(takeInFlight, thread, plan.recordWaits)}
          busy={botThinking || !outbox.ready}
          citation={citation} voice={reviewVoice} memberComposer={memberInput(member, memberState.reviewing, draft)}
          clearCitation={() => setCitation((current) => !member && current ? { ...current, focus: undefined, quote: undefined } : null)}
          onSend={() => stagedVoice && draftText.trim()
            ? handleSend({ ...stagedVoice.answer, text: draftText.trim() })
            : handleSend()} onProjects={sidebar?.show ?? onStart}
          onStartTake={memberState.onStart}
          onUpload={onStartInProject ?? onStart} onSlides={readExploreArc(userId) ? slidesAsk.open : undefined}
        />
      </div>

      {confidencePracticeId && (
        <ConfidencePracticeOverlay
          practiceId={confidencePracticeId}
          onClose={() => setConfidencePracticeId(null)}
        />
      )}
      {showLoungeProcessing && waitScreen.view ? (
        <ProcessingResumeOverlay
          progress={waitScreen.view.progress}
          phase={waitScreen.view.phase}
          cycleStartedAt={waitScreen.view.startedAt}
          phaseStartedAt={waitScreen.view.phaseStartedAt}
          onClose={() => {
            waitScreen.lift();
            closeProcessingOverlay();
            // The chat it shows lands on the processing bubble.
            followAnswer();
          }}
        />
      ) : null}
    </div>
    </ChatPracticeContext.Provider>
    </MemberConversationFrame>
  );
}


/** The footer action pair for the currently-armed offer — it replaces the
 *  record button. The matching prompt bubble already lives in the thread; here
 *  we only render the grey/orange pair and call onResolve to return the record
 *  button once the user picks. Notifications never come here: they are in the
 *  bar at the top (NoticeBar.tsx, backend N391). */
function OfferActions({
  type,
  whatsapp,
  onFeedbackCheck,
  onNotebook,
  onSundayNote,
  onLifeGoals,
  onLifeGoalsQuarter,
  onLifeGoalsChange,
  onSalesStep,
  onYourWhy,
  onStrengths,
  onResolve,
}: {
  type: OfferType;
  whatsapp: WhatsAppOffer;
  /** WIL-74 — a tap on "Did this feedback help you?". */
  onFeedbackCheck: (choice: FeedbackCheckChoice) => void;
  /** "Keep a voice notebook?" (Will learning plan, step 1). */
  onNotebook: (choice: "yes" | "not_now") => void;
  /** The Sunday note's Old | New, then Not now | Add principle (step 2). */
  /** The Sunday note's case: Not now | Investigate (N158 L2). */
  onSundayNote: (choice: "investigate" | "not_now") => void;
  /** "One more thing: your life goals." (step 3, N172 M1). */
  onLifeGoals: (choice: "start" | "not_now") => void;
  /** "{emoji} {step}. Did it move?" (N172 M13, N186). */
  onLifeGoalsQuarter: (choice: "start" | "not_now") => void;
  /** "Change {emoji} this quarter to “…”?" (N172 M14, N191). */
  onLifeGoalsChange: (choice: "change" | "not_now") => void;
  /** "Which step did it stall at?" (backend N241 P2). */
  onSalesStep: (step: SalesStep) => void;
  /** "One more thing: your why." (backend N255 Q1). */
  onYourWhy: (choice: "start" | "not_now") => void;
  /** "We spotted a strength!" (backend N241 N2). */
  onStrengths: (choice: "look" | "not_now") => void;
  onResolve: () => void;
}) {
  if (type === "your_why" || type === "strengths") {
    const yes = type === "your_why" ? "start" : "look";
    const pick = (choice: "yes" | "not_now") => {
      if (type === "your_why") onYourWhy(choice === "yes" ? "start" : "not_now");
      else onStrengths(choice === "yes" ? "look" : "not_now");
      onResolve();
    };
    return (
      <AnswerPair
        closeLabel={NOT_NOW}
        onClose={() => pick("not_now")}
        actionLabel={yes === "start" ? "Start" : "Look"}
        onAction={() => pick("yes")}
      />
    );
  }
  if (type === "sales_step") {
    return (
      <SalesSteps
        onPick={(step) => {
          onSalesStep(step);
          onResolve();
        }}
      />
    );
  }
  if (type === "sunday_note") {
    return (
      <AnswerPair
        closeLabel={NOT_NOW}
        onClose={() => {
          onSundayNote("not_now");
          onResolve();
        }}
        actionLabel="Investigate"
        onAction={() => {
          onSundayNote("investigate");
          onResolve();
        }}
      />
    );
  }
  if (type === "life_goals_change") {
    return (
      <AnswerPair
        closeLabel={NOT_NOW}
        onClose={() => {
          onLifeGoalsChange("not_now");
          onResolve();
        }}
        actionLabel="Change"
        onAction={() => {
          onLifeGoalsChange("change");
          onResolve();
        }}
      />
    );
  }
  if (type === "life_goals" || type === "life_goals_quarter") {
    const pick = type === "life_goals" ? onLifeGoals : onLifeGoalsQuarter;
    return (
      <AnswerPair
        closeLabel={NOT_NOW}
        onClose={() => {
          pick("not_now");
          onResolve();
        }}
        actionLabel="Start"
        onAction={() => {
          pick("start");
          onResolve();
        }}
      />
    );
  }
  if (type === "voice_notebook") {
    return (
      <AnswerPair
        closeLabel={NOT_NOW}
        onClose={() => {
          onNotebook("not_now");
          onResolve();
        }}
        actionLabel="Yes"
        onAction={() => {
          onNotebook("yes");
          onResolve();
        }}
      />
    );
  }
  if (type === "feedback_check") {
    return (
      <AnswerPair
        closeLabel={FEEDBACK_CHECK_LABEL.notReally}
        onClose={() => {
          onFeedbackCheck("not_really");
          onResolve();
        }}
        actionLabel={FEEDBACK_CHECK_LABEL.yes}
        onAction={() => {
          onFeedbackCheck("yes");
          onResolve();
        }}
      />
    );
  }
  if (type === "whatsapp") {
    return <WhatsAppOfferActions key={whatsapp.draft ?? ""} offer={whatsapp} onResolve={onResolve} />;
  }
  // The legacy joke offer is the only other type. Its onboarding was deleted
  // (SD/FE-4) and openOffer already refuses to arm it, so this is a dismiss-only
  // fallback for an old thread bubble rather than a live action pair.
  return <TapRow labels={[CLOSE]} onTap={onResolve} dataAttr={{ "data-answer-pair": "" }} />;
}


/** What a bot message offers under it (backend N467 items 4 and 5): ways
 *  to go as links on Will's side, one per line, and "Skip" as a grey word
 *  on the right. Each comes from the message's metadata, so it survives a
 *  reload. */
function BotWays({
  metadata,
  onChip,
  onOpenFeedback,
  onOpenConfidencePractice,
}: {
  metadata: LoungeMessage["metadata"];
  onChip?: (action: ChipAction) => void;
  onOpenFeedback?: (target: FeedbackBubbleTarget) => void;
  onOpenConfidencePractice?: (practiceId: string) => void;
}) {
  const uiLocale = useUiLocale();
  const productAction = productActionFromMetadata(metadata);
  const productDestination = productAction
    ? productSpec(productAction.product)
    : null;
  const confidenceCorrection =
    metadata?.confidence_material_correction === true &&
    typeof metadata?.arc_id === "string" &&
    typeof metadata?.take_session_id === "string"
      ? {
          arcId: metadata.arc_id,
          takeSessionId: metadata.take_session_id,
          takeIndex: null,
        }
      : null;
  const sharedPracticeId =
    metadata?.note === "confidence_practice_shared" &&
    typeof metadata?.practice_id === "string"
      ? metadata.practice_id
      : null;
  // WIL-74 — a coach's card about a speaker's new goal opens that speaker.
  const goalCardSpeaker =
    metadata?.card === "goal_change" &&
    typeof metadata?.speaker === "string"
      ? metadata.speaker
      : null;
  // B-1 — the persisted actions: the pair if there is one, else the one.
  const many = onChip ? coerceSuggestedActions(metadata?.suggested_actions) : [];
  const one = onChip ? coerceSuggestedAction(metadata?.suggested_action) : null;
  const actions = many.length > 0 ? many : one ? [one] : [];
  const ways = actions.filter((action) => action !== "feedback_skip" && !(action === "trainings" && offersNextTake(metadata)));
  return (
    <>
      {/* Ways to go are links on Will's side, one per line; "Skip" is a
          grey word on the right (N467 items 4 and 5). */}
      <ChatLinks>
        {productDestination ? (
          <ChatLink label={productDestination.actionLabel} href={productDestination.href} />
        ) : null}
        {confidenceCorrection && onOpenFeedback ? (
          <ChatLink label="Review coach feedback" onClick={() => onOpenFeedback?.(confidenceCorrection)} />
        ) : null}
        {sharedPracticeId && onOpenConfidencePractice ? (
          <ChatLink label="Open exercise" onClick={() => onOpenConfidencePractice?.(sharedPracticeId)} />
        ) : null}
        {goalCardSpeaker ? (
          <ChatLink label="Open speaker" onClick={() => requestOpenSpeaker(goalCardSpeaker)} />
        ) : null}
        {ways.map((action) => (
          <ChatLink key={action} label={chipLabel(action, uiLocale)} onClick={() => onChip!(action)} />
        ))}
      </ChatLinks>
      {actions.includes("feedback_skip") ? (
        <TapRow labels={[chipLabel("feedback_skip", uiLocale)]} onTap={() => onChip!("feedback_skip")} dataAttr={{ "data-chip-skip": "" }} />
      ) : null}
    </>
  );
}

/** U3 — render a bot message's split chunks. A freshly-arrived reply
 *  (`animate`) reveals them one at a time with a typing indicator between, so
 *  it reads like a person sending a few short messages. Historical messages,
 *  single-chunk messages, and reduced-motion users render everything at once. */
function SequentialBotBubbles({
  chunks,
  animate,
}: {
  chunks: string[];
  animate: boolean;
}) {
  const [reduceMotion, setReduceMotion] = useState(false);
  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    setReduceMotion(
      window.matchMedia("(prefers-reduced-motion: reduce)").matches,
    );
  }, []);

  const shouldAnimate = animate && !reduceMotion && chunks.length > 1;
  const [revealed, setRevealed] = useState(shouldAnimate ? 1 : chunks.length);

  useEffect(() => {
    if (!shouldAnimate) {
      setRevealed(chunks.length); // instant: historical / single / reduced-motion
      return;
    }
    if (revealed >= chunks.length) return;
    const id = setTimeout(() => setRevealed((n) => n + 1), CHUNK_DELAY_MS);
    return () => clearTimeout(id);
  }, [shouldAnimate, revealed, chunks.length]);

  const stillTyping = shouldAnimate && revealed < chunks.length;

  return (
    <div data-row="app" className="mr-auto flex max-w-[85%] flex-col gap-1.5">
      {chunks.slice(0, revealed).map((part, i) => (
        <div
          key={`${i}-${part.slice(0, 12)}`}
          data-bubble=""
          className={conversationBubbleClass(false)}
        >
          {/* FE-13 — Will's replies carry booking links; they were dead text. */}
          <Linkified text={part} />
        </div>
      ))}
      {stillTyping ? <TypingDots /> : null}
    </div>
  );
}

/** An ask's bubble: Will's question with its answers (N82), or an offer
 *  whose action pair arms in the footer; null for any other row. */
function askBubble(
  message: LoungeMessage,
  {
    activeOffer,
    onOpenOffer,
    willOpen,
    willBusy,
    onWillAnswer,
    onOpenLifeGoal,
    onOpenSunday,
    onOpenWhy,
    onOpenStrength,
    sundayWaiting,
    planRows,
  }: {
    activeOffer?: OfferType | null;
    onOpenOffer?: (type: OfferType) => void;
    willOpen: boolean;
    willBusy: boolean;
    onWillAnswer?: (target: WillQuestionTarget, choice: string) => Promise<void>;
    onOpenLifeGoal?: (goalId: string) => void;
    onOpenSunday?: (noteId: string) => void;
    onOpenWhy?: (line: WhyLine) => void;
    onOpenStrength?: (strengthId: string) => void;
    sundayWaiting?: (noteId: string) => boolean;
    planRows?: PlanRowCtx;
  },
) {
  const planned = planRowFor(message, planRows);
  if (planned) return <>{planned}</>;
  if (isWillVoice(message)) return <WillVoiceBubble message={message} />;
  const head = sundayHeadOf(message.metadata);
  if (head) {
    return <SundayHeadBubble body={message.body} waiting={sundayWaiting?.(head) ?? false} onOpen={() => onOpenSunday?.(head)} />;
  }
  const goal = lifeGoalOf(message.metadata);
  if (goal) return <LifeGoalBubble goal={goal} onOpen={() => onOpenLifeGoal?.(goal.id)} />;
  const whyLine = yourWhyLineOf(message.metadata);
  if (whyLine) return <YourWhyBubble body={message.body} onOpen={() => onOpenWhy?.(whyLine)} />;
  const strengthHead = strengthHeadOf(message.metadata);
  if (strengthHead) return <StrengthHeadBubble body={message.body} onOpen={() => onOpenStrength?.(strengthHead)} />;
  const strengthAgain = strengthAgainOf(message.metadata);
  if (strengthAgain) return <StrengthAgainBubble body={message.body} strengthId={strengthAgain} />;
  const will = willQuestionOf(message.metadata);
  if (will) {
    return (
      <WillQuestionBubble
        body={message.body}
        chips={will.chips}
        open={willOpen}
        disabled={willBusy}
        onAnswer={(choice) => onWillAnswer?.(will, choice)}
      />
    );
  }
  // Only Will offers: one's own words are never drawn as his offer, whatever
  // mark their row carries (an earlier Principles row carried one).
  const offerType = message.role === "bot" ? readOfferType(message.metadata) : null;
  if (!offerType) return null;
  return (
    <OfferBubble
      type={offerType}
      body={message.body}
      active={activeOffer === offerType}
      onOpen={() => onOpenOffer?.(offerType)}
    />
  );
}

/** One's own voice note opens its words to fix one (backend N194). */
function isOwnVoiceNote(message: LoungeMessage, notebook: VoiceNotebook): boolean {
  return message.role === "user" && notebook.enabled && typeof message.metadata?.voice_note === "string";
}

/** A message where Will spots something carries the short privacy line
 *  under it, and the notebook's ask its intro above it (backend N411,
 *  NotebookPrivacy.tsx); the backend's own line row is drawn as the line. */
function Bubble(props: Parameters<typeof BubbleBody>[0]) {
  const { message } = props;
  if (message.role !== "bot") return <BubbleBody {...props} />;
  if (isPrivacyLineRow(message.metadata)) return <PrivacyLine />;
  const intro = isNotebookAsk(message);
  const spotted = isSpotted(message.metadata);
  if (!intro && !spotted) return <BubbleBody {...props} />;
  return (
    <>
      {intro ? <NotebookIntro /> : null}
      <BubbleBody {...props} />
      {spotted ? <PrivacyLine /> : null}
    </>
  );
}

function BubbleBody({
  message,
  recordingDock,
  showTakeArtifacts = true,
  onViewInsights,
  onOpenBestPresentation,
  onOpenTranscripts,
  onOpenFeedback,
  onOpenIdealText,
  onRetryIdealText,
  onOpenConfidencePractice,
  onChip,
  recordOffer,
  activeOffer,
  onOpenOffer,
  willOpen = false,
  willBusy = false,
  onWillAnswer,
  onOpenLifeGoal,
  onOpenSunday,
  onOpenWhy,
  onOpenStrength,
  sundayWaiting,
  planRows,
  animate = false,
  latestForArc = false,
  shareLine = null,
  shareChange = null,
  onOpenPastIdealText,
}: {
  message: LoungeMessage;
  recordingDock?: HTMLDivElement | null;
  showTakeArtifacts?: boolean;
  /** An older Ideal Text card opens its own version, read only (backend N375). */
  onOpenPastIdealText?: (arcId: string, past: IdealTextPast) => void;
  /** A recording's line: who heard the Take (G1, N192). */
  shareLine?: string | null;
  /** The latest Take's line opens the sharing screen (N309 item 5). */
  shareChange?: ShareLineChange | null;
  /** The project's latest Ideal Text bubble: it wears the dot (Q39 B). */
  latestForArc?: boolean;
  onViewInsights?: (sessionId: string) => void;
  /** C — open BestPresentationOverlay from the best_presentation_ready card. */
  onOpenBestPresentation?: (arcId: string) => void;
  /** transcript_ready card — opens the owning project conversation. */
  onOpenTranscripts?: (arcId?: string) => void;
  /** Delivery layer — the grey feedback bubbles open their take's page. */
  onOpenFeedback?: (target: FeedbackBubbleTarget) => void;
  /** Delivery layer — every ideal-text bubble opens the live notebook. */
  onOpenIdealText?: (arcId: string, mode?: IdealTextLaunchMode) => void;
  onRetryIdealText?: (
    target: IdealTextRetryTarget,
  ) => boolean | Promise<boolean>;
  /** Coach-shared exercise opens independently of the three-take journey. */
  onOpenConfidencePractice?: (practiceId: string) => void;
  onChip?: (action: ChipAction) => void;
  recordOffer?: ReactNode;
  /** F1/F2/F7 — which offer's action pair is currently armed (for the ring). */
  activeOffer?: OfferType | null;
  /** Tap a persisted offer bubble to re-arm its action pair in the footer. */
  onOpenOffer?: (type: OfferType) => void;
  /** N82 — the newest bubble: Will's question shows its answers to tap. */
  willOpen?: boolean;
  willBusy?: boolean;
  onWillAnswer?: (target: WillQuestionTarget, choice: string) => Promise<void>;
  /** A set life goal's ladder: its › opens the lens on it (N172 M10). */
  onOpenLifeGoal?: (goalId: string) => void;
  /** The Sunday note's "We spotted a pattern!": its › opens the lens again
   *  where it stands, with the orange outline while it waits (N158 L8). */
  onOpenSunday?: (noteId: string) => void;
  /** The day's why: its › opens the line to change it (backend N255 Q6). */
  onOpenWhy?: (line: WhyLine) => void;
  /** "We spotted a strength!": its › opens the lens again (backend N241 N2). */
  onOpenStrength?: (strengthId: string) => void;
  sundayWaiting?: (noteId: string) => boolean;
  /** The plan's rows (docs/flows/the-plan.md): drawn by their metadata. */
  planRows?: PlanRowCtx;
  /** U3 — true only for a freshly-arrived last message → sequential reveal. */
  animate?: boolean;
}) {
  const ask = askBubble(message, {
    activeOffer, onOpenOffer, willOpen, willBusy, onWillAnswer, onOpenLifeGoal, onOpenSunday, onOpenWhy, onOpenStrength, sundayWaiting, planRows,
  });
  if (ask) return ask;
  // Insights come only when asked (backend N691 item 4): the cards that
  // brought a Take's results on their own ("Feedback on …", "Feedback ·
  // Take N", the retired best presentation) are no longer drawn.
  if (RESULT_CARD_KINDS.has(message.kind)) return null;
  if (
    message.kind === "recording_summary" ||
    message.kind === "transcript_ready" ||
    message.kind === "ideal_text"
  ) {
    if (!showTakeArtifacts) return null;
    return (
      <ReportCard
        message={message}
        onViewInsights={onViewInsights}
        onOpenBestPresentation={onOpenBestPresentation}
        onOpenTranscripts={onOpenTranscripts}
        onOpenFeedback={onOpenFeedback}
        onOpenIdealText={onOpenIdealText}
        onOpenPastIdealText={onOpenPastIdealText}
        onRetryIdealText={onRetryIdealText}
        latestForArc={latestForArc}
        shareLine={shareLine}
        shareChange={shareChange}
      />
    );
  }
  if (message.role === "user") {
    if (hasTakeReplyContent(message)) return <TakeConversationMessage message={message} standalone />;
    return (
      <div data-row="me" data-bubble="" className={`ml-auto max-w-[86%] ${conversationBubbleClass(true)}`}>
        {/* FE-13 — both sides of the thread, so a link the user pasted works
            the same as one Will sent. */}
        <Linkified text={message.body} />
      </div>
    );
  }
  if (message.role === "bot") {
    return (
      <>
        {hasTakeReplyContent(message, showTakeArtifacts) ? (
          <TakeConversationMessage message={message} recordingDock={recordingDock} standalone />
        ) : <SequentialBotBubbles
          chunks={splitBotMessage(showTakeArtifacts ? withoutCoachTranscriptFooter(message.body) : speakingCoachReplyText(message))}
          animate={animate}
        />}
        <BotWays
          metadata={message.metadata}
          onChip={onChip}
          onOpenFeedback={showTakeArtifacts ? onOpenFeedback : undefined}
          onOpenConfidencePractice={showTakeArtifacts ? onOpenConfidencePractice : undefined}
        />
        {recordOffer}
        {/* FE-5 — the life card rides in metadata exactly like the B-1 chip
            above, so it survives reload and scroll-back without a second write
            path. A turn that carried none passes undefined and renders null,
            which is every turn for a user who is not on the panel. */}
        <LifeChatCard raw={message.metadata?.life_card} />
      </>
    );
  }
  // system / status → centered meta line
  return (
    <div className="mx-auto max-w-[90%] break-words text-center text-[12px] text-muted-foreground">
      {message.body}
    </div>
  );
}

/** Under "Start your first recording" in the empty Lounge (N273 item 2,
 *  signed on its prototype). How long the first Take takes, not a number
 *  about the speaker, so it lives outside FLOW_COPY's no-digits rule, as the
 *  wait's percent does (Never 1, founder 2026-10-19). */
const FIRST_TAKE_TIME = "About 2 minutes to record. Your feedback comes about a minute later.";

/** The preceding recorded project for a general chat offer without coordinates. */
function restingTake(messages: readonly LoungeMessage[]): { arcId: string } | null {
  const summary = messages.findLast((message) => message.kind === "recording_summary");
  const arcId = summary ? projectIdOf(summary) : null;
  return arcId ? { arcId } : null;
}

function LoungeEmptyState({ hidden }: { hidden: boolean }) {
  // WILL SAYS HELLO FIRST (founder 2026-10-29, N273 item 2, on its
  // prototype). The empty Lounge opens with N270's signed hello and one quiet
  // line on how long the first Take takes; "Start your first recording" is
  // the shared composer's mic (N667). With the plan
  // (the-plan.md B1) its questions come first, so all of it waits while the
  // plan is read and stays away while it asks.
  if (hidden) return null;
  return (
    <div className="flex flex-1 flex-col justify-end gap-3.5">
      <div className="mr-auto max-w-[88%] whitespace-pre-wrap break-words rounded-[16px] bg-muted px-3 py-2 text-left text-[15px] leading-[1.45] text-foreground">
        {FLOW_COPY.firstTakeHello}
      </div>
      <p className="mx-auto max-w-[18rem] text-center text-[13px] leading-normal text-muted-foreground">
        {FIRST_TAKE_TIME}
      </p>
    </div>
  );
}

/** The project whose review waits in the thread: the newest walk step's,
 *  unless it is the review's end or its closing summary (the summary is the
 *  last step: seen, the review is finished). Null: nothing to continue. */
/** The next Take has begun: its sharing question or its recording. */
function movedOn(m: LoungeMessage): boolean {
  return m.kind === "recording_summary" || (m.kind === "walk_step" && m.metadata?.step === "share");
}

export function continueReviewArc(items: readonly ThreadItem[]): string | null {
  for (let i = items.length - 1; i >= 0; i -= 1) {
    const item = items[i];
    if (item.kind !== "message") continue;
    if (item.message.metadata?.summary === true) return null;
    // The speaker moved on to the next Take (its sharing question, or its
    // recording): the older review is over, finished or not.
    if (movedOn(item.message)) return null;
    if (item.message.kind !== "walk_step") continue;
    const meta = item.message.metadata ?? {};
    if (meta.coach_update === true) continue;
    if (meta.step === "end") return null;
    const arc = typeof meta.arc_id === "string" ? meta.arc_id : null;
    // A step written after this Take's end (its review reached the Ideal
    // Text already): nothing to continue (founder 2026-10-14).
    return arc && !reviewEnded(items.slice(0, i), meta.take_session_id) ? arc : null;
  }
  return null;
}

function reviewEnded(items: readonly ThreadItem[], take: unknown): boolean {
  for (let i = items.length - 1; i >= 0; i -= 1) {
    const m = items[i].message;
    if (movedOn(m)) return false;
    if (m.kind === "walk_step" && m.metadata?.step === "end" && m.metadata?.take_session_id === take) return true;
  }
  return false;
}

/** The step the review `arc` waits on (lock 2026-10-12, section 1, the
 *  orange outline): its newest step, while that is the app's or the
 *  coach's. Null: none. */
export function waitingStepId(items: readonly ThreadItem[], arc: string | null): string | null {
  if (!arc) return null;
  for (let i = items.length - 1; i >= 0; i -= 1) {
    const m = items[i].message;
    const meta = m.metadata ?? {};
    if (movedOn(m)) return null;
    // "Your words it is." waits on nothing: the Clearer version above it does.
    if (m.kind !== "walk_step" || meta.coach_update === true || walkAnswerRow(m)) continue;
    return m.role === "bot" && meta.arc_id === arc ? m.client_id : null;
  }
  return null;
}

/** The Take of an older review, once the thread holds a newer Take of the
 *  same project (lock 2026-10-12, section 2.3: "🔒 Take N"); null for the
 *  newest Take or one whose number is not known. The numbers come from the
 *  review steps and the summaries. */
export function olderTakeOf(items: readonly ThreadItem[]): (meta?: Record<string, unknown> | null) => number | null {
  const of = new Map<string, number>();
  const newest = new Map<string, number>();
  for (const { message } of items) {
    const m = message.metadata ?? {};
    if (typeof m.take_index !== "number" || typeof m.take_session_id !== "string" || typeof m.arc_id !== "string") continue;
    of.set(m.take_session_id, m.take_index);
    newest.set(m.arc_id, Math.max(newest.get(m.arc_id) ?? 0, m.take_index));
  }
  return (meta) => {
    const n = typeof meta?.take_session_id === "string" ? of.get(meta.take_session_id) : undefined;
    const last = typeof meta?.arc_id === "string" ? newest.get(meta.arc_id) : undefined;
    return n !== undefined && last !== undefined && n < last ? n : null;
  };
}

const SEEN_UPDATES = "lounge-coach-updates-seen";

/** The coach updates this browser has opened (their orange outline goes). */
function readSeenUpdates(): ReadonlySet<string> {
  try {
    const list: unknown = JSON.parse(window.localStorage.getItem(SEEN_UPDATES) ?? "[]");
    return new Set(Array.isArray(list) ? list.filter((x): x is string => typeof x === "string") : []);
  } catch {
    return new Set();
  }
}

function keepSeenUpdate(message: LoungeMessage): (seen: ReadonlySet<string>) => ReadonlySet<string> {
  const id = message.client_id;
  return (seen) => {
    // The coach's word is new by the server's word, not this list (N80).
    if (seen.has(id) || isCoachBubble(message)) return seen;
    const next = new Set([...seen, id]);
    try {
      window.localStorage.setItem(SEEN_UPDATES, JSON.stringify([...next].slice(-200)));
    } catch {
      // Not kept: it shows as new again next time.
    }
    return next;
  };
}

/** The coach's word for a Take in the chat: the "Later · from your coach"
 *  bubble, or the walk's own copy of it (founder 2026-10-19, N80). */
function isCoachBubble(m: LoungeMessage): boolean {
  const meta = m.metadata ?? {};
  return m.kind === "walk_step" && meta.step === "coachnote" && meta.author === "coach";
}

/** A coach's word bubble carries its word's Take, so the coach's door can
 *  bring the chat to it (WIL-93, useCoachBubbleFocus). */
function coachBubbleMark(m: LoungeMessage): Record<string, string> {
  return isCoachBubble(m) ? { [COACH_BUBBLE_ATTR]: String(wordTakeOf(m) ?? "") } : {};
}

/** The Take a coach bubble's word is of: the walk's copy of an earlier
 *  Take's word names it apart (as the server reads it). */
function wordTakeOf(m: LoungeMessage): unknown {
  return m.metadata?.coach_take_session_id ?? m.metadata?.take_session_id;
}

/** A coach bubble as it was read, under its word's Take: a version the
 *  server sends again (moved to the bottom with what is saved now) is
 *  another. */
const coachBubbleKey = (m: LoungeMessage) => `${String(wordTakeOf(m))}\u0000${m.client_id}|${m.client_created_at}`;

/** The watched-here marks a server read has caught up with: a coach bubble
 *  of that Take read as `unseen: false` (S3), so the next change of the
 *  word rings again. The same set when there are none. */
function caughtUp(watched: ReadonlySet<string>, messages: readonly LoungeMessage[]): ReadonlySet<string> {
  const read = new Set(messages.filter((m) => isCoachBubble(m) && m.metadata?.unseen === false).map((m) => `${String(wordTakeOf(m))}\u0000`));
  if (read.size === 0) return watched;
  const left = [...watched].filter((k) => ![...read].some((take) => k.startsWith(take)));
  return left.length === watched.size ? watched : new Set(left);
}

/** THE COACH'S WORD IN THE CHAT (founder 2026-10-19, N80; 2026-10-20, N89:
 *  one mechanism).
 *
 *  `waits`: a coach bubble rings while the server marks it new
 *  (metadata.unseen), so a word watched in WhatsApp's in-app browser or on
 *  another device is not new here (D4), and a changed word or video is new
 *  again (D7). Watched on this page (Continue on the coach's step in the
 *  walk) its bubbles stop at once, until a server read says the Take's
 *  word is not new: from then on the server's word rules again, so a later
 *  change rings. The walk's own copy, appended here without the server's
 *  mark, rings while the review waits on it (`other`), so ✕ on Step 0
 *  keeps it. Any other bubble keeps `other`.
 *
 *  The tap is every bubble's (`bubbleTap`): the "Later · from your coach"
 *  bubble and the walk's own copy open the Take's walk at the coach's place,
 *  Step 0 for a general word and the moment's step for a word on a moment
 *  (founder 2026-10-20: "THE SAME MECHANISM"). The word alone in its own
 *  lens with "Close" (N80, D8) is history. */
export function useCoachUpdates(messages: readonly LoungeMessage[]): {
  waits: (m: LoungeMessage, other: boolean) => boolean;
} {
  const [watched, setWatched] = useState<ReadonlySet<string>>(() => new Set());
  const messagesRef = useRef(messages);
  messagesRef.current = messages;
  useEffect(
    () =>
      onTakeWordWatched((take) => {
        const keys = messagesRef.current.filter((m) => isCoachBubble(m) && wordTakeOf(m) === take).map(coachBubbleKey);
        setWatched((w) => new Set([...w, ...keys]));
      }),
    [],
  );
  useEffect(() => setWatched((w) => caughtUp(w, messages)), [messages]);
  const waits = useCallback(
    (m: LoungeMessage, other: boolean) =>
      isCoachBubble(m) ? (m.metadata?.unseen === true || other) && !watched.has(coachBubbleKey(m)) : other,
    [watched],
  );
  return { waits };
}

/** The Lounge's one wait under the thread (B8): a reply being written, or
 *  the walk's summary and the chain after it. */
function ThreadDots({ thinking, writing, processingVoice }: {
  thinking: boolean; writing: boolean; processingVoice: boolean;
}) {
  if (processingVoice) return <ChatRecordingStatus />;
  return thinking || writing ? <TypingDots /> : null;
}



/** The Take's summary and, since N89, its closing message (since N294 the
 *  goodbye, "Good job. See you next time."): both drawn as the plain
 *  bubble. */
function isSummaryLike(meta: Record<string, unknown> | null | undefined): boolean {
  return meta?.summary === true || meta?.next_take === true;
}

/** The thread's messages, in the order the chat has them. */
function drawnOf(items: readonly ThreadItem[]): LoungeMessage[] {
  return items.map((item) => item.message);
}

const takeIdOf = (m: LoungeMessage): string | null =>
  typeof m.metadata?.take_session_id === "string" ? m.metadata.take_session_id : null;

/** Whether the chat draws a message (founder 2026-10-26, N192): of a Take's
 *  walk, only its Feedback walk (at its first step), its Ideal Text card and
 *  the coach's "Later" bubble (B3); the summary is the walk's last step
 *  (D4), except for a Take of the chain's first form, with no closing
 *  message. */
function chatShows(m: LoungeMessage, walkAt: ReadonlyMap<string, ChatWalk>, closing: ReadonlySet<unknown>): boolean {
  if (m.kind === "walk_step") return chatDrawsStep(m) || walkAt.has(m.client_id);
  if (m.metadata?.summary === true) return !closing.has(m.metadata.take_session_id);
  return true;
}

/** Each Take's summary as written, for Will's reading of the screen: it is
 *  inside the Feedback walk now (N192). */
function summaryByTake(messages: readonly LoungeMessage[]): Map<string, string> {
  const out = new Map<string, string>();
  for (const m of messages) {
    const take = takeIdOf(m);
    if (m.metadata?.summary === true && take && m.body.trim()) out.set(take, m.body.trim());
  }
  return out;
}

/** The Takes whose closing message is in the thread. */
function closingTakesOf(messages: readonly LoungeMessage[]): ReadonlySet<unknown> {
  return new Set(messages.filter((m) => m.metadata?.next_take === true).map((m) => m.metadata?.take_session_id));
}

/** A Take's walk in the chat (founder 2026-10-26, N192, B3, B10): one grey
 *  bubble, "Feedback walk", and under it the walk's date, with "Edited"
 *  before it once something in the walk changed (B13) and "🔒 Take N" for
 *  an older Take, and the › that opens the walk. While a step in it waits it
 *  wears the orange outline, a full 2px stroke (`data-outlined`).
 *  A tap opens the Take's whole walk: an older Take's read only; live on
 *  what waits while the review waits; on the coach's word while the walk's
 *  own copy of it is not yet seen (C1); else standing on its newest step.
 *  It is as wide as the Take's Ideal Text card, which sits right under it
 *  once the walk is done, one pair (founder 2026-10-26, N202): their left
 *  corners are drawn in where they meet (`data-paired`, globals.css). */
function FeedbackWalkBubble({
  walk,
  older,
  waits,
  live,
  paired,
  onOpened,
  onOpenIdealText,
}: {
  walk: ChatWalk;
  /** An older Take's number: its walk is history, read only. */
  older: number | null;
  /** Its steps that wait (the outline); a tap marks them seen. */
  waits: LoungeMessage[];
  /** The project whose review waits; null: none. */
  live: string | null;
  /** The Take's Ideal Text card is drawn right under it (N202). */
  paired: boolean;
  onOpened: (seen: LoungeMessage[]) => void;
  onOpenIdealText: (arcId: string, mode?: IdealTextLaunchMode, at?: WalkStepTarget | null) => void;
}) {
  const waiting = waits.length > 0;
  const coach = walk.coachCopies[0];
  const date = reportDateLabel(walk.date);
  const open = () => {
    onOpened(waits);
    if (!walk.arcId) return;
    if (older !== null) {
      onOpenIdealText(walk.arcId, "review", { take: walk.take });
      return;
    }
    onOpenIdealText(walk.arcId, "review", feedbackWalkDoor(walk, waits, live));
  };
  return (
    <div data-row="app" className="mr-auto flex w-[80%] max-w-sm">
      <button
        type="button"
        data-bubble=""
        data-feedback-walk={walk.take}
        data-outlined={waiting ? "" : undefined}
        data-paired={paired ? "" : undefined}
        {...(coach ? { [COACH_BUBBLE_ATTR]: String(wordTakeOf(coach) ?? "") } : {})}
        onClick={open}
        onPointerDown={() => warmIdealTextOpen(walk.arcId)}
        className={`relative flex min-w-0 flex-1 flex-col rounded-[16px] bg-muted text-left text-[15px] leading-[1.45] text-foreground ${waiting ? "border-2 border-primary py-[6px] pl-[10px] pr-[28px]" : "py-2 pl-3 pr-[30px]"}`}
      >
        <span>{WALK_COPY.feedbackWalk}</span>
        <span className="mt-0.5 flex items-baseline gap-2.5 text-[11.5px] leading-[1.3] text-muted-foreground">
          {older !== null ? <span>{`🔒 ${CHUNK_SHEET_COPY.historyTake} ${older}`}</span> : null}
          <span className="ml-auto whitespace-nowrap">
            {[walk.edited ? WALK_COPY.edited : null, date].filter(Boolean).join(" ")}
          </span>
        </span>
        <span aria-hidden="true" className="absolute right-[11px] top-1/2 -translate-y-1/2 text-[20px] text-muted-foreground">
          ›
        </span>
      </button>
    </div>
  );
}

/** One step of a review, lens off (founder lock 2026-10-12, section 1): the
 *  speaker's orange on the right, the app's and the coach's light grey on
 *  the left, with no picture beside any bubble (backend N301); 15px text,
 *  16px corners. A tap turns the lens back on. */
export function WalkStepBubble({
  message,
  card,
  latest = false,
  edited = false,
  newWords,
  waiting = false,
  lockedTake = null,
  onOpened,
  onOpenIdealText,
  onOpenPastIdealText,
}: {
  message: LoungeMessage;
  /** An older Take's Ideal Text card opens that Take's words (backend N375). */
  onOpenPastIdealText?: (arcId: string, past: IdealTextPast) => void;
  /** The review's end: its Ideal Text card's words; null otherwise. */
  card: { title: string; take: number | null } | null;
  /** The project's newest Ideal Text card: it carries the coach's "new" dot. */
  latest?: boolean;
  /** Helper words picked again since (B13): "Edited" at their end. */
  edited?: boolean;
  /** A clearer version posted before its new words were stored: worked
   *  out from the speaker's words above it. */
  newWords?: ClearerPiece[];
  /** The step still waits, or a coach update not yet opened: the orange outline. */
  waiting?: boolean;
  /** An older Take's step, its number: history, with no ›. */
  lockedTake?: number | null;
  /** An older Take's bubble tapped: that Take's review, read only. */
  onOpened?: () => void;
  onOpenIdealText?: (arcId: string, mode?: IdealTextLaunchMode, at?: WalkStepTarget | null) => void;
}) {
  const meta = message.metadata ?? {};
  const arc = typeof meta.arc_id === "string" ? meta.arc_id : null;
  if (meta.step === "end") {
    return arc && card ? (
      <WalkEndCard meta={meta} arc={arc} card={card} latest={latest} onOpenIdealText={onOpenIdealText} onOpenPastIdealText={onOpenPastIdealText} />
    ) : null;
  }
  const clip = walkClipOf(meta.clip);
  if (!message.body.trim() && !clip) return null;
  const mine = message.role === "user";
  // One mechanism (N89): a coach bubble opens the walk at the coach's place
  // like any other bubble opens its step.
  const open = bubbleTap(meta, lockedTake, onOpenIdealText, onOpened);
  // A press starts the Ideal Text's read before the tap lands.
  const warm = open ? () => warmIdealTextOpen(arc) : undefined;
  const hint = helpersHint(meta, lockedTake);
  const label = chatLabelOf(meta);
  const ai = clip || mine ? null : aiVoiceOfMeta(meta);
  return (
    <>
      {label ? <div className="self-center pt-1.5 text-[11.5px] text-muted-foreground">{label}</div> : null}
      {ai ? (
        <LoungeAiVoiceBubble
          body={message.body}
          practiceId={ai.practiceId}
          then={ai.then}
          fallback={ai.fallback}
          seed={message.client_id}
          avatar={null}
          onOpen={open}
        />
      ) : clip ? (
        <ClipBubble clip={clip} seed={message.client_id} caption={message.body.trim() || null} onOpen={open} />
      ) : mine ? (
        <div data-row="me" className="flex justify-end">
          <button
            type="button"
            data-walk-step-bubble
            onClick={open}
            onPointerDown={warm}
            data-bubble=""
            className="max-w-[85%] whitespace-pre-wrap break-words rounded-[16px] bg-primary px-3 py-2 text-left text-[15px] leading-[1.45] text-primary-foreground"
          >
            {message.body}
            {edited ? <span className="ml-2 whitespace-nowrap text-[11.5px] text-primary-foreground/80">{WALK_COPY.edited}</span> : null}
          </button>
        </div>
      ) : (
        <AppStepBubble message={message} newWords={newWords} open={open} warm={warm} hint={hint} waiting={waiting && open !== undefined} />
      )}
    </>
  );
}


/** A review's end: its Ideal Text card. The newest opens the page; an
 *  older Take's opens that Take's words (backend N375). */
function WalkEndCard({
  meta,
  arc,
  card,
  latest,
  onOpenIdealText,
  onOpenPastIdealText,
}: {
  meta: Record<string, unknown>;
  arc: string;
  card: { title: string; take: number | null };
  latest: boolean;
  onOpenIdealText?: (arcId: string, mode?: IdealTextLaunchMode) => void;
  onOpenPastIdealText?: (arcId: string, past: IdealTextPast) => void;
}) {
  // The project's first slide on the card; no `deck` from the server keeps the plain tile.
  const deck = meta.deck && typeof meta.deck === "object" ? (meta.deck as { presentation_ref?: unknown }) : null;
  const slideRef = deck ? (typeof deck.presentation_ref === "string" ? deck.presentation_ref : null) : undefined;
  const take = card.take;
  const open =
    !latest && take !== null && onOpenPastIdealText
      ? () => onOpenPastIdealText(arc, { by: "take", n: take, title: card.title })
      : () => onOpenIdealText?.(arc);
  return (
    <IdealTextCard title={card.title} version={take} slideRef={slideRef} arcId={arc} latest={latest} onOpen={open} onOpenFeedback={() => onOpenIdealText?.(arc, "feedback")} />
  );
}

/** What a step's tap opens: that Take's step, found by its paragraph,
 *  answered or not. An older Take's steps are history, with no ›
 *  (prototype v31); an old judging bubble opens Other speakers afresh
 *  (founder 2026-10-13). Sharing opens the sharing step. */
/** What a tap on a step's bubble does: its step, or for an older Take,
 *  that Take's feedback in its project chat (backend N691 item 1). None
 *  without a way to open. */
function bubbleTap(
  meta: Record<string, unknown>,
  lockedTake: number | null,
  onOpenIdealText?: (arcId: string, mode?: IdealTextLaunchMode, at?: WalkStepTarget | null) => void,
  onOpened?: () => void,
): (() => void) | undefined {
  const arc = typeof meta.arc_id === "string" ? meta.arc_id : null;
  if (!arc || !onOpenIdealText) return undefined;
  const session = typeof meta.take_session_id === "string" ? meta.take_session_id : null;
  const older = lockedTake !== null && session ? () => onOpenIdealText(arc, "review", { take: session }) : undefined;
  return stepTap(meta, arc, lockedTake, onOpenIdealText, onOpened) ?? older;
}

function stepTap(
  meta: Record<string, unknown>,
  arc: string,
  lockedTake: number | null,
  onOpenIdealText?: (arcId: string, mode?: IdealTextLaunchMode, at?: WalkStepTarget | null) => void,
  onOpened?: () => void,
): (() => void) | undefined {
  const step = typeof meta.step === "string" ? meta.step : null;
  const free = step === "others";
  if (lockedTake !== null && !free) return undefined;
  if (step === "share") return () => onOpenIdealText?.(arc, "share");
  const door = doorOf(meta);
  const target: WalkStepTarget | null = door && free ? { ...door, take: null } : door;
  return () => {
    onOpened?.();
    onOpenIdealText?.(arc, "review", target);
  };
}

/** The helper words' hint: "Tap the words", or "🔒 Take N" once a newer
 *  Take exists (lock 2026-10-12, section 2.3). */
function helpersHint(meta: Record<string, unknown>, lockedTake: number | null): string | undefined {
  if (meta.step !== "helpers") return undefined;
  return lockedTake !== null ? `🔒 Take ${lockedTake}` : CHUNK_SHEET_COPY.cardTapWords;
}

/** The app's or the coach's step in the chat: light grey on the left; the
 *  exercise's video as a thumb under its first line (prototype v31
 *  `vthumb`, the lens plays it), and the small hint line under it. */
function AppStepBubble({
  message,
  newWords,
  open,
  warm,
  hint: shownHint,
  waiting = false,
}: {
  message: LoungeMessage;
  newWords?: ClearerPiece[];
  open?: () => void;
  warm?: () => void;
  hint?: string;
  waiting?: boolean;
}) {
  const meta = message.metadata ?? {};
  const hint = shownHint ?? (typeof meta.hint === "string" ? meta.hint : null);
  const fresh = freshWordsOf(meta.new_words ?? newWords, message.body);
  const video = typeof meta.video === "string" && meta.video ? meta.video : null;
  const nl = message.body.indexOf("\n");
  const cut = video ? (nl >= 0 ? nl : message.body.length) : -1;
  return (
    <div data-row="app" className="mr-auto flex max-w-[88%] items-end gap-1.5">
      <button
        type="button"
        data-bubble=""
        data-walk-step-bubble
        {...coachBubbleMark(message)}
        onClick={open}
        onPointerDown={warm}
        data-outlined={waiting ? "" : undefined}
        className={`relative whitespace-pre-wrap break-words rounded-[16px] bg-muted text-left text-[15px] leading-[1.45] text-foreground ${outlinePad(waiting, open !== undefined)}`}
      >
        {cut > 0 ? (
          <>
            {message.body.slice(0, cut)}
            <ExerciseThumb src={video as string} />
            {message.body.slice(cut + 1)}
          </>
        ) : fresh ? (
          <>
            {fresh.head}
            {fresh.pieces.map((p, i) => (
              <span key={i} className={p.fresh ? "text-primary" : undefined}>
                {p.text}
              </span>
            ))}
          </>
        ) : (
          message.body
        )}
        {hint ? <span className="mt-[3px] block text-[12.5px] text-muted-foreground">{hint}</span> : null}
        {meta.edited === true ? (
          <span className="mt-[3px] block text-right text-[11.5px] text-muted-foreground">{WALK_COPY.edited}</span>
        ) : null}
        {open ? (
          <span aria-hidden="true" className="absolute right-[11px] top-1/2 -translate-y-1/2 text-[20px] text-muted-foreground">
            ›
          </span>
        ) : null}
      </button>
    </div>
  );
}

/** An outlined bubble's padding: the orange outline is a 2px border (N192:
 *  "well visible and not cut"), the padding taking the 2px back so nothing
 *  moves; with › the right side keeps its room. */
function outlinePad(outlined: boolean, arrow: boolean): string {
  if (outlined) return `border-2 border-primary py-[6px] pl-[10px] ${arrow ? "pr-[28px]" : "pr-[10px]"}`;
  return `py-2 pl-3 ${arrow ? "pr-[30px]" : "pr-3"}`;
}

/** A clearer version's last line as its pieces, the words that arrive
 *  orange (prototype v31 `.new em`); null when the bubble has none or its
 *  words are not the pieces'. */
function freshWordsOf(value: unknown, body: string): { head: string; pieces: { text: string; fresh?: boolean }[] } | null {
  if (!Array.isArray(value)) return null;
  const pieces = value.filter(
    (p): p is { text: string; fresh?: boolean } => !!p && typeof p === "object" && typeof (p as { text?: unknown }).text === "string",
  );
  const head = body.slice(0, body.lastIndexOf("\n") + 1);
  return pieces.map((p) => p.text).join("").trim() === body.slice(head.length).trim() ? { head, pieces } : null;
}

type WalkChatClip = {
  src: string | null;
  start_ms: number | null;
  duration_ms: number | null;
  words: { text: string; cut?: boolean; bold?: boolean }[] | null;
};

/** The speaker's clip a walk step carries; null when none. */
function walkClipOf(value: unknown): WalkChatClip | null {
  if (!value || typeof value !== "object") return null;
  const c = value as Partial<WalkChatClip>;
  return {
    src: typeof c.src === "string" ? c.src : null,
    start_ms: typeof c.start_ms === "number" ? c.start_ms : null,
    duration_ms: typeof c.duration_ms === "number" ? c.duration_ms : null,
    words: Array.isArray(c.words) ? c.words : null,
  };
}

/** The line above a moment in the chat: the step's name as the walk's chat
 *  says it ("Slide 2"; founder 2026-10-20, WIL-89: the lens and the Lounge
 *  are the same thread, so no "moment 1 of 2" here either), or the judging's
 *  heading. */
export function chatLabelOf(meta: Record<string, unknown>): string | null {
  if (typeof meta.heading === "string") return meta.heading;
  return typeof meta.slide_label === "string" ? meta.slide_label : null;
}

/** The speaker's own clip in the chat (prototype v31 `.lb.me.aud`): an
 *  orange bubble on the right, 78% wide, their words above the player where
 *  the feedback is about them, with what goes struck. */
function ClipBubble({
  clip,
  seed,
  caption = null,
  onOpen,
}: {
  clip: WalkChatClip;
  seed: string;
  caption?: string | null;
  /** A tap on the caption ("Practise N") opens its step in the lens. */
  onOpen?: () => void;
}) {
  return (
    <div data-row="me" className="flex justify-end">
      <div data-bubble="" className="flex w-[78%] flex-col gap-1 rounded-[16px] bg-primary px-3 py-2 text-primary-foreground">
        {caption && onOpen ? (
          <button type="button" data-walk-step-bubble onClick={onOpen} className="text-left text-[13px] leading-[1.45] opacity-[0.92]">
            {caption}
          </button>
        ) : caption ? (
          <span className="text-[13px] leading-[1.45] opacity-[0.92]">{caption}</span>
        ) : null}
        {clip.words ? (
          <span className="text-[13px] leading-[1.45] opacity-[0.92] [&_s]:text-white/[0.72] [&_s]:decoration-[1.5px]">
            {clip.words.map((p, i) => (p.cut ? <s key={i}>{p.text}</s> : p.bold ? <strong key={i}>{p.text}</strong> : <span key={i}>{p.text}</span>))}
          </span>
        ) : null}
        {clip.src ? (
          <SnippetWavePlayer
            seed={seed}
            src={clip.src}
            startOffsetMs={clip.start_ms}
            durationMs={clip.duration_ms}
            size="compact"
            tone="me"
            label={CHUNK_SHEET_COPY.pagerMoment}
          />
        ) : null}
      </div>
    </div>
  );
}

/** The exercise video's thumb in its chat bubble (prototype v31 `vthumb`):
 *  a dark 16:9 box with the play mark; the tap opens the lens, which plays. */
function ExerciseThumb({ src }: { src: string }) {
  // Its length in the corner ("0:42"), read from the video's metadata only.
  const [len, setLen] = useState<string | null>(null);
  return (
    <span aria-hidden="true" className="relative my-1.5 flex aspect-video w-[150px] items-center justify-center rounded-[10px] bg-gradient-to-br from-[#30343c] to-[#17191e]">
      <span className="relative h-[26px] w-[26px] rounded-full bg-white/[0.94]">
        <span className="absolute left-[10px] top-[7px] border-y-[6px] border-l-[9px] border-y-transparent border-l-[#121212]" />
      </span>
      {len ? <span className="absolute bottom-1 right-1.5 text-[10px] text-white">{len}</span> : null}
      <video
        src={src}
        preload="metadata"
        muted
        className="hidden"
        onLoadedMetadata={(e) => {
          const t = Math.round(e.currentTarget.duration);
          if (Number.isFinite(t) && t > 0) setLen(`${Math.floor(t / 60)}:${String(t % 60).padStart(2, "0")}`);
        }}
      />
    </span>
  );
}

/** Clearer-version bubbles posted before their new words were stored: the
 *  orange words, worked out from the speaker's words in the clip just above
 *  (the same moment of the same Take). */
export function clearerNewWordsOf(items: readonly ThreadItem[]): Map<string, ClearerPiece[]> {
  const out = new Map<string, ClearerPiece[]>();
  const said = new Map<string, string>();
  for (const item of items) {
    const m = item.message.metadata ?? {};
    if (item.message.kind !== "walk_step") continue;
    const key = `${String(m.take_session_id)}|${String(m.moment)}`;
    const words = walkClipOf(m.clip)?.words;
    if (words?.length) said.set(key, words.map((w) => w.text).join(""));
    if (m.step !== "clearer" || item.message.role === "user" || Array.isArray(m.new_words)) continue;
    const body = item.message.body;
    const after = clearerPieces(said.get(key), body.slice(body.lastIndexOf("\n") + 1))?.after;
    if (after) out.set(item.message.client_id, after);
  }
  return out;
}

/** The words on a review's Ideal Text card: the project's name (as its
 *  Ideal Text bubbles carry it) and the Take (its own, else as its summary
 *  carries it: the summary may still wait under the Take's ask). Null when
 *  the message is not a review's end or no name is known. */
export function reviewCardOf(
  message: LoungeMessage,
  items: readonly ThreadItem[],
): { title: string; take: number | null } | null {
  const meta = message.metadata ?? {};
  if (meta.step !== "end" || typeof meta.arc_id !== "string") return null;
  let title: string | null = null;
  let take: number | null = typeof meta.take_index === "number" ? meta.take_index : null;
  for (const item of items) {
    const m = item.kind === "message" ? item.message.metadata ?? {} : {};
    if (m.arc_id !== meta.arc_id) continue;
    if (typeof m.topic === "string" && m.topic.trim()) title = m.topic.trim();
    if (take === null && m.summary === true && m.take_session_id === meta.take_session_id && typeof m.take_index === "number") {
      take = m.take_index;
    }
  }
  return title ? { title, take } : null;
}

/** The closing summary after a review (founder lock 2026-10-12, section 3),
 *  and since N89 the goodbye after a Take: one plain bubble that is not
 *  tapped. Rewritten by a coach update, it keeps the earlier words one tap
 *  away; the update itself is its own bubble under "Later · from your
 *  coach". No bubble carries a button (founder 2026-10-31, N294 item 7):
 *  "Record Take N" stands alone under the chat. */
function SummaryBubble({ message }: { message: LoungeMessage }) {
  const [earlierOpen, setEarlierOpen] = useState(false);
  const meta = message.metadata ?? {};
  const earlier = meta.coach_update === true && typeof meta.earlier === "string" ? meta.earlier : null;
  return (
    <div data-summary-bubble data-row="app" className="mr-auto flex max-w-[88%] items-end gap-1.5">
      <div data-bubble="" className="whitespace-pre-wrap break-words rounded-[16px] bg-muted px-3 py-2 text-[15px] leading-[1.45] text-foreground">
        {message.body}
        {earlier ? (
          <>
            <button
              type="button"
              onClick={() => setEarlierOpen((open) => !open)}
              className="mt-2 block text-left text-[12.5px] text-muted-foreground underline underline-offset-[3px]"
            >
              {earlierOpen ? WALK_COPY.summaryHideEarlier : WALK_COPY.summarySeeEarlier}
            </button>
            {earlierOpen ? (
              <span className="mt-1.5 block border-t border-border pt-1.5 text-[13.5px] text-muted-foreground">
                {earlier}
              </span>
            ) : null}
          </>
        ) : null}
      </div>
    </div>
  );
}

/** A wheel anywhere on the page outside the thread scrolls the thread,
 *  unless it lands in an overlay, a dialog or a field that scrolls itself.
 *  Returns the cleanup. */
export function forwardMarginWheel(scroller: () => HTMLElement | null): () => void {
  const onWheel = (event: WheelEvent) => {
    const el = scroller();
    const target = event.target as Element | null;
    if (!el || !target || el.contains(target)) return;
    if (target.closest(".fixed, [role='dialog'], textarea, input, select")) return;
    el.scrollTop += event.deltaY;
  };
  window.addEventListener("wheel", onWheel, { passive: true });
  return () => window.removeEventListener("wheel", onWheel);
}
