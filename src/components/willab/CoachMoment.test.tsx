// @vitest-environment jsdom
/*
STORY    As a speaker, I want the coach to play the fragment it cites and
         present the exercise for that moment in my chat.
OUTCOME  O1  An authorized clip and served exercise share the reply bubble and practice opens there.
         O2  An exercise for another moment stays out of the reply.
         O3  An unavailable clip stays out of the reply.
         O4  Older automatic transcript footers disappear while normal text stays.
         O5  A reply replays only the practice saved for its own moment.
         O6  The rewrite becomes an output only after the speaker's choice is saved.
         O7  A served Sniper or AI audio example appears with the original clip.
PROVES   O1 -> "plays a cited moment and opens its served exercise right in chat"
         O2 -> "keeps the clip when the served intervention is for another moment"
         O3 -> "omits an unauthorized fragment and never looks up its practice"
         O4 -> "drops the automatic transcript footer while keeping ordinary chat text"
         O5 -> "replays the saved attempt for the cited moment"
         O6 -> "saves an explicit wording choice before showing it as output"
         O7 -> "shows the served Sniper instructions for %s", "plays a supplied AI example beside the recording"
*/
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import CoachMoment from "./CoachMoment";
import TakeConversationMessage from "./chats/TakeConversationMessage";
import { withoutCoachTranscriptFooter } from "./willabHelpers";

const api = vi.hoisted(() => ({
  clip: vi.fn(), document: vi.fn(), tempo: vi.fn(), practiceOn: vi.fn(), steps: vi.fn(), decision: vi.fn(),
  ai: vi.fn(),
}));
vi.mock("@/lib/api/bffFetch", () => ({ bffFetch: api.clip }));
vi.mock("@/services/api/idealText", () => ({ fetchIdealText: api.document }));
vi.mock("@/services/api/consentChoices", () => ({ readPractiseOffered: api.practiceOn }));
vi.mock("@/services/api/reviewTempo", () => ({ fetchReviewTempo: api.tempo }));
vi.mock("@/services/api/takeReview", () => ({ readReviewSteps: api.steps }));
vi.mock("@/lib/willab/idealTextDecisions", () => ({ postTrackedDecision: api.decision }));
vi.mock("@/services/api/aiVoice", async (load) => ({
  ...await load<typeof import("@/services/api/aiVoice")>(),
  readAiVoice: api.ai, readAiVoiceOnce: api.ai,
}));
vi.mock("./IdealTextOverlay", () => ({
  default: ({ reviewAt }: { reviewAt: { take: string; snippet: string; practise: boolean } }) =>
    <aside data-practice={JSON.stringify(reviewAt)} />,
}));

const reference = { arc_id: "project", take_session_id: "take-2", snippet_id: "moment", practise: true };
const words = "Approve the pilot today.";
const recordingUrl = "https://media.example/take.mp3";
const video = "https://media.example/demo.mp4";
const suggestion = {
  id: "pick", start: 0, end: words.length, quote: words, status: "pending", kind: "advice",
  snippetId: reference.snippet_id, takeSessionId: reference.take_session_id, snippetAudioRef: recordingUrl,
  bookmarkTier: "weak", walkSlot: "weakest", oneFix: "moment", openCard: "exercise", practicePrompt: true,
  evidence: {}, practiceExercise: {
    exerciseId: "land-the-stop", version: 1, title: "Land the full stop",
    instruction: "Pause after the request.", explanationVideoRef: video,
  },
};

let container: HTMLDivElement;
let root: Root;

function button(text: string) {
  return [...container.querySelectorAll("button")].find((item) => item.textContent === text);
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
  api.clip.mockResolvedValue({
    kind: "response", ok: true,
    body: { arc_id: reference.arc_id, audio_url: recordingUrl, start_offset_ms: 1000, duration_ms: 3000, take_index: 2 },
  });
  api.document.mockResolvedValue({
    kind: "single", latestTakeSessionId: reference.take_session_id, ideal: { text: words }, suggestions: [suggestion],
  });
  api.tempo.mockResolvedValue(null);
  api.practiceOn.mockResolvedValue(true);
  api.steps.mockResolvedValue([]);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  vi.unstubAllGlobals();
});

it("plays a cited moment and opens its served exercise right in chat", async () => {
  const caption = "Slow down before asking for the decision.";
  await act(async () => root.render(<TakeConversationMessage standalone project="project" message={{
    role: "bot", kind: "text", body: caption, client_id: "reply", client_created_at: "",
    metadata: { coach_moment: reference },
  }} />));
  expect(api.clip).toHaveBeenCalledWith("/api/v2/user/lounge/moment/moment?take_session_id=take-2", { cache: "no-store" });
  const bubble = container.querySelector("[data-bubble]");
  expect(bubble?.querySelector("audio")?.src).toBe(recordingUrl);
  expect(bubble?.querySelector("video")?.src).toBe(video);
  expect(bubble?.textContent).toContain(caption);
  expect(bubble?.textContent).toContain("Pause after the request.");
  expect(container.querySelector("[data-chat-artifact-preview]")).toBeNull();
  expect(container.querySelector("[data-practice]")).toBeNull();
  expect(button("Practise")).toBeDefined();
  await act(async () => button("Practise")?.click());
  expect(api.steps).toHaveBeenCalledWith("project", "take-2");
  expect(JSON.parse(container.querySelector<HTMLElement>("[data-practice]")?.dataset.practice ?? "null"))
    .toEqual({ practise: true, take: "take-2", snippet: "moment", practiceKey: "exVideo:land-the-stop:1" });
});

it("keeps the clip when the served intervention is for another moment", async () => {
  await act(async () => root.render(<CoachMoment reference={{ ...reference, snippet_id: "other" }} />));
  expect(container.querySelector("[data-coach-moment]")).not.toBeNull();
  expect(container.querySelector("[data-coach-intervention]")).toBeNull();
});

it("omits an unauthorized fragment and never looks up its practice", async () => {
  api.clip.mockResolvedValue({ kind: "response", ok: false, status: 404 });
  await act(async () => root.render(<CoachMoment reference={reference} />));
  expect(container.querySelector("[data-coach-moment]")).toBeNull();
  expect(api.document).not.toHaveBeenCalled();
});

it("replays the saved attempt for the cited moment", async () => {
  api.steps.mockResolvedValue(["moment", "other"].map((snippet, i) => ({
    client_id: `row-${i}`, role: "user", kind: "walk_step",
    body: snippet === "moment" ? "My own retry" : "Another moment's retry",
    metadata: { step: "try:exercise", snippet_id: snippet },
  })));
  await act(async () => root.render(<CoachMoment reference={reference} includeHistory />));
  expect(container.textContent).toContain("My own retry");
  expect(container.textContent).not.toContain("Another moment's retry");
});

it("saves an explicit wording choice before showing it as output", async () => {
  const rewrite = {
    ...suggestion, kind: "replace", openCard: "rewrite", practiceExercise: null,
    feedbackFamily: "rewrite_clarity", proposedText: "Please approve the pilot by Friday.",
  };
  api.document.mockResolvedValue({
    kind: "single", latestTakeSessionId: reference.take_session_id, ideal: { text: words }, suggestions: [rewrite],
  });
  api.decision.mockResolvedValueOnce("error").mockResolvedValueOnce("ok");
  await act(async () => root.render(<CoachMoment reference={reference} />));
  expect(container.querySelector("[data-coach-moment-output]")).toBeNull();
  expect(button("Use this wording")).toBeTruthy();
  await act(async () => button("Use this wording")?.click());
  expect(api.decision).toHaveBeenCalledWith("project", rewrite, "accept");
  expect(container.querySelector("[data-coach-moment-output]")).toBeNull();
  await act(async () => button("Use this wording")?.click());
  expect(container.querySelector("[data-coach-moment-output]")?.textContent).toContain(rewrite.proposedText);
});

it.each([
  ["rushed", "You rushed here. Let it breathe."],
  ["slow", "You slowed down here. Keep it moving."],
])("shows the served Sniper instructions for %s", async (reading, instruction) => {
  api.document.mockResolvedValue({
    kind: "single", latestTakeSessionId: reference.take_session_id, ideal: { text: words },
    suggestions: [{ ...suggestion, oneFix: "tempo", practiceExercise: null }],
  });
  api.tempo.mockResolvedValue({ reading, snippetId: reference.snippet_id, planLevel: "Pace", topic: "the pilot",
    said: { before: "", stretch: words, after: "" } });
  await act(async () => root.render(<CoachMoment reference={reference} />));
  const exercise = container.querySelector("[data-coach-intervention]");
  expect(exercise?.textContent).toContain("Sniper");
  expect(exercise?.textContent).toContain(instruction);
  await act(async () => button("Practise")?.click());
  expect(container.querySelector("[data-coach-moment] [data-practice]")).not.toBeNull();
});

it("plays a supplied AI example beside the recording", async () => {
  const demo = "https://media.example/example.mp3";
  api.ai.mockResolvedValue({ demo: "ai_voice", clip: { state: "ready", url: demo, durationMs: 2000 } });
  await act(async () => root.render(<TakeConversationMessage message={{
    role: "bot", kind: "text", body: "Let the request land.", client_id: "reply", client_created_at: "",
    metadata: { coach_moment: { ...reference, practise: false }, ai_voice: { practice_id: "served-example" } },
  }} />));
  const bubble = container.querySelector("[data-bubble]");
  expect(bubble?.textContent).toContain("Let the request land.");
  expect(Array.from(bubble?.querySelectorAll("audio") ?? [], (node) => node.src)).toEqual([recordingUrl, demo]);
});

it("drops the automatic transcript footer while keeping ordinary chat text", () => {
  const transcript = "https://willpowerlab.com/chat/take/12345678-1234-5678-1234-567812345678?slide=1";
  const answer = "The pause gives your point room.";
  expect(withoutCoachTranscriptFooter(`${answer}\n\nTranscript ${transcript}`)).toBe(answer);
  expect(withoutCoachTranscriptFooter(`You can open ${transcript} from your recording.`))
    .toBe(`You can open ${transcript} from your recording.`);
});
