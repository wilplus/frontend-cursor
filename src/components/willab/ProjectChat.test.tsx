// @vitest-environment jsdom
/*
STORY    As a speaker, I want recordings and feedback in the conversation
         where they happened, with the app's shared chat controls.
OUTCOME  O1  The Take's own conversation contains its Ideal Text.
         O2  The summary leads into the question; a held goodbye stays hidden
             and, once released, follows the answer instead of jumping ahead.
         O3  The project uses one chat top bar and the standard answer controls.
         O4  Recording another Take is offered by a chat reply. Ideal Text
             keeps its document tools and slide previews.
         O5  Starting practice from a review reply uses the selected Take's
             exact recorded range and closes back into its chat.
         O6  An accepted typed answer, its one pending state, and its matched
             reply or recoverable error are always brought into view.
         O7  A refused quick choice remains one durable user turn with one
             recoverable error instead of disappearing.
         O8  The mic sends a spoken answer in its own project chat.
         O9  Feedback opens on the Take's published strength. I can type
             my reaction without a separate action, then open the selected
             practice from the reply and read the same Take's Ideal Text.
         O10 The sayable line and its controls are visible in chat. Saving
             keeps one copy in this project and it can be opened again.
         O11 A new recording offer after Ideal Text survives earlier wording
             and a failed history refresh.
         O12 A reply can cite and explain a fragment from another Take without
             putting that fragment's identifier in the current Take's next request.
PROVES   O10 -> "saves the proposed wording and shows it when the project reopens"
         O1 -> "keeps the Ideal Text in the same chat scroll"
         O2 -> "keeps the contextual exchange in human order"
         O3 -> "uses the locked chat bar and answer controls"
         O4 -> "starts another Take only from the served chat action"
         O5 -> "practises the older Take on its recorded slide range"
         O6 -> "shows one pending turn, disables the composer, and scrolls the accepted send and reply into view"
         O7 -> "keeps a refused quick choice once with one recoverable error"
         O8 -> "shows an editable spoken draft and attaches playback only on send", "shows the sent text and plays the recording in this app session with a transcription-only response"
         O9 -> "opens feedback on the published strength and keeps practice on the selected fix"
         O11 -> "keeps a fresh recording offer after Ideal Text even when history refresh fails"
         O12 -> "shows the coach's cited fragment and keeps the next turn in the active Take"
WHY      Founder lock, 2026-11-16: no bespoke project-chat chrome or pills;
         release-blocking chat audit, 2026-11-17.
*/
import { act, createElement, type ComponentProps } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  newestStamp,
  stampLoungeMessage,
  type LoungeMessage,
  type LoungeMessageDraft,
} from "@/services/api/loungeMessages";
import type { TrainingArc } from "@/services/api/trainings";

const state = vi.hoisted(() => ({
  messages: [] as LoungeMessage[],
  reload: vi.fn(),
  appendRecoverable: vi.fn(),
  appendLocalOnly: vi.fn(),
  chatQuery: vi.fn(),
  willQuestion: vi.fn(),
  transcribeChatAnswer: vi.fn(),
  attachChatVoice: vi.fn(),
  startVoice: vi.fn(),
}));
const wordingApi = vi.hoisted(() => ({ save: vi.fn() }));
const momentApi = vi.hoisted(() => ({ clip: vi.fn() }));
vi.mock("@/services/api/coachMoment", async (load) => ({
  ...await load<typeof import("@/services/api/coachMoment")>(),
  fetchCoachMoment: momentApi.clip,
}));
vi.mock("@/services/api/coachWording", async (load) => ({
  ...await load<typeof import("@/services/api/coachWording")>(),
  saveCoachWording: wordingApi.save,
}));
const trainingApi = vi.hoisted(() => ({ fetchTrainings: vi.fn() }));
const reviewApi = vi.hoisted(() => ({
  idealText: vi.fn(),
  revisions: vi.fn(),
  notes: vi.fn(),
  runs: vi.fn(),
  steps: vi.fn(),
}));
vi.mock("@/services/api/idealText", async (load) => ({
  ...await load<typeof import("@/services/api/idealText")>(),
  fetchIdealText: reviewApi.idealText,
}));
vi.mock("@/services/api/blockVariants", async (load) => ({
  ...await load<typeof import("@/services/api/blockVariants")>(),
  fetchIdealTextRevisions: reviewApi.revisions,
}));
vi.mock("@/services/api/takeReview", () => ({
  readReviewCopy: reviewApi.notes,
  saveReviewCopy: vi.fn(),
  readReviewRuns: reviewApi.runs,
  readReviewSteps: reviewApi.steps,
}));
const arcSetup = vi.hoisted(() => ({
  fetch: vi.fn(async () => ({ slides: [{ title: "Opening", body: "" }, { title: "Close", body: "" }] })),
}));
vi.mock("./LoungeThreadContext", () => ({
  useLoungeThreadCtx: () => ({
    messages: state.messages,
    signedIn: true,
    appendRecoverable: state.appendRecoverable,
    appendLocalOnly: state.appendLocalOnly,
    reload: state.reload,
  }),
}));
vi.mock("@/services/api/chatQuery", () => ({
  postChatQuery: (...args: unknown[]) => state.chatQuery(...args),
}));
vi.mock("@/services/api/willQuestion", async (load) => ({
  ...await load<typeof import("@/services/api/willQuestion")>(),
  attachChatVoice: (...args: unknown[]) => state.attachChatVoice(...args),
  postWillQuestion: (...args: unknown[]) => state.willQuestion(...args),
  transcribeChatAnswer: (...args: unknown[]) => state.transcribeChatAnswer(...args),
}));
// The browser media capture is exercised by the shared composer. Deliver a
// stopped recording here to verify which request and conversation it reaches.
vi.mock("./chats/useComposerVoice", () => ({
  useComposerVoice: ({ label, enabled, onSend, prepareOnStop }: {
    label: string; enabled: boolean; prepareOnStop: boolean;
    onSend: (audio: Blob, duration: number, turn: string) => Promise<boolean>;
  }) => ({
    mic: enabled ? {
      label,
      start: () => { state.startVoice(prepareOnStop); void onSend(new Blob(["spoken"]), 1800, "d166833f-8b09-400c-8188-5a1306430011"); },
    } : undefined,
  }),
}));
vi.mock("./useBackDismiss", () => ({ useBackDismiss: () => undefined }));
vi.mock("./useUserId", () => ({ useUserId: () => "user-a" }));
vi.mock("@/services/api/arcSetup", () => ({
  fetchArcSetup: arcSetup.fetch,
}));
vi.mock("@/services/api/trainings", () => ({
  fetchTrainings: trainingApi.fetchTrainings,
}));
const fetchTakeTranscript = vi.hoisted(() => vi.fn(async (sessionId: string) => `raw transcript for ${sessionId}`));
vi.mock("@/services/api/takeTranscript", () => ({ fetchTakeTranscript }));
vi.mock("./IdealTextCard", () => ({
  default: ({ onOpen }: { onOpen: () => void }) =>
    createElement("button", { "data-testid": "ideal", onClick: onOpen }, "Ideal Text"),
}));
vi.mock("./IdealTextOverlay", () => ({
  default: ({
    initialMode,
    coachTake,
    reviewTake,
    reviewAt,
    reviewSlideRange,
    inlineDocument,
    requireFeedbackWalk,
    projectFlow,
    onClose,
  }: {
    initialMode?: string;
    coachTake?: string | null;
    reviewTake?: string | null;
    reviewAt?: { snippet?: string | null } | null;
    reviewSlideRange?: { startSlide: number; endSlide: number } | null;
    inlineDocument?: boolean;
    requireFeedbackWalk?: boolean;
    projectFlow?: boolean;
    onClose?: () => void;
  }) =>
    createElement(
      "div",
      {
        "data-testid": inlineDocument ? "inline-ideal" : "result",
        "data-chat-document": inlineDocument ? "" : undefined,
        "data-overlay-mode": initialMode ?? "notebook",
        "data-coach-take": coachTake ?? "",
        "data-review-take": reviewTake ?? "",
        "data-review-snippet": reviewAt?.snippet ?? "",
        "data-review-range": reviewSlideRange
          ? `${reviewSlideRange.startSlide}-${reviewSlideRange.endSlide}`
          : "",
        "data-require-feedback-walk": requireFeedbackWalk ? "true" : "false",
        "data-project-flow": projectFlow ? "true" : "false",
      },
      inlineDocument ? "The current opening."
        : createElement(
            "div",
            null,
            projectFlow ? createElement("i", { "data-project-flow": "true" }) : null,
            createElement("button", { onClick: onClose }, "Close"),
          ),
    ),
}));
import ProjectChat from "./ProjectChat";

const project: TrainingArc = {
  arcId: "arc-a",
  topic: "Board meeting",
  createdAt: null,
  takeCount: 1,
  takes: [{
    sessionId: "take-a",
    takeIndex: 1,
    createdAt: null,
    hasSlides: true,
    feedbackAvailable: true,
    recordedRange: { startSlide: 1, endSlide: 2 },
  }],
  batchVerified: false,
  idealReady: true,
  bestPresentationArcId: "arc-a",
  coverRef: null,
  deletion: null,
  archived: false,
};

let root: Root;
let host: HTMLDivElement;
let onRecord = vi.fn<(arcId: string) => void>();

beforeEach(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  state.messages = [];
  state.reload.mockReset().mockResolvedValue(undefined);
  state.chatQuery.mockReset().mockResolvedValue({ answer: "That gives us a clear direction." });
  state.willQuestion.mockReset().mockResolvedValue(true);
  state.transcribeChatAnswer.mockReset().mockResolvedValue({ text: "That was my intention.", durationMs: 1800, receipt: "voice-receipt" });
  state.attachChatVoice.mockReset().mockResolvedValue(true);
  state.startVoice.mockClear();
  state.appendRecoverable.mockReset().mockImplementation((draft: LoungeMessageDraft) => {
    const stamped = stampLoungeMessage(draft, newestStamp(state.messages));
    state.messages = [...state.messages.filter((row) => row.client_id !== stamped.client_id), stamped];
    const stored = Promise.resolve(true);
    return { message: stamped, stored, retry: () => stored };
  });
  state.appendLocalOnly.mockReset().mockImplementation((draft: LoungeMessageDraft) => {
    const stamped = stampLoungeMessage(draft, newestStamp(state.messages));
    state.messages = [...state.messages, stamped];
    return stamped;
  });
  arcSetup.fetch.mockClear().mockResolvedValue({ slides: [{ title: "Opening", body: "" }, { title: "Close", body: "" }] });
  host = document.createElement("div");
  document.body.appendChild(host);
  root = createRoot(host);
  onRecord = vi.fn<(arcId: string) => void>();
  localStorage.clear();
  sessionStorage.clear();
  trainingApi.fetchTrainings.mockReset().mockResolvedValue(null);
  reviewApi.idealText.mockReset().mockResolvedValue({
    kind: "single", latestTakeSessionId: "take-a", ideal: { text: "The current opening.", keyMoments: [] },
    suggestions: [],
  });
  reviewApi.revisions.mockReset().mockResolvedValue({ kind: "ready", revisions: [{
    takeIndex: 1, revision: 1, text: "The current opening.", slides: [0], presentationRef: null, helperWords: [],
  }] });
  reviewApi.notes.mockReset().mockResolvedValue({ revision: 0, document: {} });
  reviewApi.runs.mockReset().mockResolvedValue({});
  reviewApi.steps.mockReset().mockResolvedValue([]);
  momentApi.clip.mockReset().mockResolvedValue(null);
});

afterEach(() => {
  act(() => root.unmount());
  host.remove();
});

function render(currentProject: TrainingArc = project, recordingInProgress = false, options?: Partial<ComponentProps<typeof ProjectChat>>): void {
  act(() => root.render(createElement(ProjectChat, {
    project: currentProject,
    onBack: vi.fn(),
    onRecord,
    recordingInProgress,
    ...options,
  })));
}

async function clickText(container: ParentNode, label: string) {
  const button = [...container.querySelectorAll("button")].find((item) => item.textContent?.trim() === label);
  expect(button).toBeDefined();
  await act(async () => button!.click());
}

async function openTake(sessionId: string) {
  const button = host.querySelector<HTMLButtonElement>(`[data-project-take="${sessionId}"] [data-take-review-message]`);
  expect(button).not.toBeNull();
  await act(async () => button!.click());
  return host.querySelector<HTMLElement>("[data-take-review]")!;
}

function message(
  id: string,
  body: string,
  role: "user" | "bot",
  metadata: Record<string, unknown>,
): LoungeMessage {
  return {
    client_id: id,
    client_created_at: `2026-11-16T00:00:${id.length.toString().padStart(2, "0")}.000Z`,
    role,
    kind: "text",
    body,
    metadata: { arc_id: "arc-a", take_session_id: "take-a", ...metadata },
  };
}

function before(first: Element, second: Element): boolean {
  return Boolean(first.compareDocumentPosition(second) & Node.DOCUMENT_POSITION_FOLLOWING);
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((yes, no) => {
    resolve = yes;
    reject = no;
  });
  return { promise, resolve, reject };
}

const flush = () => act(async () => {
  for (let index = 0; index < 12; index += 1) await Promise.resolve();
});

function enterAnswer(value: string): HTMLTextAreaElement {
  const field = host.querySelector('textarea[aria-label="Answer about this take"]') as HTMLTextAreaElement;
  expect(field).not.toBeNull();
  act(() => {
    Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value")!.set!.call(field, value);
    field.dispatchEvent(new Event("input", { bubbles: true }));
  });
  return field;
}

function submitAnswer(): void {
  const form = host.querySelector("[data-project-question-composer]") as HTMLFormElement;
  act(() => {
    form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
  });
}

function scrollMetrics(element: HTMLElement, height = 1_200): { setHeight: (next: number) => void } {
  let scrollHeight = height;
  Object.defineProperty(element, "scrollHeight", { configurable: true, get: () => scrollHeight });
  Object.defineProperty(element, "clientHeight", { configurable: true, get: () => 320 });
  return { setHeight: (next) => { scrollHeight = next; } };
}

describe("project conversation", () => {
  it("shows an editable spoken draft and attaches playback only on send", async () => {
    render({ ...project, takeCount: 0, takes: [] });
    await flush();
    act(() => (host.querySelector("[data-chat-mic]") as HTMLButtonElement).click());
    await flush();
    expect(state.startVoice).toHaveBeenCalledExactlyOnceWith(true);
    expect(state.transcribeChatAnswer).toHaveBeenCalledWith(expect.any(Blob), 1800, undefined, {
      turnId: "d166833f-8b09-400c-8188-5a1306430011", projectId: "arc-a", snippetId: undefined,
    });
    expect(host.querySelector("textarea")?.value).toBe("That was my intention.");
    expect(host.querySelector("audio")).toBeNull();
    expect(state.attachChatVoice).not.toHaveBeenCalled();
    expect(state.chatQuery).not.toHaveBeenCalled();

    enterAnswer("That was my main intention.");
    submitAnswer();
    await flush();
    expect(state.attachChatVoice).toHaveBeenCalledTimes(1);
    expect(state.chatQuery.mock.calls[0][0]).toMatchObject({
      clientId: "d166833f-8b09-400c-8188-5a1306430011",
      projectId: "arc-a", question: "That was my main intention.", presentationContext: { completed_takes: 0 },
    });
    const reply = host.querySelector('[data-project-message="d166833f-8b09-400c-8188-5a1306430011"]');
    expect(reply?.textContent).toContain("That was my main intention.");
    expect(reply?.querySelector("[data-walk-player]")).toBeTruthy();
    expect(onRecord).not.toHaveBeenCalled();
  });

  it("shows the sent text and plays the recording in this app session with a transcription-only response", async () => {
    const createObjectURL = vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:playable-voice-draft");
    state.transcribeChatAnswer.mockResolvedValueOnce({ text: "A line from the recording.", durationMs: 1800 });
    render({ ...project, takeCount: 0, takes: [] });
    await flush();
    act(() => host.querySelector<HTMLButtonElement>("[data-chat-mic]")!.click());
    await flush();

    expect(host.querySelector("textarea")?.value).toBe("A line from the recording.");
    expect(host.querySelector("audio")).toBeNull();
    expect(state.chatQuery).not.toHaveBeenCalled();
    submitAnswer();
    await flush();
    expect(state.chatQuery.mock.calls[0]?.[0].question).toBe("A line from the recording.");
    expect(state.attachChatVoice).not.toHaveBeenCalled();
    const sent = host.querySelector('[data-project-message="d166833f-8b09-400c-8188-5a1306430011"]');
    expect(sent?.textContent).toContain("A line from the recording.");
    expect(sent?.querySelector("audio")?.src).toBe("blob:playable-voice-draft");
    createObjectURL.mockRestore();
    enterAnswer("Another question.");
    submitAnswer();
    await flush();
    expect(state.chatQuery.mock.calls[1]?.[0].clientId).not.toBe(state.chatQuery.mock.calls[0]?.[0].clientId);
  });

  it("retries the same recording and cited passage without transcribing again", async () => {
    state.transcribeChatAnswer.mockResolvedValueOnce({ text: "I want the board to approve the plan.", durationMs: 1800, receipt: "voice-receipt" });
    state.chatQuery.mockRejectedValueOnce(new Error("offline")).mockResolvedValueOnce({
      answer: "The ending had more room.", persisted: true, persisted_client_id: "voice-reply",
    });
    state.messages = [message("clip-offer", "Listen to the ending, then say it again.", "bot", {
      live_take_feedback: true, snippet_id: "clip-a",
    })];
    render(project, false, { initialReview: { take: project.takes[0]!, focus: { step: "feedback" }, live: true } });
    await flush();
    act(() => host.querySelector<HTMLButtonElement>('button[title="Refer to this moment"]')!.click());
    act(() => (host.querySelector("[data-chat-mic]") as HTMLButtonElement).click());
    await flush();
    submitAnswer();
    await flush();
    const initial = state.chatQuery.mock.calls[0]![0];
    expect(initial).toMatchObject({
      voiceReceipt: "voice-receipt", sessionId: "take-a",
      presentationContext: { review_focus: { snippet_id: "clip-a" } },
    });
    await clickText(host, "Try again");
    expect(state.chatQuery.mock.calls[1]![0]).toMatchObject({
      voiceReceipt: initial.voiceReceipt, sessionId: initial.sessionId, clientId: initial.clientId,
      presentationContext: { review_focus: { snippet_id: "clip-a" } },
    });
    expect(state.transcribeChatAnswer).toHaveBeenCalledTimes(1);
    expect(state.attachChatVoice).toHaveBeenCalledTimes(2);
    expect(state.attachChatVoice.mock.calls[1]).toEqual(state.attachChatVoice.mock.calls[0]);
  });

  it("keeps earlier Polish turns above a newer recording and its feedback", async () => {
    state.messages = [
      { ...message("greeting", "Hej!", "user", { take_exchange: false }), client_created_at: "2026-11-24T12:20:00Z" },
      { ...message("question", "Nad czym chcesz teraz popracować?", "bot", { take_exchange: false }), client_created_at: "2026-11-24T12:20:02Z" },
      { ...message("answer", "nad moją prezką!", "user", { take_exchange: false }), client_created_at: "2026-11-24T12:20:10Z" },
      { ...message("repeated", "Nad czym chcesz teraz popracować?", "bot", { take_exchange: false }), client_created_at: "2026-11-24T12:20:12Z" },
      { ...message("newer", "I slowed down this time.", "user", { take_exchange: false }), client_created_at: "2026-11-24T12:22:00Z" },
    ];
    render({
      ...project, takeCount: 2,
      takes: [{ ...project.takes[0]!, createdAt: "2026-11-24T12:10:00Z" },
        { ...project.takes[0]!, sessionId: "take-b", takeIndex: 2, createdAt: "2026-11-24T12:21:00Z" }],
    });
    await flush();
    const lastOld = host.querySelector('[data-project-message="repeated"]')!;
    const take = host.querySelector('[data-project-take="take-b"]')!;
    const latest = host.querySelector('[data-project-message="newer"]')!;
    expect(before(lastOld, take)).toBe(true);
    expect(before(take, latest)).toBe(true);
    expect(take.textContent).toContain("Take 2");
  });

  it("opens feedback on the published strength and keeps practice on the selected fix", async () => {
    reviewApi.idealText.mockResolvedValue({
      kind: "single", latestTakeSessionId: "take-a", ideal: { text: "The current opening.", keyMoments: [] },
      suggestions: [{
        takeSessionId: "take-a", walkSlot: "weakest", bookmarkTier: "weak", snippetId: "fix",
        quote: "The next sentence runs together.", rewriteMove: "Give the end room.",
        evidence: { slideIndex: 1 }, practiceExercise: { title: "Land the final word" },
      }, {
        takeSessionId: "take-a", walkSlot: "strongest", highestMoment: true, bookmarkTier: "confident", snippetId: "strength",
        quote: "I want a clear decision today.", praiseLine: "The pause gives your request room.",
        evidence: { slideIndex: 0 },
      }, {
        takeSessionId: "another-take", walkSlot: "strongest", bookmarkTier: "confident", snippetId: "wrong-take",
        quote: "This is from another recording.", praiseLine: "This is from another recording.",
      }],
    });
    render();
    await flush();
    const review = await openTake("take-a");
    const feedback = review.querySelector('[data-review-section="feedback"]');
    expect(feedback?.textContent).toContain("The pause gives your request room.");
    expect(feedback?.textContent).toContain("I want a clear decision today.");
    expect(feedback?.textContent).not.toContain("The next sentence runs together.");
    expect(feedback?.textContent).not.toContain("another recording");
    expect(review.textContent).not.toContain("Land the final word");
    expect(review.querySelector('[data-review-section="ideal"]')?.textContent).toContain("The current opening.");

    state.chatQuery.mockResolvedValueOnce({
      answer: "Try the next sentence with its last words a little clearer.",
      persisted: true, persisted_client_id: "practice-offer",
      row_metadata: { take_session_id: "take-a", review_destination: { step: "practise" } },
    });
    enterAnswer("I liked that. What should I work on?");
    submitAnswer();
    await flush();
    expect(state.chatQuery.mock.calls[0][0]).toMatchObject({
      projectId: "arc-a", sessionId: "take-a",
      presentationContext: { review_focus: { step: "feedback", snippet_id: "strength", slide_index: 0 } },
    });
    const actions = host.querySelector('[data-take-message-actions="practice-offer"]')!;
    await clickText(actions, "Practise");
    expect(review.textContent).toContain("Land the final word");
    await clickText(review, "Try it");
    expect(review.querySelector('[data-testid="result"]')?.getAttribute("data-review-snippet")).toBe("fix");
  });

  it("saves the proposed wording and shows it when the project reopens", async () => {
    const words = "Jeśli dostaniemy zgodę, kto z was chciałby poprowadzić pilotaż?";
    const wording = { words, arc_id: "arc-a", take_session_id: "take-a" };
    state.messages = [
      message("proposal", "Zakończ jednym pytaniem.", "bot", { coach_wording: wording }),
      message("elsewhere", "Other project.", "bot", {
        coach_wording: { ...wording, words: "A different project's wording.", arc_id: "arc-b" },
      }),
    ];
    wordingApi.save.mockImplementationOnce(async () => {
      state.messages = [...state.messages, {
        ...message("saved-proposal", words, "bot", {
          coach_wording: wording, coach_wording_saved: true, wording_reply_id: "proposal",
        }),
        role: "system",
      }];
      return true;
    });

    render();
    await flush();
    await openTake("take-a");
    const offer = host.querySelector("[data-coach-wording]")!;
    expect(offer.closest("[data-bubble]")?.textContent).toContain("Zakończ jednym pytaniem.");
    expect(offer.textContent).toContain(words);
    expect(offer.textContent).toContain("Practise");
    expect(host.textContent).not.toContain("A different project's wording.");
    await clickText(offer, "Save wording");
    expect(wordingApi.save).toHaveBeenCalledWith("arc-a", "proposal");
    expect(offer.textContent).toContain("Saved wording");

    act(() => root.unmount());
    root = createRoot(host);
    render();
    await flush();
    await openTake("take-a");
    const saved = [...host.querySelectorAll("[data-coach-wording]")].find((node) => node.textContent?.includes("Saved wording"));
    expect(saved?.textContent).toContain(words);
    expect(host.querySelectorAll("[data-coach-wording]")).toHaveLength(1);
    expect(host.querySelector("[data-coach-wording]")?.textContent).not.toContain("Save wording");
  });

  it("reopens the selected Take and retries an anchored review question once after reload", async () => {
    const twoTakes = {
      ...project,
      takeCount: 2,
      takes: [...project.takes, { ...project.takes[0], sessionId: "take-b", takeIndex: 2 }],
      practiceCoverage: { practised: 2, total: 8, unit: "slides" as const },
    };
    reviewApi.notes.mockResolvedValue({ revision: 0, document: {} });
    reviewApi.runs.mockResolvedValue({ "take-a": [{ id: "run", at: "2026-11-23T10:00:00.000Z", kind: "tempo" }] });
    reviewApi.steps.mockResolvedValue([{
      id: "run", client_id: "older-attempt", client_created_at: "2026-11-23T10:00:00.000Z",
      role: "user", kind: "walk_step", body: "My earlier practice.",
      metadata: { arc_id: "arc-a", take_session_id: "take-a", step: "tempo:try", path: [0, 0.5, 1] },
    }, {
      id: "unrelated", client_id: "other-attempt", client_created_at: "2026-11-23T10:00:01.000Z",
      role: "user", kind: "walk_step", body: "Somebody else's practice.",
      metadata: { arc_id: "arc-b", take_session_id: "take-a", step: "try:close" },
    }]);
    reviewApi.revisions.mockResolvedValue({ kind: "ready", revisions: [{
      takeIndex: 1, revision: 1, text: "An early decision.", slides: [0], presentationRef: null,
      helperWords: [{ slideIndex: 0, phrases: ["decision"] }],
    }] });
    reviewApi.idealText.mockResolvedValue({
      kind: "single", latestTakeSessionId: "take-b", ideal: { text: "The newest words.", keyMoments: [] },
      suggestions: [{
        takeSessionId: "take-a", walkSlot: "weakest", snippetId: "segment-a",
        quote: "The older moment.", rewriteMove: "Pause here.", evidence: { slideIndex: 0 },
      }],
    });
    state.chatQuery.mockRejectedValueOnce(new Error("connection dropped")).mockResolvedValueOnce({
      answer: "Pause before the last sentence.", persisted: true, persisted_client_id: "matched-answer",
      row_metadata: { arc_id: "arc-a", take_session_id: "take-a", review_focus: { step: "ideal", slide_index: 0 } },
    });
    render(twoTakes);
    await flush();
    const entry = host.querySelector('[data-project-take="take-a"]')!;
    expect(entry.querySelectorAll("[data-take-review-message]")).toHaveLength(1);
    expect(entry.querySelector("[data-take-review]")).toBeNull();
    expect(host.querySelector("[data-chat-mic]")).not.toBeNull();
    let review = await openTake("take-a");
    expect(reviewApi.steps).toHaveBeenCalledWith("arc-a", "take-a", true, undefined);
    expect(review.textContent).toContain("My earlier practice.");
    expect(review.textContent).not.toContain("Somebody else's practice.");
    expect(review.querySelector("nav")).toBeNull();
    const script = review.querySelector("[data-chat-document]")!;
    expect(script.textContent).toContain("An early decision.");
    expect(script.textContent).not.toContain("The newest words.");
    expect(before(review.querySelector('[data-project-message="older-attempt"]') ?? review.querySelector('[data-row="me"]')!, script)).toBe(true);
    await clickText(review, "The older moment.");
    enterAnswer("How should I open this slide?");
    submitAnswer();
    await flush();
    const sent = state.chatQuery.mock.calls[0][0];
    expect(sent).toMatchObject({
      projectId: "arc-a", sessionId: "take-a", historySource: "screen",
      presentationContext: { review_focus: { step: "feedback", snippet_id: "segment-a", slide_index: 0 } },
    });

    act(() => root.unmount());
    root = createRoot(host);
    render(twoTakes);
    await flush();
    expect(host.querySelector("[data-take-review]")).toBeNull();
    review = await openTake("take-a");
    expect(review.textContent).toContain("My earlier practice.");
    expect(review.textContent).toContain("An early decision.");
    const retry = review.querySelector<HTMLButtonElement>("[data-chat-turn-error] button")!;
    expect(retry).not.toBeNull();
    await act(async () => retry.click());
    expect(state.chatQuery.mock.calls[1][0]).toEqual(sent);
    expect(state.messages.filter((row) => row.client_id === sent.clientId)).toHaveLength(1);
    expect(state.messages.filter((row) => row.client_id === "matched-answer")).toHaveLength(1);
  });

  it("keeps contextual follow-ups available after the setup questions finish", async () => {
    state.chatQuery.mockResolvedValue({
      answer: "Try returning to the decision from your opening.",
      persisted: true, persisted_client_id: "reply-follow-up",
      row_metadata: { arc_id: "arc-a", take_session_id: "take-a", project_chat: true },
    });
    render();
    expect(host.querySelector("[data-chat-mic]")).not.toBeNull();
    enterAnswer("How should I finish this talk?");
    submitAnswer();
    await flush();
    expect(state.chatQuery).toHaveBeenCalledWith(expect.objectContaining({
      question: "How should I finish this talk?", projectId: "arc-a", sessionId: "take-a",
      presentationContext: expect.objectContaining({ take_exchange: false }),
    }));
    expect(host.textContent).toContain("Try returning to the decision from your opening.");
    expect(host.querySelector("[data-project-question-composer]")).not.toBeNull();
  });

  it("shows a saved chat reply under its message with the Take review closed", async () => {
    const scope = { project_chat: true, take_session_id: "take-a" };
    const clip = "https://media.example/moment.mp3";
    const demo = "https://media.example/coach.mp4";
    state.messages = [
      message("question", "How should I finish this talk?", "user", { ...scope, take_exchange: false }),
      message("answer", "Return to the decision from your opening.", "bot", {
        ...scope, reply_to_client_id: "question",
        clip: { src: clip, start_ms: 500, duration_ms: 2000 },
        video: demo,
        chat_artifact: { version: 1, title: "Speak the close", intervention: "Pause before the decision." },
      }),
      message("legacy-question", "What should I say first?", "user", scope),
      message("legacy-answer", "Lead with what the board needs to decide.", "bot", {
        ...scope, reply_to_client_id: "legacy-question",
      }),
    ];
    reviewApi.steps.mockResolvedValue(state.messages);
    render();
    expect(host.querySelector("[data-take-review]")).toBeNull();
    const bubble = host.querySelector('[data-project-message="answer"] [data-bubble]');
    expect(bubble?.textContent).toContain("Return to the decision from your opening.");
    expect(bubble?.textContent).toContain("Pause before the decision.");
    expect(bubble?.querySelector("audio")?.src).toBe(clip);
    expect(bubble?.querySelector("video")?.src).toBe(demo);
    expect(host.querySelector("[data-chat-artifact-preview]")).toBeNull();
    expect(host.querySelector('[data-project-message="legacy-answer"]')?.textContent)
      .toContain("Lead with what the board needs to decide.");
    const opened = await openTake("take-a");
    expect(opened.textContent).not.toContain("Return to the decision from your opening.");
    expect(opened.textContent).not.toContain("What should I say first?");
  });
  it("opens a Take review directly in the chat", async () => {
    render();
    expect(host.querySelector("[data-feedback-walk-card]")).toBeNull();
    const review = await openTake("take-a");
    expect(review.textContent).not.toContain("Almost");
    expect(review.querySelector("nav")).toBeNull();
    expect(review.querySelector('[data-review-section="ideal"]')?.textContent).toContain("The current opening.");
    expect(host.querySelector("[data-chat-mic]")?.getAttribute("aria-label")).toBe("Record your answer");
    expect(host.querySelector("[data-chat-input]")).not.toBeNull();
    expect(review.querySelector("[data-practice-decision]")).toBeNull();
    expect(review.textContent).not.toContain("Rehearse whole presentation");

  });

  it("opens the raw transcript for the exact project Take", async () => {
    render();
    act(() => (host.querySelector("[data-project-recording='take-a'] button") as HTMLButtonElement).click());
    expect(fetchTakeTranscript).toHaveBeenCalledWith("take-a", expect.any(Function));
    await act(async () => undefined);
    expect(host.querySelector('[role="dialog"]')).not.toBeNull();
    expect(host.textContent).toContain("Board meeting · Take 1");
    expect(host.textContent).toContain("raw transcript for take-a");
  });

  it("keeps the Ideal Text in the same chat scroll", async () => {
    render();
    const review = await openTake("take-a");
    expect(review.querySelector('[data-chat-document]')?.textContent).toBe("The current opening.");
    expect(host.querySelector('[data-project-question-composer]')).not.toBeNull();
    expect(host.querySelector('[data-testid="decision"]')).toBeNull();
  });

  it("reopens a saved Ideal Text offer right below its reply in the project chat", async () => {
    state.messages = [
      message("opening", "The opening gave your point room.", "bot", { live_take_feedback: true }),
      message("ideal-link", "You can read the full text here.", "bot", {
        take_exchange: false, review_destination: { step: "ideal" },
      }),
    ];
    render();
    await clickText(host, "Ideal text");
    await flush();
    const document = host.querySelector("[data-review-section=ideal]");
    expect(document?.textContent).toBe("The current opening.");
    expect(document?.closest("[data-project-take]")).toBeNull();
    expect(host.querySelector("[data-chat-input]")).not.toBeNull();
  });

  it("opens a fresh Ideal Text offer in the main conversation and keeps the next Take action there", async () => {
    state.chatQuery.mockResolvedValueOnce({
      answer: "Here’s your Ideal Text.", persisted: true, persisted_client_id: "fresh-ideal",
      row_metadata: { take_session_id: "take-a", review_destination: { step: "ideal" } },
    });
    render();
    enterAnswer("Show me my Ideal Text.");
    submitAnswer();
    await flush();
    expect(host.querySelector('[data-project-message="fresh-ideal"]')?.textContent).toBe("Here’s your Ideal Text.");
    const document = host.querySelector("[data-review-section=ideal]");
    expect(document?.textContent).toBe("The current opening.");
    expect(document?.closest("[data-project-take]")).toBeNull();

    state.chatQuery.mockResolvedValueOnce({
      answer: "Yes. Try it again.", persisted: true, persisted_client_id: "fresh-record",
      suggested_action: "record_again",
    });
    enterAnswer("Can I record again?");
    submitAnswer();
    await flush();
    expect(state.chatQuery.mock.calls[1]?.[0].presentationContext).toMatchObject({
      review_focus: { step: "ideal" }, take_exchange: false, live_take_feedback: true,
    });
    expect(host.querySelector('[data-project-message="fresh-record"]')?.textContent).toBe("Yes. Try it again.");
    expect(host.textContent).toContain("Record the next take");
  });

  it("practises the older Take on its recorded slide range", async () => {
    reviewApi.idealText.mockResolvedValue({
      kind: "single", latestTakeSessionId: "take-a", ideal: { text: "The current opening.", keyMoments: [] },
      suggestions: [{
        takeSessionId: "take-a", walkSlot: "weakest", bookmarkTier: "weak", snippetId: "fix",
        quote: "The next sentence runs together.", rewriteMove: "Give the end room.",
        evidence: { slideIndex: 1 }, practiceExercise: { title: "Land the final word" },
      }],
    });
    const twoTakes: TrainingArc = {
      ...project,
      takeCount: 2,
      takes: [
        ...project.takes,
        { ...project.takes[0]!, sessionId: "take-b", takeIndex: 2, recordedRange: { startSlide: 3, endSlide: 4 } },
      ],
    };
    state.messages = [message("start-practice", "Try this part once.", "bot", {
      take_exchange: false, review_destination: { step: "practise", snippet_id: "fix" },
    })];
    render(twoTakes);
    await clickText(host, "Practise");
    const review = host.querySelector<HTMLElement>("[data-take-review]")!;
    await clickText(review, "Try it");

    const practice = review.querySelector('[data-testid="result"]')!;
    expect(practice.getAttribute("data-overlay-mode")).toBe("review");
    expect(practice.getAttribute("data-review-take")).toBe("take-a");
    expect(practice.getAttribute("data-review-range")).toBe("1-2");
    expect(practice.getAttribute("data-review-snippet")).toBe("fix");
    expect(practice.getAttribute("data-require-feedback-walk")).toBe("true");

    await clickText(practice, "Close");
    await flush();
    expect(review.querySelector('[data-review-section="ideal"]')?.textContent).toContain("The current opening.");
    expect(review.querySelector('[data-testid="result"]')).toBeNull();
    expect(host.querySelector("[data-project-chat]")?.contains(review)).toBe(true);
  });

  it("starts another Take only from the served chat action", async () => {
    state.messages = [
      message("closing", "Record the next take in your own time.", "bot", { next_take: true, take_exchange: false }),
    ];
    state.chatQuery.mockResolvedValueOnce({
      answer: "Go ahead.", suggested_action: "record_again", persisted: true, persisted_client_id: "record-offer",
    });
    render();
    await flush();
    expect([...host.querySelectorAll("button")].some((button) => button.textContent?.includes("Record the next take"))).toBe(false);
    enterAnswer("Yes, I’m ready.");
    submitAnswer();
    await flush();
    expect(onRecord).not.toHaveBeenCalled();
    const offer = [...host.querySelectorAll("button")].find((button) => button.textContent?.includes("Record the next take"));
    expect(offer).toBeDefined();
    await act(async () => offer!.click());
    expect(onRecord).toHaveBeenCalledExactlyOnceWith("arc-a");
  });

  it("shows live feedback as messages and unfolds the document when the coach offers it", async () => {
    state.messages = [
      { ...message("opening", "Your pause gave the decision room. How does this sound to you?", "bot", {
        live_take_feedback: true, live_opening: true, step: "praise",
      }), kind: "walk_step" },
      { ...message("old-summary", "Your first text is in.", "bot", {}), kind: "cadence" },
    ];
    render(project, false, { initialReview: { take: project.takes[0], focus: { step: "feedback" }, live: true } });
    await flush();
    const conversation = host.querySelector<HTMLElement>("[data-live-take-feedback]")!;
    expect(conversation.textContent).toContain("Your pause gave the decision room.");
    expect(conversation.textContent).not.toContain("Your first text is in.");
    expect(conversation.querySelector("[data-review-section=ideal]")).toBeNull();

    state.chatQuery.mockResolvedValue({
      answer: "Here is your Ideal Text. Keep the words that helped your decision land.",
      persisted: true, persisted_client_id: "ideal-offer", suggested_action: "record_again",
      row_metadata: { live_take_feedback: true, review_destination: { step: "ideal" },
        after_ideal_text: "Your request is clear. The close could use another rehearsal. Want to try again?" },
    });
    enterAnswer("I think I'm done for now.");
    submitAnswer();
    await flush();
    expect(state.chatQuery.mock.calls[0][0].presentationContext)
      .toMatchObject({ live_take_feedback: true, take_exchange: true });
    const doc = conversation.querySelector("[data-review-section=ideal]")!;
    const readiness = [...conversation.querySelectorAll("p")].find((node) => node.textContent?.includes("The close could use"))!;
    const record = [...conversation.querySelectorAll("button")].find((node) => node.textContent?.includes("Record the next take"))!;
    expect(before(doc, readiness)).toBe(true);
    expect(before(readiness, record)).toBe(true);
  });

  it("keeps a fresh recording offer after Ideal Text even when history refresh fails", async () => {
    const closing = "Good job. See you next time.";
    state.messages = [
      message("opening", "The opening gave your point room.", "bot", {
        live_take_feedback: true, step: "praise", snippet_id: "opening-moment",
      }),
      message("old-closing", closing, "bot", { next_take: true }),
    ];
    render(project, false, { initialReview: { take: project.takes[0], focus: { step: "feedback" }, live: true } });
    const cite = host.querySelector<HTMLButtonElement>('button[title="Refer to this moment"]')!;
    act(() => cite.click());
    state.chatQuery.mockResolvedValueOnce({
      answer: "Here is the full Ideal Text.", persisted: true, persisted_client_id: "ideal-offer",
      row_metadata: { live_take_feedback: true, review_destination: { step: "ideal" } },
    });
    enterAnswer("Show me my full Ideal Text.");
    submitAnswer();
    await flush();
    expect(state.chatQuery.mock.calls[0][0].presentationContext.review_focus)
      .toEqual({ step: "feedback", snippet_id: "opening-moment" });
    expect(host.querySelector("[data-review-section=ideal]")?.textContent).toBeTruthy();

    state.chatQuery.mockResolvedValueOnce({
      answer: closing, persisted: true, persisted_client_id: "new-recording-offer",
      row_metadata: { live_take_feedback: true, suggested_action: "record_again" },
    });
    state.reload.mockRejectedValueOnce(new Error("history refresh failed"));
    const field = enterAnswer("Can I record again?");
    submitAnswer();
    await flush();
    expect(state.chatQuery.mock.calls[1][0]).toMatchObject({
      sessionId: "take-a", presentationContext: { review_focus: { step: "ideal" }, live_take_feedback: true },
    });
    expect(field.value).toBe("");
    expect(host.querySelector("[data-project-chat-error]")).toBeNull();
    const reply = host.querySelector('[data-project-message="new-recording-offer"]')!;
    expect(reply?.textContent).toBe(closing);
    const actions = host.querySelector('[data-take-message-actions="new-recording-offer"]')!;
    const record = [...actions.querySelectorAll("button")].find((button) => button.textContent?.includes("Record the next take"));
    expect(record).toBeDefined();
    await act(async () => record!.click());
    expect(onRecord).toHaveBeenCalledExactlyOnceWith("arc-a");
  });

  it("shows the coach's cited fragment and keeps the next turn in the active Take", async () => {
    const earlier = { ...project.takes[0], sessionId: "take-earlier", takeIndex: 1 };
    const latest = { ...project.takes[0], takeIndex: 2 };
    const clip = "https://media.example/cars.mp3";
    const assessment = "You said the part about the cars felt shaky. The detail about the brakes gives listeners something concrete.";
    const instruction = "Try leading with the brakes and give that line a beat.";
    momentApi.clip.mockResolvedValue({ src: clip, startOffsetMs: 700, durationMs: 3300, takeIndex: 1 });
    state.messages = [message("ideal", "Here is the full Ideal Text.", "bot", {
      live_take_feedback: true, review_destination: { step: "ideal" },
    })];
    state.chatQuery.mockResolvedValueOnce({
      answer: assessment, persisted: true, persisted_client_id: "fragment-reply",
      row_metadata: {
        live_take_feedback: true,
        coach_moment: { arc_id: "arc-a", take_session_id: earlier.sessionId, snippet_id: "cars", practise: true },
        chat_artifact: { version: 1, title: "Cars", intervention: instruction },
      },
    }).mockResolvedValueOnce({ answer: "Yes, try the line once.", persisted: true, persisted_client_id: "practice-reply" });
    render({ ...project, takes: [earlier, latest], takeCount: 2 }, false, {
      initialReview: { take: latest, focus: { step: "feedback" }, live: true },
    });
    enterAnswer("Could we go back to the part about cars? I felt insecure there.");
    submitAnswer();
    await flush();
    const reply = host.querySelector('[data-project-message="fragment-reply"] [data-bubble]');
    expect(reply?.textContent).toContain(assessment);
    expect(reply?.textContent).toContain(instruction);
    expect(reply?.querySelector("audio")?.src).toBe(clip);
    expect(momentApi.clip).toHaveBeenCalledWith(expect.objectContaining({
      take_session_id: earlier.sessionId, snippet_id: "cars",
    }));

    enterAnswer("Can we practise it?");
    submitAnswer();
    await flush();
    expect(state.chatQuery.mock.calls[1][0]).toMatchObject({
      sessionId: latest.sessionId,
      presentationContext: { review_focus: { step: "feedback" }, live_take_feedback: true, take_exchange: true },
    });
    expect(state.chatQuery.mock.calls[1][0].presentationContext.review_focus.snippet_id).toBeUndefined();
    expect(host.querySelector('[data-project-message="practice-reply"]')?.textContent).toContain("Yes, try the line once.");
  });

  it("keeps the processing bubble through a remount and replaces it only with fresh feedback", async () => {
    const refreshed: TrainingArc = {
      ...project,
      takeCount: 3,
      takes: [
        ...project.takes,
        {
          sessionId: "take-b",
          takeIndex: 2,
          createdAt: null,
          hasSlides: true,
          feedbackAvailable: true,
        },
        {
          sessionId: "take-c", takeIndex: 3, createdAt: null, hasSlides: true,
          feedbackAvailable: false, reviewAvailable: false,
        },
      ],
    };
    trainingApi.fetchTrainings.mockResolvedValue([refreshed]);

    render(project, true, { handoffTake: "take-b" });
    const processing = host.querySelector<HTMLButtonElement>("[data-processing-bubble]");
    act(() => processing?.click());
    expect(host.querySelector('[role="dialog"][aria-label="Processing your take"]')).not.toBeNull();

    render(project, true, { handoffTake: "take-b" });
    expect(host.querySelector("[data-processing-bubble]")).not.toBeNull();

    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(host.querySelector("[data-processing-bubble]")).toBeNull();
    expect(host.querySelector('[role="dialog"][aria-label="Processing your take"]')).toBeNull();
    expect(host.querySelector('[data-project-take="take-b"] [data-take-review]')).not.toBeNull();
    render(project, false, { handoffTake: null });
    expect(host.querySelector('[data-project-take="take-b"] [data-take-review]')).not.toBeNull();
    expect(host.querySelector('[data-project-take="take-a"] [data-take-review-message]')).not.toBeNull();
    expect(host.querySelector('[data-project-take="take-c"] [data-take-review]')).toBeNull();
    expect(host.textContent).not.toContain("Good");
  });

  it("restores a durable failure as an actionable project-chat state", () => {
    localStorage.setItem(
      "willab_processing_take:user-a",
      JSON.stringify({
        sessionId: "take-failed",
        arcId: "arc-a",
        takeIndex: 2,
        startedAt: Date.now(),
        phase: "analysis",
        phaseStartedAt: Date.now(),
        status: "failed",
        progress: null,
      }),
    );

    render();

    expect(host.querySelector("[data-processing-error]")).not.toBeNull();
    expect(host.textContent).toContain("Try processing again");
  });

  it("puts the result first and keeps the contextual exchange in human order", async () => {
    state.messages = [
      message("summary", "That was your most confident moment.", "bot", { summary: true }),
      message("closing", "Good job. See you next time.", "bot", { next_take: true, held_for: "will_question" }),
      message("bridge", "Now let's look at the content.", "bot", {}),
      message("question", "Who were you talking to?", "bot", {
        offer: "will_question",
        will_question_step: "ask",
        chips: ["Leadership", "My team", "Customers"],
      }),
    ];
    state.messages = state.messages.map((row, index) => ({
      ...row, client_created_at: new Date(Date.UTC(2026, 10, 23, 8, 0, index)).toISOString(),
    }));
    render();
    await openTake("take-a");

    const card = host.querySelector("[data-take-review-message]")!;
    const summary = host.querySelector('[data-project-message="summary"]')!;
    const bridge = host.querySelector('[data-project-message="bridge"]')!;
    const question = host.querySelector('[data-project-message="question"]')!;
    expect(before(card, summary)).toBe(true);
    expect(before(summary, bridge)).toBe(true);
    expect(before(bridge, question)).toBe(true);
    expect(host.textContent).not.toContain("Good job. See you next time.");
    expect(host.querySelector("[data-chat-mic]")).not.toBeNull();
    expect(host.querySelector("[data-chat-header]")).not.toBeNull();
    expect(host.querySelector("[data-will-answers]")).toBeNull();
    expect(host.querySelector('textarea[aria-label="Answer about this take"]')).not.toBeNull();

    state.messages = [
      message("summary", "That was your most confident moment.", "bot", { summary: true }),
      // The backend releases the stored closing without changing its original
      // timestamp. Raw order is deliberately wrong here.
      message("closing", "Good job. See you next time.", "bot", { next_take: true }),
      message("bridge", "Now let's look at the content.", "bot", {}),
      message("question", "Who were you talking to?", "bot", {
        offer: "will_question",
        will_question_step: "ask",
        chips: ["Leadership", "My team", "Customers"],
      }),
      message("answer", "My team", "user", { will_question_step: "answer" }),
      message("reply", "That helps me understand the context.", "bot", { will_question_step: "reply" }),
    ];
    state.messages = state.messages.map((row, index) => ({
      ...row, client_created_at: new Date(Date.UTC(2026, 10, 23, 8, 0, index)).toISOString(),
    }));
    render();

    const reply = host.querySelector('[data-project-message="reply"]')!;
    const closing = host.querySelector('[data-project-message="closing"]')!;
    expect(before(reply, closing)).toBe(true);
    expect(host.querySelector("[data-will-answers]")).toBeNull();
  });

  it("keeps option chips above a persistent composer and renders a tapped answer immediately", async () => {
    const request = deferred<boolean>();
    state.messages = [
      message("question", "Who were you talking to?", "bot", {
        offer: "will_question",
        will_question_step: "ask",
        chips: ["Leadership", "My team", "Customers"],
      }),
    ];
    state.willQuestion.mockImplementation(async () => {
      const accepted = await request.promise;
      if (accepted) {
        state.messages = [
          ...state.messages,
          message("tap-answer", "Leadership", "user", { will_question_step: "answer" }),
          message("tap-reply", "That helps me understand the context.", "bot", { will_question_step: "reply" }),
        ];
      }
      return accepted;
    });
    render({ ...project, takes: [{ ...project.takes[0], feedbackAvailable: false }] });

    const choices = host.querySelector("[data-will-answers]")!;
    const composer = host.querySelector("[data-project-question-composer]")!;
    expect(before(choices, composer)).toBe(true);

    const leadership = [...host.querySelectorAll("button")].find(
      (button) => button.textContent === "Leadership",
    )!;
    act(() => leadership.click());

    expect(host.querySelector("[data-project-pending-answer]")?.textContent).toBe("Leadership");
    expect(host.querySelector("[data-project-question-composer]")).not.toBeNull();
    expect(state.willQuestion).toHaveBeenCalledWith("arc-a", "take-a", "Leadership");

    await act(async () => request.resolve(true));
    await flush();
    const own = [...host.querySelectorAll("[data-project-message]")].filter(
      (node) => node.textContent === "Leadership",
    );
    expect(own).toHaveLength(1);
    expect(host.querySelector("[data-project-pending-answer]")).toBeNull();
    expect(host.querySelector("[data-chat-mic]")).not.toBeNull();
  });

  it("uses backend-owned contextual persistence, retains reply semantics, and reconciles once", async () => {
    const request = deferred<{
      answer: string;
      persisted: boolean;
      after_take: boolean;
      row_metadata: Record<string, unknown>;
    }>();
    const reloaded = deferred<void>();
    state.chatQuery.mockReturnValue(request.promise);
    state.reload.mockReturnValue(reloaded.promise);
    state.messages = [
      message("question", "Who were you talking to?", "bot", {
        offer: "will_question",
        will_question_step: "ask",
        chips: ["Leadership", "My team", "Customers"],
      }),
    ];
    render();
    await openTake("take-a");
    enterAnswer("A mixed room of leaders and specialists");
    submitAnswer();

    expect(host.querySelector("[data-project-pending-answer]")?.textContent)
      .toBeUndefined();
    expect([...host.querySelectorAll("[data-project-message]")].filter(
      (node) => node.textContent === "A mixed room of leaders and specialists",
    )).toHaveLength(1);
    expect(state.willQuestion).not.toHaveBeenCalled();
    expect(state.appendRecoverable).toHaveBeenCalledTimes(1);
    const query = state.chatQuery.mock.calls[0]![0] as {
      clientId: string;
      clientCreatedAt: string;
    };
    const optimistic = state.appendRecoverable.mock.results[0]!.value.message as LoungeMessage;
    expect(query).toEqual(expect.objectContaining({
      question: "A mixed room of leaders and specialists",
      sessionId: "take-a",
      place: "speaking",
      persist: true,
      clientId: optimistic.client_id,
      clientCreatedAt: optimistic.client_created_at,
      history: [{ role: "assistant", metadata: { arc_id: "arc-a" }, content: "Who were you talking to?" }],
    }));

    await act(async () => request.resolve({
      answer: "Now I can tailor the opening to both groups.",
      persisted: true,
      after_take: true,
      row_metadata: {
        will_question_step: "thanks",
        backend_marker: "kept",
      },
    }));
    await flush();
    expect(state.reload).toHaveBeenCalledTimes(1);
    expect(state.appendLocalOnly).toHaveBeenCalledTimes(1);
    const localReply = state.appendLocalOnly.mock.calls[0]![0] as LoungeMessageDraft;
    expect(localReply.metadata).toEqual(expect.objectContaining({
      will_question_step: "thanks",
      backend_marker: "kept",
    }));
    expect(state.appendRecoverable).toHaveBeenCalledTimes(1);

    state.messages = [
      message("question", "Who were you talking to?", "bot", {
        offer: "will_question",
        will_question_step: "ask",
        chips: ["Leadership", "My team", "Customers"],
      }),
      {
        ...optimistic,
        metadata: {
          ...optimistic.metadata,
          will_question_step: "answer",
        },
      },
      message("reply", "Now I can tailor the opening to both groups.", "bot", {
        will_question_step: "thanks",
        backend_marker: "kept",
      }),
    ];
    await act(async () => reloaded.resolve());
    await flush();
    const own = [...host.querySelectorAll("[data-project-message]")].filter(
      (node) => node.textContent === "A mixed room of leaders and specialists",
    );
    expect(own).toHaveLength(1);
    expect(host.querySelector("[data-project-pending-answer]")).toBeNull();
    expect(host.textContent).toContain("Now I can tailor the opening to both groups.");
    expect(host.querySelector("[data-chat-mic]")).not.toBeNull();
  });

  it("shows one pending turn, disables the composer, and scrolls the accepted send and reply into view", async () => {
    const request = deferred<{ answer: string; persisted: boolean; row_metadata: Record<string, unknown> }>();
    const reloaded = deferred<void>();
    state.chatQuery.mockReturnValue(request.promise);
    state.reload.mockReturnValue(reloaded.promise);
    state.messages = [
      message("question", "What should they remember?", "bot", {
        offer: "will_question",
        will_question_step: "follow",
        chips: [],
      }),
    ];
    render();
    await openTake("take-a");
    const scroller = host.querySelector("[data-project-scroll]") as HTMLDivElement;
    const metrics = scrollMetrics(scroller);
    scroller.scrollTop = 0;
    const field = enterAnswer("Keep the owner explicit.");
    submitAnswer();
    await flush();

    expect(field.disabled).toBe(false);
    expect(host.querySelector("[data-project-question-composer]")?.getAttribute("aria-busy")).toBe("true");
    expect(state.chatQuery).toHaveBeenCalledTimes(1);
    expect(host.querySelectorAll('[data-typing-dots][aria-label="Will is replying"]')).toHaveLength(1);
    expect([...host.querySelectorAll("[data-project-message]")].filter(
      (node) => node.textContent === "Keep the owner explicit.",
    )).toHaveLength(1);
    expect(scroller.scrollTop).toBe(1_200);

    scroller.scrollTop = 0;
    metrics.setHeight(1_600);
    await act(async () => request.resolve({
      answer: "Then land that owner in the final sentence.",
      persisted: true,
      row_metadata: { will_question_step: "thanks" },
    }));
    await flush();
    expect(host.querySelectorAll('[data-typing-dots][aria-label="Will is replying"]')).toHaveLength(1);

    state.messages = [
      message("question", "What should they remember?", "bot", {
        offer: "will_question",
        will_question_step: "follow",
        chips: [],
      }),
      state.appendRecoverable.mock.results[0]!.value.message as LoungeMessage,
      message("reply", "Then land that owner in the final sentence.", "bot", {
        will_question_step: "thanks",
      }),
    ];
    await act(async () => reloaded.resolve());
    await flush();
    expect(scroller.scrollTop).toBe(1_600);
    expect(host.querySelectorAll("[data-typing-dots]")).toHaveLength(0);
    expect(host.textContent).toContain("Then land that owner in the final sentence.");
  });

  it("keeps the accepted bubble and exact draft with one explicit recoverable error", async () => {
    const request = deferred<{ answer: string; persisted: boolean }>();
    state.chatQuery.mockReturnValue(request.promise);
    state.messages = [
      message("question", "What should they remember?", "bot", {
        offer: "will_question",
        will_question_step: "follow",
        chips: [],
      }),
    ];
    render();
    await openTake("take-a");
    const scroller = host.querySelector("[data-project-scroll]") as HTMLDivElement;
    scrollMetrics(scroller, 1_400);
    const exact = "  Keep the decision simple.  ";
    enterAnswer(exact);
    submitAnswer();
    await flush();
    scroller.scrollTop = 0;

    await act(async () => request.reject(new Error("offline")));
    await flush();

    expect(host.querySelectorAll("[data-project-chat-error]")).toHaveLength(1);
    expect(host.textContent).toContain("I'm having trouble reaching the lab right now.");
    expect((host.querySelector('textarea[aria-label="Answer about this take"]') as HTMLTextAreaElement).value)
      .toBe(exact);
    expect([...host.querySelectorAll("[data-project-message]")].filter(
      (node) => node.textContent === "Keep the decision simple.",
    )).toHaveLength(1);
    expect(scroller.scrollTop).toBe(1_400);
  });

  it("keeps a refused quick choice once with one recoverable error", async () => {
    state.messages = [
      message("question", "Who were you talking to?", "bot", {
        offer: "will_question",
        will_question_step: "ask",
        chips: ["Leadership", "My team"],
      }),
    ];
    state.willQuestion.mockResolvedValue(false);
    render({ ...project, takes: [{ ...project.takes[0], feedbackAvailable: false }] });
    const leadership = [...host.querySelectorAll("button")].find(
      (button) => button.textContent === "Leadership",
    )!;
    await act(async () => leadership.click());
    await flush();

    expect([...host.querySelectorAll("[data-project-message]")].filter(
      (node) => node.textContent === "Leadership",
    )).toHaveLength(1);
    expect(host.querySelectorAll("[data-project-chat-error]")).toHaveLength(1);
    expect(state.appendRecoverable).toHaveBeenCalledTimes(1);
  });

  it("suppresses stale terminal walk copy returned for a fresh project question", async () => {
    state.messages = [
      message("question", "What should they remember?", "bot", {
        offer: "will_question",
        will_question_step: "follow",
        chips: [],
      }),
      message("closing", "Good job. See you next time.", "bot", {
        next_take: true,
        held_for: "will_question",
      }),
    ];
    state.chatQuery.mockResolvedValue({
      answer: "Good job. See you next time.",
      persisted: true,
      row_metadata: { will_question_step: "thanks" },
    });
    render();
    await openTake("take-a");
    enterAnswer("What should I practise next?");
    submitAnswer();
    await flush();

    expect(host.textContent).not.toContain("Good job. See you next time.");
    expect(host.querySelectorAll("[data-project-chat-error]")).toHaveLength(1);
  });

  it("restores and retries the exact draft with the same client identity after a request failure", async () => {
    const first = deferred<{ answer: string; persisted: boolean }>();
    const second = deferred<{ answer: string; persisted: boolean; row_metadata: Record<string, unknown> }>();
    state.chatQuery.mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise);
    state.messages = [
      message("question", "What should they remember?", "bot", {
        offer: "will_question",
        will_question_step: "follow",
        chips: [],
      }),
    ];
    render();
    await openTake("take-a");
    const exact = "  Keep the decision simple.  ";
    enterAnswer(exact);
    submitAnswer();
    await flush();
    const firstQuery = state.chatQuery.mock.calls[0]![0] as {
      clientId: string;
      clientCreatedAt: string;
    };
    expect([...host.querySelectorAll("[data-project-message]")].filter(
      (node) => node.textContent === "Keep the decision simple.",
    )).toHaveLength(1);

    await act(async () => first.reject(new Error("offline")));
    await flush();
    const restored = host.querySelector('textarea[aria-label="Answer about this take"]') as HTMLTextAreaElement;
    expect(restored.value).toBe(exact);
    expect(state.appendRecoverable).toHaveBeenCalledTimes(1);
    expect([...host.querySelectorAll("[data-project-message]")].filter(
      (node) => node.textContent === "Keep the decision simple.",
    )).toHaveLength(1);

    submitAnswer();
    await flush();
    const secondQuery = state.chatQuery.mock.calls[1]![0] as {
      clientId: string;
      clientCreatedAt: string;
    };
    expect(secondQuery.clientId).toBe(firstQuery.clientId);
    expect(secondQuery.clientCreatedAt).toBe(firstQuery.clientCreatedAt);
    expect(state.appendRecoverable).toHaveBeenCalledTimes(1);

    state.reload.mockImplementation(async () => {
      const optimistic = state.appendRecoverable.mock.results[0]!.value.message as LoungeMessage;
      state.messages = [
        message("question", "What should they remember?", "bot", {
          offer: "will_question",
          will_question_step: "follow",
          chips: [],
        }),
        optimistic,
        message("reply", "That is the line to land.", "bot", { will_question_step: "thanks" }),
      ];
    });
    await act(async () => second.resolve({
      answer: "That is the line to land.",
      persisted: true,
      row_metadata: { will_question_step: "thanks" },
    }));
    await flush();
    expect([...host.querySelectorAll("[data-project-message]")].filter(
      (node) => node.textContent === "Keep the decision simple.",
    )).toHaveLength(1);
  });

  it("restores an interrupted project request only in its project and retries its original Take", async () => {
    const question = message("ask", "Who needs to act?", "bot", {
      offer: "will_question", will_question_step: "ask", chips: [],
    });
    state.messages = [question];
    state.chatQuery.mockRejectedValueOnce(new Error("offline"))
      .mockResolvedValueOnce({ answer: "Name the decision.", persisted: true, persisted_client_id: "saved" });
    render();
    enterAnswer("  The board  ");
    submitAnswer();
    await flush();
    const first = state.chatQuery.mock.calls[0]![0];
    act(() => root.unmount());
    root = createRoot(host);
    state.messages = [question];
    render({ ...project, arcId: "arc-b" });
    expect(host.textContent).not.toContain("The board");
    expect(host.querySelector("[data-chat-turn-error]")).toBeNull();
    render();
    expect(host.textContent?.split("The board")).toHaveLength(2);
    const retry = host.querySelector<HTMLButtonElement>("[data-chat-turn-error] button")!;
    act(() => { retry.click(); retry.click(); });
    await flush();
    expect(state.chatQuery.mock.calls.map(([args]) => args)).toEqual([first, first]);
    expect(first).toMatchObject({ projectId: "arc-a", sessionId: "take-a" });
    expect(host.textContent?.split("The board")).toHaveLength(2);
    expect(host.querySelector("[data-chat-turn-error]")).toBeNull();
  });

  it("keeps the exact optimistic turn retryable when a 200 is not persisted", async () => {
    state.chatQuery.mockResolvedValue({
      answer: "I answered, but storage failed.",
      persisted: false,
      row_metadata: { will_question_step: "thanks" },
    });
    state.messages = [
      message("question", "What should they remember?", "bot", {
        offer: "will_question",
        will_question_step: "follow",
        chips: [],
      }),
    ];
    render();
    await openTake("take-a");
    const exact = "  Keep the owner explicit.  ";
    enterAnswer(exact);
    submitAnswer();
    await flush();

    const firstQuery = state.chatQuery.mock.calls[0]![0] as { clientId: string; clientCreatedAt: string };
    expect((host.querySelector('textarea[aria-label="Answer about this take"]') as HTMLTextAreaElement).value)
      .toBe(exact);
    expect(state.reload).not.toHaveBeenCalled();
    expect(state.appendLocalOnly).not.toHaveBeenCalled();
    expect([...host.querySelectorAll("[data-project-message]")].filter(
      (node) => node.textContent === "Keep the owner explicit.",
    )).toHaveLength(1);

    submitAnswer();
    await flush();
    const secondQuery = state.chatQuery.mock.calls[1]![0] as { clientId: string; clientCreatedAt: string };
    expect(secondQuery.clientId).toBe(firstQuery.clientId);
    expect(secondQuery.clientCreatedAt).toBe(firstQuery.clientCreatedAt);
    expect(state.appendRecoverable).toHaveBeenCalledTimes(1);
  });

  it("restores the project draft when the conversation is reopened", async () => {
    const onDraftChange = vi.fn();
    render(project, false, { onDraftChange });
    await flush();
    const draft = "Can we make the opening shorter?";
    enterAnswer(draft);
    expect(onDraftChange).toHaveBeenLastCalledWith(draft);

    act(() => root.render(null));
    render(project, false, { initialDraft: draft, onDraftChange });
    const input = host.querySelector<HTMLTextAreaElement>('[data-project-question-composer] textarea');
    expect(input?.value).toBe(draft);
  });
});
