// @vitest-environment jsdom
/*
STORY    As a speaker, I want the coach to play the fragment it cites and
         present the exercise for that moment in my chat.
OUTCOME  O1  An authorized clip plays beside the served exercise and opens practice in place.
         O2  An exercise for another moment stays out of the reply.
         O3  An unavailable clip stays out of the reply.
         O4  Older automatic transcript footers disappear while normal text stays.
         O5  A compact reply reopens only the practice saved for its own moment.
         O6  The rewrite becomes an output only after the speaker's choice is saved.
PROVES   O1 -> "plays a cited moment and opens its served exercise right in chat"
         O2 -> "keeps the clip when the served intervention is for another moment"
         O3 -> "omits an unauthorized fragment and never looks up its practice"
         O4 -> "drops the automatic transcript footer while keeping ordinary chat text"
         O5 -> "reopens the saved attempt for the cited moment"
         O6 -> "saves an explicit wording choice before showing it as output"
*/
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import CoachMoment from "./CoachMoment";
import { withoutCoachTranscriptFooter } from "./willabHelpers";

const api = vi.hoisted(() => ({
  clip: vi.fn(), document: vi.fn(), tempo: vi.fn(), practiceOn: vi.fn(), steps: vi.fn(), decision: vi.fn(),
}));
vi.mock("@/lib/api/bffFetch", () => ({ bffFetch: api.clip }));
vi.mock("@/services/api/idealText", () => ({ fetchIdealText: api.document }));
vi.mock("@/services/api/consentChoices", () => ({ readPractiseOffered: api.practiceOn }));
vi.mock("@/services/api/reviewTempo", () => ({ fetchReviewTempo: api.tempo }));
vi.mock("@/services/api/takeReview", () => ({ readReviewSteps: api.steps }));
vi.mock("@/lib/willab/idealTextDecisions", () => ({ postTrackedDecision: api.decision }));
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

async function openArtifact() {
  const preview = container.querySelector<HTMLButtonElement>("[data-chat-artifact-preview]");
  expect(preview).toBeTruthy();
  await act(async () => preview?.click());
}

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
  await act(async () => root.render(<CoachMoment raw={reference} project="project" />));
  expect(api.clip).toHaveBeenCalledWith("/api/v2/user/lounge/moment/moment?take_session_id=take-2", { cache: "no-store" });
  expect(container.querySelector("audio")).toBeNull();
  await openArtifact();
  expect(container.querySelector("audio")?.src).toBe(recordingUrl);
  expect(container.querySelector("video")?.src).toBe(video);
  expect(container.textContent).toContain("Pause after the request.");
  expect(container.querySelector("[data-practice]")).toBeNull();
  expect(button("Practise")).toBeDefined();
  await act(async () => button("Practise")?.click());
  expect(api.steps).toHaveBeenCalledWith("project", "take-2");
  expect(JSON.parse(container.querySelector<HTMLElement>("[data-practice]")?.dataset.practice ?? "null"))
    .toEqual({ practise: true, take: "take-2", snippet: "moment", practiceKey: "exVideo:land-the-stop:1" });
});

it("keeps the clip when the served intervention is for another moment", async () => {
  await act(async () => root.render(<CoachMoment raw={{ ...reference, snippet_id: "other" }} />));
  expect(container.querySelector("[data-coach-moment]")).not.toBeNull();
  await openArtifact();
  expect(container.querySelector("[data-coach-intervention]")).toBeNull();
});

it("omits an unauthorized fragment and never looks up its practice", async () => {
  api.clip.mockResolvedValue({ kind: "response", ok: false, status: 404 });
  await act(async () => root.render(<CoachMoment raw={reference} />));
  expect(container.querySelector("[data-coach-moment]")).toBeNull();
  expect(api.document).not.toHaveBeenCalled();
});

it("reopens the saved attempt for the cited moment", async () => {
  api.steps.mockResolvedValue(["moment", "other"].map((snippet, i) => ({
    client_id: `row-${i}`, role: "user", kind: "walk_step",
    body: snippet === "moment" ? "My own retry" : "Another moment's retry",
    metadata: { step: "try:exercise", snippet_id: snippet },
  })));
  await act(async () => root.render(<CoachMoment raw={reference} />));
  await openArtifact();
  expect([...container.querySelectorAll("[data-artifact-section]")].map((node) =>
    node.getAttribute("data-artifact-section"))).toEqual(["moment", "intervention", "output"]);
  expect(container.textContent).toContain("My own retry");
  expect(container.textContent).not.toContain("Another moment's retry");
  await act(async () => button("Minimise")?.click());
  expect(document.activeElement?.hasAttribute("data-chat-artifact-preview")).toBe(true);
  expect(container.textContent).toContain("Saved practice");
  await openArtifact();
  expect(container.textContent).toContain("My own retry");
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
  await act(async () => root.render(<CoachMoment raw={reference} />));
  await openArtifact();
  expect(container.querySelector("[data-artifact-section='output']")).toBeNull();
  expect(button("Use this wording")).toBeTruthy();
  await act(async () => button("Use this wording")?.click());
  expect(api.decision).toHaveBeenCalledWith("project", rewrite, "accept");
  expect(container.querySelector("[data-artifact-section='output']")).toBeNull();
  await act(async () => button("Use this wording")?.click());
  expect(container.querySelector("[data-artifact-section='output']")?.textContent).toContain(rewrite.proposedText);
});

it("drops the automatic transcript footer while keeping ordinary chat text", () => {
  const transcript = "https://willpowerlab.com/chat/take/12345678-1234-5678-1234-567812345678?slide=1";
  const answer = "The pause gives your point room.";
  expect(withoutCoachTranscriptFooter(`${answer}\n\nTranscript ${transcript}`)).toBe(answer);
  expect(withoutCoachTranscriptFooter(`You can open ${transcript} from your recording.`))
    .toBe(`You can open ${transcript} from your recording.`);
});
