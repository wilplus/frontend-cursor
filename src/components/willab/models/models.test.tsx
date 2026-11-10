// @vitest-environment jsdom
/*
STORY    As a person in ring 6, I want to find AI models under my chats, open
         one, come through its door and teach it from one queue, and see the
         models I started and teach on my profile, in the locked prototype's
         words, so that what I know teaches a model without the machine's
         guess ever leading me (backend N528, N563, N566; App Model MOD-02 to
         MOD-23, MOD-49, MOD-50). Below the ring nothing of it shows.
OUTCOME
  O1  Below ring 6 (every /v2/models route answers 404) no row, no section
      and no invite card is drawn.
  O2  Each story's Then holds with the backend's exact words (the BFF answers
      with what services/model_launchpad.py builds, modelsFixtures.json).
  O3  A teacher's screen asks for the queue and the model's recipe only:
      nothing of the machine's read is fetched or drawn, before or after an
      answer (Never 2).
PROVES   O1 -> "below the ring … nothing", "an invite … 404", "the profile … 404"
         O2 -> one test per story, named by its id
         O3 -> "MOD-09 …"
WHY      The App Model's stories are the contract the founder compares the
         code with (backend N574); the ring keeps the screens safe to merge
         before backend #1863 and its migration.
*/
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import F from "./modelsFixtures.json";

type Call = { path: string; method: string; json: unknown };
type Answer = unknown | ((call: Call) => unknown);
const bff = vi.hoisted(() => ({ routes: {} as Record<string, unknown>, calls: [] as { path: string; method: string; json: unknown }[] }));
vi.mock("@/lib/api/bffFetch", () => ({
  bffFetch: vi.fn(async (path: string, init?: { method?: string; json?: unknown }) => {
    const call = { path, method: init?.method ?? "GET", json: init?.json };
    bff.calls.push(call);
    const answer = bff.routes[`${call.method} ${path.split("?")[0]}`];
    if (answer === undefined) return { kind: "response", ok: false, status: 404, body: { code: "NOT_FOUND" } };
    const body = typeof answer === "function" ? (answer as (c: typeof call) => unknown)(call) : answer;
    return { kind: "response", ok: true, status: 200, body };
  }),
}));
vi.mock("@/lib/supabase/session", () => ({ readSession: async () => ({ user: { id: "marta" } }) }));

import ModelsChatRows from "./ModelsChatRows";
import ModelTeach from "./ModelTeach";
import ModelRelease from "./ModelRelease";
import ModelInviteCard from "./ModelInviteCard";
import ProfileModels from "./ProfileModels";
import { ModelListScreen } from "./ModelScreens";
import ChatList from "../chats/ChatList";
import { DATA_CONSENT_COPY } from "@/lib/legal/dataConsentCopy";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let container: HTMLDivElement;
let root: Root;

function serve(routes: Record<string, Answer>) {
  bff.routes = routes as Record<string, unknown>;
}
/** The page as the caller sees it: the public's until "This is my field",
 *  a teacher's (with its recipe) after. */
let joined = false;
const ALL: Record<string, Answer> = {
  "GET /api/v2/models/rows": { rows: F.rows },
  "GET /api/v2/models": (c: Call) => (c.path.includes("q=") ? F.empty : F.list),
  "GET /api/v2/models/what-do-i-get": F.what,
  "GET /api/v2/models/door": F.door,
  "GET /api/v2/models/speak": () => (joined ? F.pageSpeak : F.page),
  "GET /api/v2/models/rasp": F.pageRasp,
  "GET /api/v2/models/pitch": F.pagePitch,
  "GET /api/v2/models/queue": F.queue,
  "POST /api/v2/models/speak/enter": () => {
    joined = true;
    return { joined: true };
  },
};

beforeEach(() => {
  bff.calls = [];
  joined = false;
  serve({});
  container = document.createElement("div");
  container.className = "relative";
  document.body.appendChild(container);
  root = createRoot(container);
});
afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

const flush = () =>
  act(async () => {
    for (let i = 0; i < 20; i += 1) await new Promise((r) => setTimeout(r, 0));
  });
const wait = (ms: number) => act(async () => new Promise((r) => setTimeout(r, ms)));
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
async function tap(label: string) {
  await act(async () => button(label).click());
  await flush();
}
async function tapEl(el: Element | null) {
  await act(async () => (el as HTMLElement).click());
  await flush();
}
const posted = (suffix: string) => bff.calls.filter((c) => c.method === "POST" && c.path.endsWith(suffix));

/** The one queue, narrowed to some of its examples. */
function queueOf(ids: string[]) {
  return { ...F.queue, examples: F.queue.examples.filter((e) => ids.includes(e.id)) };
}
function teach(only: string | null, holdMs = 0) {
  joined = true;
  return createElement(ModelTeach, { only, onBack: () => {}, onClose: () => {}, onDone: vi.fn(), onList: vi.fn(), holdMs });
}

describe("the AI models: below the ring", () => {
  it("below the ring the rows, the profile's section and an invite draw nothing", async () => {
    await render(
      createElement("div", null, createElement(ModelsChatRows), createElement(ProfileModels), createElement(ModelInviteCard, { inviteId: "i1", onOpen: () => {} })),
    );
    expect(text()).toBe("");
    expect(bff.calls.map((c) => c.path)).toEqual(
      expect.arrayContaining(["/api/v2/models/rows", "/api/v2/models/profile/marta", "/api/v2/models/invites/i1"]),
    );
  });
});

describe("the AI models: meeting them (MOD-02 to MOD-07, MOD-12, MOD-13)", () => {
  it("MOD-02: the training yes is asked in Settings in its own words; the models' screens never ask it", async () => {
    expect(DATA_CONSENT_COPY.trainingTitle).toBe("Help improve WillpowerLab");
    expect(DATA_CONSENT_COPY.trainingOffTitle).toBe("Turn off training?");
    serve(ALL);
    await render(createElement(ModelsChatRows));
    await tapEl(container.querySelector('[data-chat-row="models"]'));
    await tapEl([...container.querySelectorAll('[data-testid="model-card"]')].find((c) => c.textContent?.includes("Speaking confidence"))!);
    await tap("Teach it");
    expect(text()).toContain("Before you teach");
    expect(text()).not.toContain("Help improve WillpowerLab");
  });

  it("MOD-03: a speaker who teaches none sees the \"AI models\" row like everyone, and no model's numbers", async () => {
    serve({ "GET /api/v2/models/rows": { rows: F.rowsNone } });
    await render(createElement(ModelsChatRows));
    expect(text()).toContain("AI models");
    expect(text()).toContain("Teach one, or start your own");
    expect(text()).not.toContain("Your queue");
    expect(text()).not.toMatch(/\d|teachers|agree/);
  });

  it("MOD-04: under the people, \"AI models\" with \"Teach one, or start your own\", and above it \"Your queue\" with \"12 examples wait · 3 models\"", async () => {
    serve(ALL);
    const chats = [{ id: "c1", kind: "team" as const, title: "Maya Lindqvist", subtitle: "Head of Sales", last: null }];
    await render(createElement(ChatList, { chats, modelsRows: createElement(ModelsChatRows), onOpenWill: () => {}, onOpen: () => {} }));
    const rows = [...container.querySelectorAll("[data-chat-row]")].map((r) => r.getAttribute("data-chat-row"));
    expect(rows.indexOf("c1")).toBeLessThan(rows.indexOf("models-queue"));
    expect(rows.indexOf("models-queue")).toBeLessThan(rows.indexOf("models"));
    const queue = container.querySelector('[data-chat-row="models-queue"]')!.textContent;
    expect(queue).toContain("Your queue");
    expect(queue).toContain("12 examples wait · 3 models");
    expect(container.querySelector('[data-chat-row="models"]')!.textContent).toContain("Teach one, or start your own");
  });

  it("MOD-05: the list, its filters, each model's \"Started by …\" and how far it is, the draft on top", async () => {
    serve(ALL);
    await render(createElement(ModelListScreen, { onClose: () => {}, onWhat: () => {}, onOpen: () => {}, onTeach: () => {} }));
    for (const w of [
      "Each model learns one skill from people who know it well. The ones furthest along are at the top.",
      "For you",
      "Ready to use",
      "Still learning",
      "Started by Artur",
      "62% of the way to its first training · 6 teachers",
      "Your draft",
      "You stopped at the scale. Nothing is lost.",
      "Continue",
    ])
      expect(text()).toContain(w);
    expect(text().indexOf("Your draft")).toBeLessThan(text().indexOf("Job interview coach"));
    expect(text().indexOf("Job interview coach")).toBeLessThan(text().indexOf("Speaking confidence"));
    await tap("Ready to use");
    expect(bff.calls.some((c) => c.path === "/api/v2/models?filter=ready")).toBe(true);
  });

  it("MOD-06: a public model's page in totals only, with \"Teach it\" and \"Try it\" (once its API answers)", async () => {
    serve({ ...ALL, "GET /api/v2/models/speak/code": { title: "", line: "", tabs: [], sure: "", actions: [] } });
    await render(createElement(ModelsChatRows));
    await tapEl(container.querySelector('[data-chat-row="models"]'));
    const card = [...container.querySelectorAll('[data-testid="model-card"]')].find((c) => c.textContent?.includes("Speaking confidence"));
    await tapEl(card!);
    expect(text()).toContain("Speaking confidence is 62% of the way to its first training. Six people teach it.");
    expect(button("Teach it")).toBeTruthy();
    expect(button("Try it")).toBeTruthy();
    expect(F.page).not.toHaveProperty("jars");
    expect(text()).not.toContain("exam_cases");
  });

  it("MOD-07: the door says \"Before you teach\" and its lines; \"This is my field\" joins the model", async () => {
    serve({ ...ALL, "GET /api/v2/models/queue": queueOf(["s0"]) });
    await render(createElement(ModelsChatRows));
    await tapEl(container.querySelector('[data-chat-row="models"]'));
    const card = [...container.querySelectorAll('[data-testid="model-card"]')].find((c) => c.textContent?.includes("Speaking confidence"));
    await act(async () => [...card!.querySelectorAll("button")].find((b) => b.textContent === "Teach it")!.click());
    await flush();
    for (const w of [
      "Before you teach",
      "Teach it only what you know well. If this is not your field, your answers would make it worse for all of us.",
      "It learns from your ratings and the words of your answers. Your voice recordings stay with WillpowerLab.",
      "This is my field",
      "Not now",
    ])
      expect(text()).toContain(w);
    await tap("This is my field");
    expect(posted("/speak/enter")).toHaveLength(1);
    expect(text()).toContain("Judge this moment");
  });

  it("MOD-12: \"What do I get?\" in three short cards and \"Back to the list\"", async () => {
    serve(ALL);
    await render(createElement(ModelsChatRows));
    await tapEl(container.querySelector('[data-chat-row="models"]'));
    await tap(`What do I get?${"For teachers, for founders of a model, and for businesses"}`);
    for (const w of [
      "Teach a model",
      "Earn a token for every answer that counts, and a share of what the model earns once businesses pay for it.",
      "Start a model",
      "Keep a fixed share from the first day. What you know keeps working while you sleep.",
      "Use a model in your business",
      "Try it free, create a key, and pay only for the answers you use.",
    ])
      expect(text()).toContain(w);
    await tap("Back to the list");
    expect(text()).toContain("Each model learns one skill");
  });

  it("MOD-13: an empty search says \"No models here yet.\" and offers \"Start the first one\" and \"Clear the search\"", async () => {
    serve(ALL);
    await render(createElement(ModelListScreen, { onClose: () => {}, onWhat: () => {}, onOpen: () => {}, onTeach: () => {}, onStart: () => {} }));
    const input = container.querySelector("input[type=search]") as HTMLInputElement;
    await act(async () => {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(input, "hair care");
      input.dispatchEvent(new Event("input", { bubbles: true }));
    });
    await wait(350);
    await flush();
    for (const w of ["No models here yet.", "Nobody has started a model about this. You could be the first.", "Start the first one", "Clear the search"])
      expect(text()).toContain(w);
    await tap("Clear the search");
    await wait(350);
    await flush();
    expect(text()).toContain("Started by Artur");
  });
});

describe("the AI models: teaching (MOD-08 to MOD-10, MOD-16 to MOD-20)", () => {
  it("MOD-08: a voice model's example is the Judge: \"Judge this moment\", its question, Yes · In-between · No, \"Audio unclear\", \"Skip\"", async () => {
    serve({ ...ALL, "GET /api/v2/models/queue": queueOf(["s0"]) });
    await render(teach("speak"));
    for (const w of ["Judge this moment", "Does the speaker sound confident here?", "Yes", "In-between", "No", "Audio unclear", "Skip"])
      expect(text()).toContain(w);
    expect(text()).toContain("Speaking confidence · 1 of 1");
  });

  it("MOD-09: nothing of the machine's read is fetched or shown, before or after the answer is saved", async () => {
    const leaky = { ...queueOf(["s0"]), examples: [{ ...F.queue.examples.find((e) => e.id === "s0"), machine_label: "Yes, sounds sure", what_happened: "rushed ending" }] };
    serve({ ...ALL, "GET /api/v2/models/queue": leaky, "POST /api/v2/models/speak/examples/s0/answer": F.answerPlain });
    await render(teach("speak"));
    expect(text()).not.toContain("sounds sure");
    await tapEl(container.querySelector('[data-model-answer="Yes"]'));
    expect(text()).not.toContain("sounds sure");
    expect(text()).not.toContain("rushed ending");
    const asked = bff.calls.map((c) => `${c.method} ${c.path.split("?")[0]}`);
    expect(asked).toEqual(["GET /api/v2/models/queue", "GET /api/v2/models/speak", "POST /api/v2/models/speak/examples/s0/answer"]);
    expect(posted("/answer")[0].json).toEqual({ step: "rate", answer: "Yes" });
  });

  it("MOD-10: no screen says she is on trial; once her answers count, \"Your answers now count.\" and the token line", async () => {
    serve({ ...ALL, "GET /api/v2/models/queue": queueOf(["s0", "s1"]), "POST /api/v2/models/speak/examples/s0/answer": F.answerTrust });
    await render(teach("speak"));
    expect(text()).not.toMatch(/trial|score|reliab/i);
    await tapEl(container.querySelector('[data-model-answer="No"]'));
    expect(text()).toContain("Your answers now count.");
    expect(text()).toContain("You earn a token for each answer that counts.");
    await tap("Keep teaching");
    expect(text()).toContain("Judge this moment");
  });

  it("MOD-16: one answer counts for two models that ask the same question: \"Counts for Speaking confidence and Interview voice: both ask this question\"", async () => {
    serve({ ...ALL, "GET /api/v2/models/queue": queueOf(["s0"]), "POST /api/v2/models/speak/examples/s0/answer": F.answerBoth });
    await render(teach("speak", 60_000));
    await tapEl(container.querySelector('[data-model-answer="In-between"]'));
    expect(container.querySelector("[data-model-note]")?.textContent).toBe("Counts for Speaking confidence and Interview voice: both ask this question");
    expect(posted("/answer")).toHaveLength(1);
  });

  it("MOD-17: Pitch Coach's question on the same clip follows right after, on its own scale, without loading the clip again", async () => {
    serve({
      ...ALL,
      "GET /api/v2/models/queue": queueOf(["s0"]),
      "POST /api/v2/models/speak/examples/s0/answer": F.answerBoth,
      "POST /api/v2/models/pitch/examples/s0-pitch/answer": F.answerPlain,
    });
    await render(teach("speak", 0));
    await tapEl(container.querySelector('[data-model-answer="Yes"]'));
    expect(text()).toContain("Pitch Coach asks something else about the same clip: how rushed does it sound?");
    for (const w of ["Calm", "Mostly calm", "Hurried in places", "Rushed", "Racing"]) expect(container.querySelector(`[data-model-answer="${w}"]`)).not.toBeNull();
    await tapEl(container.querySelector('[data-model-answer="Calm"]'));
    expect(posted("/pitch/examples/s0-pitch/answer")[0].json).toEqual({ step: "rate", answer: "Calm" });
    expect(bff.calls.filter((c) => c.path.startsWith("/api/v2/models/queue"))).toHaveLength(1);
  });

  it("MOD-18: a private example says \"Your company’s own example: it teaches only RASP sales replies.\" and counts for its own model only", async () => {
    serve({ ...ALL, "GET /api/v2/models/queue": queueOf(["r0"]), "POST /api/v2/models/rasp/examples/r0/answer": F.answerPrivate });
    await render(teach("rasp"));
    expect(text()).toContain("Your company’s own example: it teaches only RASP sales replies.");
    await tap("Ask what they compared us with");
    expect(posted("/answer").map((c) => c.path)).toEqual(["/api/v2/models/rasp/examples/r0/answer"]);
  });

  it("MOD-19: a recipe that picks from a list shows \"Which first reply would you send?\" with the three replies", async () => {
    serve({ ...ALL, "GET /api/v2/models/queue": queueOf(["r0"]) });
    await render(teach("rasp"));
    for (const w of ["“Your price is too high for us this year.”", "Which first reply would you send?", "Ask what they compared us with", "Offer a smaller first order", "Show what the price saves them"])
      expect(text()).toContain(w);
  });

  it("MOD-20: after the pick, \"Now say how you would answer them, in your own words.\" with \"Record your answer\" and \"Skip\"", async () => {
    serve({ ...ALL, "GET /api/v2/models/queue": queueOf(["r0", "r1"]), "POST /api/v2/models/rasp/examples/r0/answer": F.answerPrivate });
    await render(teach("rasp"));
    await tap("Offer a smaller first order");
    for (const w of ["Now say how you would answer them, in your own words.", "Record your answer", "Skip"]) expect(text()).toContain(w);
    await tap("Skip");
    expect(text()).toContain("Which first reply would you send?");
    expect(text()).toContain("RASP sales replies · 2 of 2");
  });
});

describe("the AI models: the queue and release (MOD-14, MOD-15, MOD-21 to MOD-23)", () => {
  it("MOD-14: one row \"Your queue\" with \"12 examples wait · 3 models\", in the list of chats and not in Will's chat", async () => {
    serve(ALL);
    await render(createElement(ModelsChatRows));
    const rows = container.querySelectorAll('[data-chat-row="models-queue"]');
    expect(rows).toHaveLength(1);
    expect(rows[0].textContent).toBe("Your queue12 examples wait · 3 models");
  });

  it("MOD-15: the queue, the ones that help most first, a row per model with its count and \"Pause\"", async () => {
    serve({ ...ALL, "POST /api/v2/models/rasp/pause": { paused: true } });
    await render(createElement(ModelsChatRows));
    await tapEl(container.querySelector('[data-chat-row="models-queue"]'));
    for (const w of [
      "12 examples are waiting. The ones that help most come first.",
      "Your company · you joined when Tomek invited the team",
      "You teach it",
      "You started it",
      "Pause a model to stop its examples for a while. Tap a model to teach only it.",
      "Start",
      "Add an example you know well",
    ])
      expect(text()).toContain(w);
    const rasp = container.querySelector('[data-testid="queue-model"]')!;
    expect(rasp.textContent).toContain("7");
    await act(async () => [...rasp.querySelectorAll("button")].find((b) => b.textContent === "Pause")!.click());
    await flush();
    expect(posted("/rasp/pause")[0].json).toEqual({ paused: true });
  });

  it("MOD-21: \"Add an example you know well\" opens the sheet in its words", async () => {
    serve(ALL);
    await render(createElement(ModelsChatRows));
    await tapEl(container.querySelector('[data-chat-row="models-queue"]'));
    await tap("Add an example you know well");
    for (const w of [
      "Add an example",
      "Do you know a case this model should learn from? Add it, then answer it yourself.",
      "Record one",
      "Upload a file",
      "It counts once another teacher agrees with your answer.",
    ])
      expect(text()).toContain(w);
  });

  it("MOD-22: release is the founder's choice, and only when the gap is not luck", async () => {
    const props = { model: "Pitch Coach", onRelease: vi.fn(), onNotYet: vi.fn(), onBack: () => {}, onClose: () => {} };
    await render(createElement(ModelRelease, { ...props, release: F.release }));
    for (const w of [
      "Version 2 is ready",
      "On the 100 exam cases:",
      "version 2 better",
      "Version 2 is clearly better: a gap of 14 against 3 is very unlikely to be luck.",
      "Releasing it is your choice. Businesses on version 1 keep it until they decide to switch.",
      "Release version 2",
      "Not yet",
    ])
      expect(text()).toContain(w);
    await tap("Release version 2");
    expect(props.onRelease).toHaveBeenCalledTimes(1);
    await render(createElement(ModelRelease, { ...props, release: F.releaseClose }));
    expect(text()).toContain("Not clearly better yet");
    expect(text()).not.toContain("Release version 2");
  });

  it("MOD-23: an empty queue says \"Nothing waits for you.\" and \"Back to your chats\" closes it", async () => {
    serve({ ...ALL, "GET /api/v2/models/queue": F.queueEmpty });
    await render(createElement(ModelsChatRows));
    await tapEl(container.querySelector('[data-chat-row="models-queue"]'));
    for (const w of ["Nothing waits for you.", "Thank you. New examples come when your models need you.", "Back to your chats"]) expect(text()).toContain(w);
    await tap("Back to your chats");
    expect(container.querySelector("[data-models-overlay]")).toBeNull();
  });
});

describe("the AI models: the invite and the profile (MOD-49, MOD-50)", () => {
  it("MOD-49: an invite stays in the chat after Not now, with \"Open\"", async () => {
    const onOpen = vi.fn();
    serve({ "GET /api/v2/models/invites/i1": F.invite });
    await render(createElement(ModelInviteCard, { inviteId: "i1", onOpen }));
    expect(text()).toContain("Kasia invited you to teach Short news cuts with them.");
    expect(text()).toContain("You said not now. The invite stays here; open it whenever you like.");
    await tap("Open");
    expect(onOpen).toHaveBeenCalledTimes(1);
  });

  it("MOD-49: an invite for someone else, or below the ring, answers 404 and draws nothing", async () => {
    await render(createElement(ModelInviteCard, { inviteId: "i2", onOpen: () => {} }));
    expect(text()).toBe("");
  });

  it("MOD-50: with no model, or below the ring, the profile has no \"AI models\" section", async () => {
    serve({ "GET /api/v2/models/profile/marta": { section: null } });
    await render(createElement(ProfileModels));
    expect(text()).toBe("");
  });
});
