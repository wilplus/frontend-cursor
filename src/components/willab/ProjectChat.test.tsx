// @vitest-environment jsdom
/*
STORY    As a speaker, I want the project result first and the conversation in
         human order, using the app's locked chat controls.
OUTCOME  O1  Feedback walk and Ideal Text are one readable first card.
         O2  The summary leads into the question; a held goodbye stays hidden
             and, once released, follows the answer instead of jumping ahead.
         O3  The project uses one chat top bar and the standard answer controls.
         O4  Every route to the current Ideal Text preserves the decision to
             continue to the next fragment or repeat this fragment.
         O5  The project-card CTAs keep the selected Take and route distinct:
             Feedback opens its exact Feedback Walk range; Ideal Text stays
             on Ideal Text.
         O6  An accepted typed answer, its one pending state, and its matched
             reply or recoverable error are always brought into view.
         O7  A refused quick choice remains one durable user turn with one
             recoverable error instead of disappearing.
PROVES   O1 -> "puts the result before the project conversation"
         O2 -> "keeps the contextual exchange in human order"
         O3 -> "uses the locked chat bar and answer controls"
         O4 -> "keeps the fragment decision when Ideal Text opens from the card"
         O5 -> "keeps the selected Take and range on Feedback while Ideal Text remains separate"
         O6 -> "shows one pending turn, disables the composer, and scrolls the accepted send and reply into view"
         O7 -> "keeps a refused quick choice once with one recoverable error"
WHY      Founder lock, 2026-11-16: no bespoke project-chat chrome or pills;
         release-blocking chat audit, 2026-11-17.
*/
import { act, createElement } from "react";
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
}));
const trainingApi = vi.hoisted(() => ({ fetchTrainings: vi.fn() }));
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
vi.mock("@/services/api/willQuestion", () => ({
  postWillQuestion: (...args: unknown[]) => state.willQuestion(...args),
}));
vi.mock("./useBackDismiss", () => ({ useBackDismiss: () => undefined }));
vi.mock("./useUserId", () => ({ useUserId: () => "user-a" }));
vi.mock("@/services/api/arcSetup", () => ({
  fetchArcSetup: arcSetup.fetch,
}));
vi.mock("@/services/api/trainings", () => ({
  fetchTrainings: trainingApi.fetchTrainings,
}));
vi.mock("./IdealTextCard", () => ({
  default: ({ onOpen }: { onOpen: () => void }) =>
    createElement("button", { "data-testid": "ideal", onClick: onOpen }, "Ideal Text"),
}));
vi.mock("./IdealTextOverlay", () => ({
  default: ({
    practiceDecision,
    initialMode,
    coachTake,
    reviewTake,
    reviewSlideRange,
    requireFeedbackWalk,
    onClose,
  }: {
    practiceDecision?: { continueLabel?: string; onContinue: () => void; onRepeat: () => void };
    initialMode?: string;
    coachTake?: string | null;
    reviewTake?: string | null;
    reviewSlideRange?: { startSlide: number; endSlide: number } | null;
    requireFeedbackWalk?: boolean;
    onClose?: () => void;
  }) =>
    createElement(
      "div",
      {
        "data-testid": practiceDecision ? "decision" : "result",
        "data-overlay-mode": initialMode ?? "notebook",
        "data-coach-take": coachTake ?? "",
        "data-review-take": reviewTake ?? "",
        "data-review-range": reviewSlideRange
          ? `${reviewSlideRange.startSlide}-${reviewSlideRange.endSlide}`
          : "",
        "data-require-feedback-walk": requireFeedbackWalk ? "true" : "false",
      },
      practiceDecision
        ? createElement(
            "div",
            null,
            createElement("button", { onClick: practiceDecision.onContinue }, practiceDecision.continueLabel),
            createElement("button", { onClick: practiceDecision.onRepeat }, "Repeat this fragment"),
            createElement("button", { onClick: onClose }, "Close"),
          )
        : createElement("button", { onClick: onClose }, "Close"),
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
  }],
  batchVerified: false,
  idealReady: true,
  bestPresentationArcId: "arc-a",
  coverRef: null,
  deletion: null,
  archived: false,
  practiceProgress: 45,
  practiceChunks: [{
    startSlide: 1,
    endSlide: 2,
    attempts: 1,
    deliveryLabel: "Almost",
    latestSessionId: "take-a",
  }],
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
  state.appendRecoverable.mockReset().mockImplementation((draft: LoungeMessageDraft) => {
    const stamped = stampLoungeMessage(draft, newestStamp(state.messages));
    state.messages = [...state.messages, stamped];
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
  trainingApi.fetchTrainings.mockReset();
});

afterEach(() => {
  act(() => root.unmount());
  host.remove();
});

function render(currentProject: TrainingArc = project, recordingInProgress = false): void {
  act(() => root.render(createElement(ProjectChat, {
    project: currentProject,
    onBack: vi.fn(),
    onRecord,
    recordingInProgress,
  })));
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
  it("shows the neutral result card as soon as the accepted Take reaches the thread", () => {
    const accepted: LoungeMessage = {
      client_id: "accepted-take",
      client_created_at: "2026-11-16T00:00:00.000Z",
      role: "system",
      kind: "recording_summary",
      body: "Readout · Board meeting",
      metadata: {
        arc_id: "arc-a",
        session_id: "take-accepted",
        take_index: 1,
        topic: "Board meeting",
      },
    };
    state.messages = [accepted];
    render({
      ...project,
      takeCount: 0,
      takes: [],
      practiceProgress: 0,
      practiceChunks: [],
    });

    expect(host.querySelector("[data-feedback-walk-card]")).not.toBeNull();
    expect(host.textContent).toContain("Take 1");
    expect(host.textContent).toContain("Processing");
    expect(host.textContent).not.toContain("Not yet there");
    expect(host.querySelector('[data-project-message="accepted-take"]')).toBeNull();
  });

  it("combines practice history and Ideal text in one result card", () => {
    render();
    expect(host.querySelector("[data-feedback-walk-card]")).not.toBeNull();
    expect(host.textContent).toContain("Progress");
    expect(host.textContent).toContain("Slides 1-2");
    expect(host.textContent).toContain("Almost");
    expect(host.textContent).toContain("Feedback");
    expect(host.textContent).toContain("Ideal text");
    expect(host.textContent).toContain("Continue recording");
    expect(host.querySelector("input")).toBeNull();

    act(() => (host.querySelector("[data-project-record]") as HTMLButtonElement).click());
    expect(host.querySelector('[data-testid="decision"]')).not.toBeNull();
    act(() => [...host.querySelectorAll("button")].find((button) => button.textContent === "Continue practice")!.click());
    expect(host.querySelector('[data-testid="decision"]')).toBeNull();
    expect(onRecord).toHaveBeenCalledTimes(1);
    expect(localStorage.getItem("willab_practice_resume:v1:user-a:arc-a")).toContain('"durationSeconds":300');
  });

  it("keeps the fragment decision when Ideal Text opens from the card", () => {
    render();

    const idealText = host.querySelector(
      'button[aria-label="Open Ideal text"]',
    ) as HTMLButtonElement;
    act(() => idealText.click());

    expect(host.querySelector('[data-testid="decision"]')).not.toBeNull();
    expect(host.textContent).toContain("Continue practice");
    expect(host.textContent).toContain("Repeat this fragment");
    expect(host.querySelector('[data-testid="result"]')).toBeNull();

    act(() => [...host.querySelectorAll("button")].find(
      (button) => button.textContent === "Repeat this fragment",
    )!.click());
    expect(onRecord).toHaveBeenCalledWith("arc-a");
    expect(localStorage.getItem("willab_practice_resume:v1:user-a:arc-a")).toContain('"slideIndex":0');
  });

  it("keeps the selected Take and range on Feedback while Ideal Text remains separate", () => {
    const twoTakes: TrainingArc = {
      ...project,
      takeCount: 2,
      takes: [
        ...project.takes,
        {
          sessionId: "take-b",
          takeIndex: 2,
          createdAt: null,
          hasSlides: true,
          feedbackAvailable: true,
        },
      ],
      practiceChunks: [
        project.practiceChunks[0],
        {
          startSlide: 3,
          endSlide: 4,
          attempts: 1,
          deliveryLabel: "Good",
          latestSessionId: "take-b",
        },
      ],
    };
    render(twoTakes);

    act(() => (host.querySelector('button[aria-expanded="false"]') as HTMLButtonElement).click());
    act(() => (host.querySelectorAll("[data-practice-chunk]")[0] as HTMLElement).click());
    act(() => [...host.querySelectorAll("button")].find((button) => button.textContent?.includes("Feedback"))!.click());

    const feedbackOverlay = host.querySelector('[data-testid="decision"]')!;
    expect(feedbackOverlay.getAttribute("data-overlay-mode")).toBe("review");
    expect(feedbackOverlay.getAttribute("data-review-take")).toBe("take-a");
    expect(feedbackOverlay.getAttribute("data-review-range")).toBe("1-2");
    expect(feedbackOverlay.getAttribute("data-coach-take")).toBe("take-a");
    expect(feedbackOverlay.getAttribute("data-require-feedback-walk")).toBe("true");

    act(() => [...feedbackOverlay.querySelectorAll("button")].find((button) => button.textContent === "Close")!.click());
    act(() => [...host.querySelectorAll("button")].find((button) => button.textContent?.includes("Ideal text"))!.click());

    const idealOverlay = host.querySelector('[data-testid="decision"]')!;
    expect(idealOverlay.getAttribute("data-overlay-mode")).toBe("notebook");
    expect(idealOverlay.getAttribute("data-review-take")).toBe("");
    expect(idealOverlay.getAttribute("data-review-range")).toBe("");
    expect(idealOverlay.getAttribute("data-coach-take")).toBe("");
    expect(idealOverlay.getAttribute("data-require-feedback-walk")).toBe("false");
  });

  it("opens the scoped recording for Continue practice and Repeat this fragment", async () => {
    localStorage.setItem("willab_practice_checkpoint:v1:user-a:arc-a", "0");
    render();
    await act(async () => { await Promise.resolve(); });

    act(() => (host.querySelector("[data-project-record]") as HTMLButtonElement).click());
    expect(host.querySelector('[data-testid="decision"]')).not.toBeNull();
    act(() => [...host.querySelectorAll("button")].find((button) => button.textContent === "Continue practice")!.click());
    expect(onRecord).toHaveBeenNthCalledWith(1, "arc-a");
    expect(localStorage.getItem("willab_practice_resume:v1:user-a:arc-a")).toContain('"slideIndex":1');

    act(() => (host.querySelector("[data-project-record]") as HTMLButtonElement).click());
    act(() => [...host.querySelectorAll("button")].find((button) => button.textContent === "Repeat this fragment")!.click());
    expect(onRecord).toHaveBeenNthCalledWith(2, "arc-a");
    expect(localStorage.getItem("willab_practice_resume:v1:user-a:arc-a")).toContain('"slideIndex":0');
  });

  it("still records when Continue practice is on the final fragment", async () => {
    arcSetup.fetch.mockResolvedValueOnce({ slides: [{ title: "Only", body: "" }] });
    localStorage.setItem("willab_practice_checkpoint:v1:user-a:arc-a", "0");
    render();
    await act(async () => { await Promise.resolve(); });

    act(() => (host.querySelector("[data-project-record]") as HTMLButtonElement).click());
    expect(host.textContent).toContain("Continue practice");
    expect(host.textContent).not.toContain("Finish presentation");
    act(() => [...host.querySelectorAll("button")].find((button) => button.textContent === "Continue practice")!.click());
    expect(onRecord).toHaveBeenCalledTimes(1);
    expect(localStorage.getItem("willab_practice_resume:v1:user-a:arc-a")).toContain('"slideIndex":0');
  });

  it("keeps the processing bubble through a remount and replaces it only with fresh feedback", async () => {
    const refreshed: TrainingArc = {
      ...project,
      takeCount: 2,
      takes: [
        ...project.takes,
        {
          sessionId: "take-b",
          takeIndex: 2,
          createdAt: null,
          hasSlides: true,
          feedbackAvailable: true,
        },
      ],
      practiceChunks: [{
        startSlide: 1,
        endSlide: 2,
        attempts: 2,
        deliveryLabel: "Good",
        latestSessionId: "take-b",
      }],
      practiceProgress: 72,
    };
    trainingApi.fetchTrainings.mockResolvedValue([refreshed]);

    render(project, true);
    expect(host.querySelector("[data-processing-bubble]")).not.toBeNull();

    render(project, true);
    expect(host.querySelector("[data-processing-bubble]")).not.toBeNull();

    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(host.querySelector("[data-processing-bubble]")).toBeNull();
    expect(host.textContent).toContain("2 attempts");
    expect(host.textContent).toContain("Good");
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
    render();

    const card = host.querySelector("[data-project-results]")!;
    const summary = host.querySelector('[data-project-message="summary"]')!;
    const bridge = host.querySelector('[data-project-message="bridge"]')!;
    const question = host.querySelector('[data-project-message="question"]')!;
    expect(before(card, summary)).toBe(true);
    expect(before(summary, bridge)).toBe(true);
    expect(before(bridge, question)).toBe(true);
    expect(host.textContent).not.toContain("Good job. See you next time.");
    expect(host.querySelector("[data-project-record]")).toBeNull();
    expect(host.querySelector("[data-chat-header]")).not.toBeNull();
    expect(host.querySelector("[data-will-answers]")).not.toBeNull();
    expect(host.querySelector('textarea[aria-label="Answer about this take"]')).not.toBeNull();
    expect(host.textContent).toContain("Leadership");
    expect(host.textContent).toContain("My team");

    const somethingElse = [...host.querySelectorAll("button")].find(
      (button) => button.textContent === "Something else",
    )!;
    await act(async () => somethingElse.click());
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
    render();

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
    expect(host.querySelector("[data-project-record]")).not.toBeNull();
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
      history: [{ role: "assistant", content: "Who were you talking to?" }],
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
    expect(host.querySelector("[data-project-record]")).not.toBeNull();
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
    const scroller = host.querySelector("[data-project-scroll]") as HTMLDivElement;
    const metrics = scrollMetrics(scroller);
    scroller.scrollTop = 0;
    const field = enterAnswer("Keep the owner explicit.");
    submitAnswer();
    await flush();

    expect(field.disabled).toBe(true);
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
    render();
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
});
