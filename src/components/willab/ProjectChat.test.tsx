// @vitest-environment jsdom
/*
STORY    As a speaker, I want the project result first and the conversation in
         human order, using the app's locked chat controls.
OUTCOME  O1  Feedback walk and Ideal Text are one readable first card.
         O2  The summary leads into the question; a held goodbye stays hidden
             and, once released, follows the answer instead of jumping ahead.
         O3  The project uses one chat top bar and the standard answer controls.
PROVES   O1 -> "puts the result before the project conversation"
         O2 -> "keeps the contextual exchange in human order"
         O3 -> "uses the locked chat bar and answer controls"
WHY      Founder lock, 2026-11-16: no bespoke project-chat chrome or pills.
*/
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { LoungeMessage } from "@/services/api/loungeMessages";
import type { TrainingArc } from "@/services/api/trainings";

const state = vi.hoisted(() => ({ messages: [] as LoungeMessage[] }));
vi.mock("./LoungeThreadContext", () => ({
  useLoungeThreadCtx: () => ({
    messages: state.messages,
    signedIn: true,
    append: vi.fn(),
    reload: vi.fn(),
  }),
}));
vi.mock("./useBackDismiss", () => ({ useBackDismiss: () => undefined }));
vi.mock("./useUserId", () => ({ useUserId: () => "user-a" }));
vi.mock("@/services/api/arcSetup", () => ({
  fetchArcSetup: () => new Promise(() => undefined),
}));
vi.mock("./IdealTextCard", () => ({
  default: ({ onOpen }: { onOpen: () => void }) =>
    createElement("button", { "data-testid": "ideal", onClick: onOpen }, "Ideal Text"),
}));
vi.mock("./IdealTextOverlay", () => ({
  default: ({ practiceDecision }: { practiceDecision?: { onContinue: () => void; onRepeat: () => void } }) =>
    createElement(
      "div",
      { "data-testid": practiceDecision ? "decision" : "result" },
      practiceDecision
        ? createElement("button", { onClick: practiceDecision.onContinue }, "Continue to next fragment")
        : "Result",
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
let onRecord = vi.fn<() => void>();

beforeEach(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  state.messages = [];
  host = document.createElement("div");
  document.body.appendChild(host);
  root = createRoot(host);
  onRecord = vi.fn<() => void>();
  localStorage.clear();
});

afterEach(() => {
  act(() => root.unmount());
  host.remove();
});

function render(currentProject: TrainingArc = project): void {
  act(() => root.render(createElement(ProjectChat, {
    project: currentProject,
    onBack: vi.fn(),
    onRecord,
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
    act(() => [...host.querySelectorAll("button")].find((button) => button.textContent === "Continue to next fragment")!.click());
    expect(host.querySelector('[data-testid="decision"]')).toBeNull();
    expect(onRecord).toHaveBeenCalledTimes(1);
    expect(localStorage.getItem("willab_practice_resume:v1:user-a:arc-a")).toContain('"durationSeconds":300');
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
    expect(host.querySelector('textarea[aria-label="Answer about this take"]')).toBeNull();
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
});
