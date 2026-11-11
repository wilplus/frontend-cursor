// @vitest-environment jsdom
/*
STORY    As a person in ring 6, I want to start a model of my own one step at a
         time, in three chapters with a thin bar, keep my draft when I stop,
         be told when a model like mine exists, shape what it does, its
         scale, its question, its AI, its rules, my data, its exam, its
         teachers' journey, answer its first 10 myself and share it; then see
         on its page what needs me; and answer an invite, add an example and
         act on my models from my profile, all in the backend's words, so
         what I know becomes a model without any screen adding words of its
         own (backend N528, N563, N566, N570, N571, N582, N585; App Model
         MOD-20, MOD-21, MOD-24 to MOD-38, MOD-49 to MOD-51, MOD-54, MOD-55).
OUTCOME
  O1  Each story's Then holds with the backend's exact words: the BFF answers
      with what services/model_setup.py and services/model_launchpad.py
      build (setupFixtures.json, made by running them).
  O2  Each answer reaches the backend in the shape its handler reads
      (services/model_setup_store.py, model_launchpad_store.py).
  O3  Every way in hides while its route answers 404: "Start your own", an
      invite, a profile's actions.
  O4  The owner's first 10 are answered on the teachers' screen with no
      guess of the model's (Never 2).
PROVES   O1, O2 -> one test per story, named by its id
         O3 -> "… 404 …"
         O4 -> "MOD-55 …"
WHY      The setup's routes (backend #1867) and the launchpad's actions
         (#1869) may reach production after this; nothing shows before they
         answer.
*/
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import S from "./setupFixtures.json";
import F from "./modelsFixtures.json";
import A from "./modelApiFixtures.json";

type Call = { path: string; method: string; json: unknown; body: unknown };
type Reply = { status: number; body: unknown };
type Answer = unknown | ((call: Call) => unknown);
const bff = vi.hoisted(() => ({ routes: {} as Record<string, unknown>, calls: [] as Call[] }));
vi.mock("@/lib/api/bffFetch", () => ({
  bffFetch: vi.fn(async (path: string, init?: { method?: string; json?: unknown; body?: unknown }) => {
    const call = { path, method: init?.method ?? "GET", json: init?.json, body: init?.body };
    bff.calls.push(call);
    const answer = bff.routes[`${call.method} ${path.split("?")[0]}`];
    if (answer === undefined) return { kind: "response", ok: false, status: 404, body: { code: "NOT_FOUND" } };
    const got = typeof answer === "function" ? (answer as (c: Call) => unknown)(call) : answer;
    const reply = got && typeof got === "object" && "status" in got && "body" in got ? (got as Reply) : { status: 200, body: got };
    return { kind: "response", ok: reply.status < 400, status: reply.status, body: reply.body };
  }),
}));
vi.mock("@/lib/supabase/session", () => ({ readSession: async () => ({ user: { id: "marta" } }) }));

import ModelsOverlay from "./ModelsOverlay";
import ProfileModels from "./ProfileModels";
import { answerSpoken } from "@/services/api/models";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  bff.calls = [];
  bff.routes = {};
  container = document.createElement("div");
  container.className = "relative";
  document.body.appendChild(container);
  root = createRoot(container);
});
afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

function serve(routes: Record<string, Answer>) {
  bff.routes = routes as Record<string, unknown>;
}
const flush = () =>
  act(async () => {
    for (let i = 0; i < 20; i += 1) await new Promise((r) => setTimeout(r, 0));
  });
const text = () => container.textContent ?? "";
async function render(el: Parameters<Root["render"]>[0]) {
  await act(async () => root.render(el));
  await flush();
}
function button(label: string): HTMLButtonElement {
  const found = [...container.querySelectorAll("button")].find((b) => b.textContent?.trim() === label);
  if (!found) throw new Error(`no button "${label}" in: ${text()}`);
  return found as HTMLButtonElement;
}
const has = (label: string) => [...container.querySelectorAll("button")].some((b) => b.textContent?.trim() === label);
async function tap(label: string) {
  await act(async () => button(label).click());
  await flush();
}
async function tapEl(el: Element | null) {
  if (!el) throw new Error(`no element in: ${text()}`);
  await act(async () => (el as HTMLElement).click());
  await flush();
}
async function type(el: HTMLInputElement | HTMLTextAreaElement, value: string) {
  const proto = el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
  await act(async () => {
    Object.getOwnPropertyDescriptor(proto, "value")!.set!.call(el, value);
    el.dispatchEvent(new Event("input", { bubbles: true }));
  });
}
async function choose(input: HTMLInputElement, file: File) {
  await act(async () => {
    Object.defineProperty(input, "files", { value: [file], configurable: true });
    input.dispatchEvent(new Event("change", { bubbles: true }));
  });
  await flush();
  await flush();
}
const posted = (suffix: string) => bff.calls.filter((c) => c.method === "POST" && c.path.endsWith(suffix)).map((c) => c.json);
const expectWords = (words: string[]) => words.forEach((w) => expect(text()).toContain(w));

/** The list with its draft, and the setup's routes as the backend answers. */
const LIST = { "GET /api/v2/models": F.list };
const SETUP = "/api/v2/models/pitch/setup";
async function openList(routes: Record<string, Answer>) {
  serve({ ...LIST, ...routes });
  await render(createElement(ModelsOverlay, { start: { at: "list" }, queueTitle: "Your queue", onClose: () => {} }));
}
/** The setup opened on one step, through the draft's Continue. */
async function openStep(step: keyof typeof S, routes: Record<string, Answer> = {}) {
  await openList({ [`GET ${SETUP}`]: S[step], ...routes });
  await tap("Continue");
}

describe("starting a model: Describe (MOD-24 to MOD-26, MOD-54)", () => {
  it("MOD-24: \"Start your own\" opens \"Describe · 1 of 3\" with the chapters and a thin bar, one question per screen", async () => {
    await openList({
      "POST /api/v2/models/setup": S.begin,
      "POST /api/v2/models/pitch/setup/problem": S.today,
      "POST /api/v2/models/pitch/setup/today": S.teach,
    });
    await tap("Start your own");
    expectWords(["Describe · 1 of 3", "Describe", "Shape", "Share", "What problem should your model solve?"]);
    expect(container.querySelector("[data-setup-bar]")?.getAttribute("data-setup-bar")).toBe(String(S.begin.screen.bar));
    expect(button("Next").disabled).toBe(true);
    await type(container.querySelector("textarea")!, "Founders rush their pitch.");
    await tap("Next");
    expect(posted("/setup/problem")).toEqual([{ value: "Founders rush their pitch." }]);
    expectWords(["How do you solve it today?"]);
    expect(text()).not.toContain("What problem should your model solve?");
    await tap("Next");
    expectWords(["Describe · 3 of 3", "How will you teach your model?"]);
  });

  it("MOD-54: after a first Take the setup opens filled from its answers, with \"Filled from your first Take. Change any word.\"", async () => {
    await openList({ "POST /api/v2/models/setup": S.beginFilled });
    await tap("Start your own");
    expect(container.querySelector("textarea")!.value).toBe("I coach founders on their pitch.");
    expectWords(["Filled from your first Take. Change any word."]);
  });

  it("N636-7 one way to start a model: with the blocks, \"Start your own\" opens them, \"Teach it\" starts the model once and opens its first 10; a draft's Continue keeps the three chapters", async () => {
    const MADE = "/api/v2/models/blocky";
    serve({
      ...LIST,
      "POST /api/v2/models/setup/blocks": { ...S.begin, model_id: "blocky" },
      [`GET ${MADE}/setup/first-ten`]: { ...S.first10, model_id: "blocky" },
      [`GET ${SETUP}`]: S.scale,
    });
    await render(createElement(ModelsOverlay, { start: { at: "list" }, queueTitle: "Your queue", blocks: true, onClose: () => {} }));
    await tap("Start your own");
    expectWords(["Your own model answers one question the way you would."]);
    await tap("Train my own");
    await tap("A pick from a list");
    await tap("GPT");
    // Outside a chat there is no suggested question: typed in Will's chat first.
    expectWords(["What should it spot? Write it as a question."]);
    await type(container.querySelector("textarea")!, "Does the pitch rush");
    await act(async () => container.querySelector("form")!.requestSubmit());
    await flush();
    expectWords(["What should it notice?", "Does the pitch rush?"]);
    await tap("Change");
    await tap("Keep");
    expect([...container.querySelectorAll("[data-model-stack] > *")].map((b) => b.textContent)).toEqual([
      "Does the pitch rush?", "It gives back a pick from a list", "Built on GPT", "Taught by you",
    ]);
    expect(posted("/setup/blocks")).toEqual([]);
    await tap("Teach it");
    expect(posted("/setup/blocks")).toEqual([{ question: "Does the pitch rush?", answers: ["Yes", "Not sure", "No"], gives: "pick", base: "gpt" }]);
    expect(posted("/api/v2/models/setup")).toEqual([]);
    expectWords(["Now answer the first 10 yourself"]);
  });

  it("N636-7 a draft begun in the three chapters still continues there, with the blocks", async () => {
    serve({ ...LIST, [`GET ${SETUP}`]: S.scale });
    await render(createElement(ModelsOverlay, { start: { at: "list" }, queueTitle: "Your queue", blocks: true, onClose: () => {} }));
    await tap("Continue");
    expectWords(["Shape · 2 of 11"]);
  });

  it("MOD-24 (404): below the ring, or before the setup's routes, \"Start your own\" hides itself", async () => {
    await openList({});
    await tap("Start your own");
    expect(has("Start your own")).toBe(false);
    expect(container.querySelector('[data-testid="model-setup"]')).toBeNull();
  });

  it("MOD-25: ✕ keeps the draft: back on the list, \"Your draft\", \"You stopped at the scale. Nothing is lost.\" and \"Continue\" opens it there", async () => {
    await openStep("scale");
    expectWords(["Shape · 2 of 11", "One example is a pitch clip of about 30 seconds."]);
    await tapEl(container.querySelector('[data-testid="model-setup"] button[aria-label]:not([data-walk-back])'));
    expect(container.querySelector('[data-testid="model-setup"]')).toBeNull();
    expectWords(["Your draft", "You stopped at the scale. Nothing is lost.", "Continue"]);
    await tap("Continue");
    expectWords(["Shape · 2 of 11"]);
  });

  it("MOD-26: \"A model like yours already exists\": the model's card, \"Teach this one\" and \"Set up mine anyway\"", async () => {
    await openStep("teach", { "POST /api/v2/models/pitch/setup/teach": (c: Call) => ((c.json as { anyway?: boolean }).anyway ? S.kind : S.similar) });
    await tap("Next");
    expectWords([
      "A model like yours already exists",
      "Pitch feedback for founders",
      "Started by Northwind Studio",
      "If you teach it, it learns faster, and you share what it earns.",
      "Teach this one",
      "Set up mine anyway",
    ]);
    await tap("Set up mine anyway");
    expect(posted("/setup/teach")[1]).toMatchObject({ anyway: true });
    expectWords(["From your answers, your model will do three things. Untick what it should not do."]);
  });

  it("MOD-26: \"Teach this one\" goes to that model's door", async () => {
    await openStep("similar", { "GET /api/v2/models/pitchns": F.page, "GET /api/v2/models/door": F.door });
    await tap("Teach this one");
    expectWords(["Before you teach", "This is my field"]);
  });

  it("a refused answer shows the backend's reason in its words and stays on the step", async () => {
    await openStep("today", { "POST /api/v2/models/pitch/setup/today": { status: 400, body: { code: "EMPTY", error: "Write a few words first." } } });
    await tap("Next");
    expectWords(["Write a few words first.", "How do you solve it today?"]);
  });
});

describe("starting a model: Shape (MOD-27 to MOD-33, MOD-38, MOD-55)", () => {
  it("MOD-27: the app proposes three things and the founder unticks one; \"That’s right\" sends the parts and the name", async () => {
    await openStep("kind", { "POST /api/v2/models/pitch/setup/kind": S.scale });
    expectWords([
      "From your answers, your model will do three things. Untick what it should not do.",
      "It gives a score on a scale",
      "It picks from a list",
      "It learns to answer like you",
      "Its name",
    ]);
    await tapEl(container.querySelector('[data-setup-choice="pick"]'));
    await tap("That’s right");
    expect(posted("/setup/kind")).toEqual([{ parts: { score: true, pick: false, answer: true }, name: "Pitch Coach" }]);
  });

  it("MOD-28: one example and a scale with a word for every point; \"Start with this, finish the rest later\" starts it there", async () => {
    await openStep("scale", { "POST /api/v2/models/pitch/setup/start-now": S.ready });
    expectWords([
      "One example is a pitch clip of about 30 seconds. Your teachers will rate each clip on this scale.",
      "Clear words for each point help your teachers agree. When they agree, the model learns faster.",
      "Use this scale",
      "Start with this, finish the rest later",
    ]);
    const words = [...container.querySelectorAll<HTMLInputElement>("[data-setup-scale] input")].map((i) => i.value);
    expect(words.slice(0, 2)).toEqual(["Calm", "Every sentence lands."]);
    expect(words[8]).toBe("Racing");
    await type(container.querySelectorAll<HTMLInputElement>("[data-setup-scale] input")[0], "");
    expect(button("Use this scale").disabled).toBe(true);
    await type(container.querySelectorAll<HTMLInputElement>("[data-setup-scale] input")[0], "Calm");
    await tap("Start with this, finish the rest later");
    expect((posted("/setup/start-now")[0] as { scale: unknown[] }).scale).toHaveLength(5);
    expectWords(["Pitch Coach is ready to learn. Today it answers from your starting rules and examples."]);
  });

  it("MOD-38: the teachers' question drafted from the answers, its list of at least two, \"Use this question\"", async () => {
    await openStep("question", { "POST /api/v2/models/pitch/setup/question": S.ai });
    expectWords([
      "Your teachers will be asked this about each clip. We wrote it from your answers; change any word.",
      "They pick from this list. Write each option your teachers may choose.",
      "Add an option",
      "Clear words help your teachers agree, and the same words let one answer count for every model that asks it.",
    ]);
    await tap("Use this question");
    expect(posted("/setup/question")[0]).toMatchObject({ question: "How rushed does it sound?", options: ["Slow the ending", "Pause before the ask"] });
  });

  it("MOD-29: each part gets the AI that fits it; GPT-4o, Mistral and Llama say \"Soon\"", async () => {
    await openStep("ai");
    expectWords([
      "Each part of your model needs a different kind of AI. We chose one for each.",
      "WillpowerLab’s voice scorer: it learns from how the voice sounds, not only from the words",
      "GPT-4o mini, choosing only from your list",
      "Other AIs to answer like you:",
      "GPT-4o",
      "Mistral",
      "Llama",
      "Soon",
    ]);
  });

  it("MOD-30: a study's rules, each with its source; \"Use these rules\" keeps the ticked ones, \"Skip\" keeps none", async () => {
    await openStep("rules", { "POST /api/v2/models/pitch/setup/study": S.rules, "POST /api/v2/models/pitch/setup/rules": S.data });
    expectWords([
      "Shape · 5 of 11",
      "Optional",
      "Do you have research your model should start from? It will work from day one on the rules you keep.",
      "pitch-pace-study.pdf",
      "A pitch faster than 170 words a minute sounds rushed.",
      "From pitch-pace-study.pdf, page 4",
      "A study’s numbers may not fit your speakers. We check each rule against your teachers’ first 50 ratings. If they disagree with a rule, we stop using it and tell you why.",
    ]);
    await choose(container.querySelector("[data-setup-file-input]")!, new File(["A study"], "study.pdf", { type: "application/pdf" }));
    expect(bff.calls.some((c) => c.path.endsWith("/setup/study") && c.body instanceof FormData)).toBe(true);
    await tap("Use these rules");
    expect(posted("/setup/rules")[0]).toMatchObject({ use: true, on: [true], strictness: "clear" });
  });

  it("TRIAL-DATA: I don't have any goes on with the step's answer, never an upload; the relay's own error never reaches the screen", async () => {
    await openStep("data", {
      "POST /api/v2/models/pitch/setup/data": (c: Call) =>
        c.body instanceof FormData ? { status: 400, body: { code: "INVALID_MULTIPART", error: "Invalid multipart payload." } } : S.exam,
    });
    await tap("I don’t have any");
    const sent = bff.calls.filter((c) => c.method === "POST" && c.path.endsWith("/setup/data"));
    expect(sent.map((c) => c.json)).toEqual([{}]);
    expect(sent.some((c) => c.body instanceof FormData)).toBe(false);
    expect(text()).not.toContain("Invalid multipart payload.");
    expect(container.querySelector("[data-setup-step]")?.getAttribute("data-setup-step")).toBe("exam");
    // An upload the relay could not read: nothing raw on the screen, the step stays.
    act(() => root.unmount());
    root = createRoot(container);
    await openStep("data", {
      "POST /api/v2/models/pitch/setup/data": { status: 400, body: { code: "INVALID_MULTIPART", error: "Invalid multipart payload." } },
    });
    await choose(container.querySelector("[data-setup-file-input]")!, new File(["a,b"], "pitch-ratings.csv", { type: "text/csv" }));
    expect(text()).not.toContain("Invalid multipart payload.");
    expect(container.querySelector("[data-setup-refused]")).toBeNull();
    expect(container.querySelector("[data-setup-step]")?.getAttribute("data-setup-step")).toBe("data");
  });

  it("MOD-31: the upload: map its columns, a name column left out, then the check, and \"Upload it\" only with the tick", async () => {
    await openStep("data", {
      "POST /api/v2/models/pitch/setup/data": S.columns,
      "POST /api/v2/models/pitch/setup/columns": S.check,
      "POST /api/v2/models/pitch/setup/check": S.exam,
    });
    expectWords(["Do you already have examples of this work? Upload them, and your model starts with more than rules."]);
    await choose(container.querySelector("[data-setup-file-input]")!, new File(["a,b"], "pitch-ratings.csv", { type: "text/csv" }));
    expectWords([
      "Tell us what each column holds. We guessed; change any that are wrong.",
      "→ The example: a pitch clip of about 30 seconds",
      "→ The score on your scale, 1 to 5",
      "speaker_name",
      "→ Left out: it names a person",
    ]);
    await tap("That’s right");
    expect((posted("/setup/columns")[0] as { map: { col: string; role: string }[] }).map).toContainEqual({ col: "speaker_name", role: "out" });
    expectWords([
      "We checked your data.",
      "Rows we can use",
      "Repeats removed",
      "Near repeats removed",
      "Rows with no score, skipped",
      "Rows that look mislabelled",
      "Names and places removed",
      "Before your data counts, your teachers re-rate 60 of its examples.",
      "None of it goes into the final exam, which stays new.",
      "I have the right to use this data, and the people in it agreed to its use for training.",
    ]);
    expect(button("Upload it").disabled).toBe(true);
    await tapEl(container.querySelector('[data-setup-choice="consent"]'));
    await tap("Upload it");
    expect(posted("/setup/check")).toEqual([{ consent: true }]);
  });

  it("MOD-32: two experts set aside the final exam; picking Daniel makes it \"Ask Daniel\"", async () => {
    await openStep("exam", { "POST /api/v2/models/pitch/setup/exam": S.journey });
    expectWords([
      "Before anyone teaches it, two experts set aside a final exam: 100 clips your model never learns from.",
      "It can be sold only when it does clearly better on this exam than it does today.",
      "You",
      "Owner",
      "Daniel Okafor",
    ]);
    expect(button("Choose the second expert").disabled).toBe(true);
    await tapEl(container.querySelector('[data-setup-choice="daniel"]'));
    await tap("Ask Daniel");
    expect(posted("/setup/exam")).toEqual([{ expert: "daniel" }]);
  });

  it("MOD-33: the teachers' journey, \"Shorter\", \"Longer\" and \"Looks good\"", async () => {
    await openStep("journey", { "POST /api/v2/models/pitch/setup/journey": (c: Call) => ((c.json as { change?: string }).change ? S.journey : S.first10) });
    expectWords(["Here is what each teacher will do. Make it shorter or longer.", "Listen to a pitch clip of about 30 seconds", "Shorter", "Longer"]);
    await tap("Shorter");
    await tap("Looks good");
    expect(posted("/setup/journey")).toEqual([{ change: "shorter" }, {}]);
  });

  it("MOD-55: the founder answers the first 10 on the teachers' screen, with no guess of the model's; none goes into the exam", async () => {
    await openStep("first10", {
      "GET /api/v2/models/pitch/setup/first-ten": S.first10Teach,
      "POST /api/v2/models/pitch/setup/first-ten/ex1": S.first10Done,
    });
    expectWords([
      "Now answer the first 10 yourself, the way your teachers will.",
      "Your model reads your answers from today, so it answers like you from the start. Each one trains it once another teacher agrees with you.",
      "None of these 10 goes into the final exam.",
      "Do it later",
    ]);
    await tap("Start");
    expectWords(["Your first 10 · 1 of 10", "So our ask is two million and we close in March", "How rushed does it sound?"]);
    expect(text()).not.toMatch(/machine|guess/i);
    await tapEl(container.querySelector('[data-model-answer="Rushed"]'));
    expect(posted("/setup/first-ten/ex1")).toEqual([{ step: "rate", answer: "Rushed" }]);
    expectWords(["You answered your first 10."]);
  });
});

describe("starting a model: Share, ready, the owner's page (MOD-34 to MOD-37)", () => {
  it("MOD-34: Public first shows its disclaimer: \"Make it public\" or \"Keep it private\"", async () => {
    await openStep("share", { "POST /api/v2/models/pitch/setup/share": S.public, "POST /api/v2/models/pitch/setup/public": S.invite });
    expectWords(["Who can see your model?", "Private", "Only you and the people you invite", "Public", "Anyone can see it and teach it"]);
    await tapEl(container.querySelector('[data-setup-choice="public"]'));
    await tap("Next");
    expect(posted("/setup/share")).toEqual([{ visibility: "public" }]);
    expectWords([
      "Before you make it public",
      "Anyone will be able to see your model and teach it.",
      "Before anything reaches the company whose AI it uses, we remove names and places. Recordings never leave WillpowerLab.",
      "You can make it private again at any time. What it has learned stays.",
      "Keep it private",
    ]);
    await tap("Make it public");
    expect(posted("/setup/public")).toEqual([{ confirm: true }]);
  });

  it("MOD-35: \"Who should teach it with you?\": each person chosen is invited; \"Copy an invite link\" copies the owner's own chat link (N598)", async () => {
    const writeText = vi.fn(async () => undefined);
    Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true });
    await openList({
      [`GET ${SETUP}`]: { ...S.invite, screen: { ...S.invite.screen, chat_link: "/c/OwnLinkToken" } },
      "POST /api/v2/models/pitch/setup/invite": S.ready,
    });
    await tap("Continue");
    expectWords(["Who should teach it with you?", "Maya Lindqvist", "Head of Sales", "Invite them"]);
    await tap("Copy an invite link");
    expect(writeText).toHaveBeenCalledWith(`${window.location.origin}/c/OwnLinkToken`);
    expect(bff.calls.some((c) => c.path === "/api/v2/chats/link")).toBe(false);
    await tapEl(container.querySelector('[data-setup-choice="maya"]'));
    await tap("Invite them");
    expect(posted("/setup/invite")).toEqual([{ people: ["maya"] }]);
  });

  it("MOD-35 (N598): with no chat link yet, \"Copy an invite link\" makes it through GET /v2/chats/link; nothing is copied on a 404", async () => {
    const writeText = vi.fn(async () => undefined);
    Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true });
    await openStep("invite");
    await tap("Copy an invite link");
    expect(writeText).not.toHaveBeenCalled();
    bff.routes["GET /api/v2/chats/link"] = { token: "MadeNow", path: "/c/MadeNow" };
    await tap("Copy an invite link");
    expect(writeText).toHaveBeenCalledWith(`${window.location.origin}/c/MadeNow`);
  });

  it("MOD-36: ready to learn, \"To finish setting it up\" with each part, \"Sell it through an API\" locked, \"Back to the list\"", async () => {
    await openStep("ready");
    expectWords([
      "Pitch Coach is ready to learn. Today it answers from your starting rules and examples.",
      "To finish setting it up",
      "The scale",
      "Starting rules · optional",
      "Sell it through an API",
      "This opens once its first training beats today’s version on the final exam.",
      "It needs about 500 ratings from trusted teachers first.",
      "Back to the list",
    ]);
    // "Try it" waits for the model's code route (404 here).
    expect(has("Try it")).toBe(false);
    serve({ ...LIST, [`GET ${SETUP}`]: (c: Call) => (c.path.includes("step=rules") ? S.rules : S.ready) });
    await tap("Starting rules · optional");
    expect(bff.calls.some((c) => c.path === `${SETUP}?step=rules`)).toBe(true);
    expectWords(["Do you have research your model should start from?"]);
  });

  it("MOD-37: the owner's page: \"Needs you now\" on top, an honest range, how often teachers agree, the folds; \"Make those two clearer\" opens the scale", async () => {
    serve({
      "GET /api/v2/models/pitch": { ...F.pagePitch, owner: S.ownerPanel },
      [`GET ${SETUP}`]: S.scale,
    });
    await render(createElement(ModelsOverlay, { start: { at: "page", id: "pitch" }, queueTitle: "Your queue", onClose: () => {} }));
    expectWords([
      "Needs you now",
      "Your teachers disagree most between 3 (Hurried in places) and 4 (Rushed). Clearer words for those two points would help.",
      "The slowest jar decides: ratings from trusted teachers.",
      "How often your teachers agree",
      "Within one point 9 times in 10 · exactly 6 in 10",
      "Where its examples come from",
      "What runs by itself",
      "A fair exam",
    ]);
    const needs = container.querySelector("[data-model-needs]")!;
    expect(needs.compareDocumentPosition(container.querySelector("[data-model-summary]")!) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    await tap("Make those two clearer");
    expect(bff.calls.some((c) => c.path === `${SETUP}?step=scale`)).toBe(true);
    expectWords(["Use this scale"]);
  });
});

describe("the launchpad's actions (MOD-20, MOD-21, MOD-49, MOD-50, MOD-51)", () => {
  it("MOD-49: an invite stays with \"Not now\"; \"Open\" shows the door, and \"This is my field\" accepts it", async () => {
    await openList({
      "GET /api/v2/models/invites": S.invites,
      "GET /api/v2/models/door": F.door,
      "POST /api/v2/models/invites/inv1/accept": { status: "accepted", model_id: "speak" },
      "GET /api/v2/models/queue": { ...F.queue, examples: [] },
    });
    expectWords(["Maya invited you to teach Speaking confidence with them.", "You said not now. The invite stays here; open it whenever you like."]);
    await tap("Open");
    expectWords(["Before you teach"]);
    await tap("This is my field");
    expect(posted("/invites/inv1/accept")).toEqual([{}]);
    expect(posted("/speak/enter")).toEqual([]);
  });

  it("MOD-49 (N598): an accepted invite opens the inviter's own chat, where the teacher teaches", async () => {
    const assign = vi.fn();
    vi.stubGlobal("location", { ...window.location, origin: window.location.origin, assign });
    try {
      await openList({
        "GET /api/v2/models/invites": S.invites,
        "GET /api/v2/models/door": F.door,
        "POST /api/v2/models/invites/inv1/accept": { status: "accepted", model_id: "speak", chat_link: "/c/MayasLink" },
      });
      await tap("Open");
      await tap("This is my field");
      expect(assign).toHaveBeenCalledWith("/c/MayasLink");
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("MOD-49: \"Not now\" on an invite's door keeps it and goes back to the list", async () => {
    await openList({
      "GET /api/v2/models/invites": S.invites,
      "GET /api/v2/models/door": F.door,
      "POST /api/v2/models/invites/inv1/not-now": { status: "not_now", model_id: "speak" },
    });
    await tap("Open");
    await tap("Not now");
    expect(posted("/invites/inv1/not-now")).toEqual([{}]);
    expectWords(["Your draft"]);
  });

  it("MOD-49 (404): with no invites route, no invite is drawn", async () => {
    await openList({});
    expect(container.querySelector("[data-model-invite]")).toBeNull();
  });

  it("MOD-21: a teacher adds a written case, answers it, and is told \"It counts once another teacher agrees with your answer.\"", async () => {
    serve({
      "GET /api/v2/models/queue": F.queue,
      "POST /api/v2/models/rasp/examples": { example_id: "new1", note: S.words.add_counts_once },
      "GET /api/v2/models/rasp": F.pageRasp,
      "POST /api/v2/models/rasp/examples/new1/answer": { saved: true, note: S.words.add_counts_once, follow: [], trust: null },
    });
    await render(createElement(ModelsOverlay, { start: { at: "add" }, queueTitle: "Your queue", onClose: () => {} }));
    expectWords(["Do you know a case this model should learn from? Add it, then answer it yourself.", "For which model?", "Record one", "Upload a file"]);
    const record = [...container.querySelectorAll("button")].find((b) => b.textContent?.startsWith("Record one"))!;
    expect(record.disabled).toBe(true);
    await choose(container.querySelector("[data-model-add-file]")!, new File(["A client asks for a discount twice."], "case.txt", { type: "text/plain" }));
    expect(posted("/rasp/examples")).toEqual([{ text: "A client asks for a discount twice." }]);
    expectWords(["A client asks for a discount twice."]);
    const first = container.querySelector("[data-model-answer]")!;
    await tapEl(first);
    expect(posted("/rasp/examples/new1/answer")[0]).toMatchObject({ answer: first.getAttribute("data-model-answer") });
    // The recipe's next steps: a pick, then the words (Skip until a spoken
    // answer has its route).
    for (let i = 0; i < 3 && !text().includes("Keep teaching"); i += 1) {
      const next = container.querySelector("[data-model-answer]");
      if (next) await tapEl(next);
      else await tap("Skip");
    }
    expectWords(["It counts once another teacher agrees with your answer.", "Keep teaching"]);
  });

  it("MOD-20: a spoken answer reaches /answer as its transcript, on the \"words\" step", async () => {
    serve({ "POST /api/v2/models/speak/examples/e1/answer": { saved: true, note: null, follow: [], trust: null } });
    expect(await answerSpoken("speak", "e1", "Slow down before the ask.")).toMatchObject({ saved: true });
    expect(posted("/examples/e1/answer")).toEqual([{ step: "words", transcript: "Slow down before the ask." }]);
  });

  const PROFILE = {
    "GET /api/v2/models/profile/marta": { section: S.profile },
    [`GET ${SETUP}`]: (c: Call) => (c.path.includes("step=public") ? S.public : null),
    "GET /api/v2/models/pitch/download": A.download,
  };

  it("MOD-50: the profile lists the models she started and teaches, with \"Make public\", \"Archive\" and \"Download its data\"", async () => {
    serve(PROFILE);
    await render(createElement(ProfileModels));
    expectWords([
      "AI models",
      "Pitch Coach",
      "Private",
      "You started it · 36% of the way · 3 teachers",
      "Make public",
      "Archive",
      "Download its data",
      "Speaking confidence",
      "You teach it · 86 answers counted this month",
    ]);
  });

  it("MOD-50: \"Make public\" shows the disclaimer first and goes public only on \"Make it public\"", async () => {
    serve({ ...PROFILE, "POST /api/v2/models/pitch/make-public": { visibility: "public" } });
    await render(createElement(ProfileModels));
    await tap("Make public");
    expectWords(["Before you make it public", "Anyone will be able to see your model and teach it.", "Keep it private"]);
    expect(posted("/make-public")).toEqual([]);
    await tap("Make it public");
    expect(posted("/pitch/make-public")).toEqual([{ confirm: true }]);
  });

  it("MOD-50: \"Archive\" hides it and deletes nothing; the section is read again", async () => {
    serve({ ...PROFILE, "POST /api/v2/models/pitch/archive": { status: "archived" } });
    await render(createElement(ProfileModels));
    const reads = bff.calls.filter((c) => c.path.endsWith("/profile/marta")).length;
    await tap("Archive");
    expect(posted("/pitch/archive")).toEqual([{}]);
    expect(bff.calls.filter((c) => c.path.endsWith("/profile/marta")).length).toBe(reads + 1);
  });

  it("MOD-51: \"Download its data\" opens what it holds and the licence", async () => {
    serve(PROFILE);
    await render(createElement(ProfileModels));
    await tap("Download its data");
    expectWords(["You get your teachers’ ratings and answers.", "To sell a product built on it, you need a licence", "Download the data", "Not now"]);
  });

  it("MOD-50 (404): without the actions' routes the profile draws its models and no action", async () => {
    serve({ "GET /api/v2/models/profile/marta": { section: S.profile } });
    await render(createElement(ProfileModels));
    expectWords(["Pitch Coach"]);
    for (const a of ["Make public", "Download its data"]) expect(has(a)).toBe(false);
  });

  it("MOD-50: another person's profile reads their section by their id", async () => {
    serve({ "GET /api/v2/models/profile/kasia": { section: { ...S.profile, user_id: "kasia", models: [S.profile.models[1]] } } });
    await render(createElement(ProfileModels, { mine: false, userId: "kasia" }));
    expectWords(["Speaking confidence"]);
    expect(bff.calls.some((c) => c.path.endsWith("/profile/kasia"))).toBe(true);
  });
});
