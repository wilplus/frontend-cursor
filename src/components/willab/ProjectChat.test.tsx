// @vitest-environment jsdom
/*
STORY    As a speaker, I want a project conversation with its two saved results,
         contextual questions and one recording action, so that the next step
         is clear without mixing project work into Will.
OUTCOME  O1  Feedback walk and Ideal Text are the two durable results.
         O2  An open question replaces recording with taps and typed reply.
PROVES   O1 -> "has exactly two durable results and one continuation CTA"
         O2 -> "replaces recording with taps and text while a project question is open"
WHY      Founder-approved project-chat prototype, 2026-11-15.
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

function render(): void {
  act(() => root.render(createElement(ProjectChat, {
    project,
    onBack: vi.fn(),
    onRecord,
  })));
}

describe("project conversation", () => {
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

  it("replaces recording with taps and text while a project question is open", () => {
    state.messages = [{
      client_id: "q1",
      client_created_at: "2026-11-15T00:00:00.000Z",
      role: "bot",
      kind: "text",
      body: "Who were you talking to?",
      metadata: {
        arc_id: "arc-a",
        offer: "will_question",
        will_question_step: "ask",
        take_session_id: "take-a",
        chips: ["Leadership", "My team"],
      },
    }];
    render();
    expect(host.querySelector("[data-project-record]")).toBeNull();
    expect(host.querySelector('input[aria-label="Answer about this take"]')).not.toBeNull();
    expect(host.textContent).toContain("Leadership");
    expect(host.textContent).toContain("My team");
  });
});
