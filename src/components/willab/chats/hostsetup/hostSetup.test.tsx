// @vitest-environment jsdom
/*
STORY    As the first person ever on WillpowerLab, nobody's invitee, I set up a
         chat with Will one decision per screen, Keep or Change, typing in
         Will's chat when words are needed; I test it as my people will, open
         it, and change it later by telling Will (backend N612, N616 to N618;
         the blank setup's stories FIRST-02 to FIRST-22).
OUTCOME
  O1  Each screen shows the locked prototype's words, and each Keep reaches
      the backend as one part in the recipe v2 shape (backend #1893).
  O2  Change cycles Will's suggestions with no call; Back keeps the answer.
  O3  Below the ring the read is 404 and no way in opens anything.
PROVES   one test per story, named by its id
*/
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

type Call = { path: string; method: string; json: unknown };
const bff = vi.hoisted(() => ({ routes: {} as Record<string, unknown>, calls: [] as Call[] }));
vi.mock("@/lib/api/bffFetch", () => ({
  bffFetch: vi.fn(async (path: string, init?: { method?: string; json?: unknown }) => {
    const call = { path, method: init?.method ?? "GET", json: init?.json };
    bff.calls.push(call);
    const answer = bff.routes[`${call.method} ${path}`];
    if (answer === undefined) return { kind: "response", ok: false, status: 404, body: { code: "NOT_FOUND" } };
    const got = typeof answer === "function" ? await (answer as (c: Call) => unknown)(call) : answer;
    const refused = got && typeof got === "object" && typeof (got as { status?: unknown }).status === "number" ? (got as { status: number; body: unknown }) : null;
    return refused ? { kind: "response", ok: false, ...refused } : { kind: "response", ok: true, status: 200, body: got };
  }),
}));
vi.mock("../../useUserProfile", () => ({ useUserProfile: () => ({ profile: { first_name: "Lena" }, loading: false, isCoach: false }) }));

import MS from "../../models/setupFixtures.json";
import HostSetupRows from "./HostSetupRows";
import { useSiteBarCovered } from "../siteBarCover";
import { forgetSetup, openSetupFromNote, openSetupFromWill, sayToWill } from "./hostSetupDoor";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const SUGGEST = {
  line: ["People come to you with hair and scalp worries.", "People come to you to keep their hair healthy."],
  send: ["photo", "text", "rec", "file"],
  out: ["answer", "todo", "mark", "words"],
  hello: ["Hi. Send me a photo of your scalp, and tell me what worries you.", "Welcome. Show me, and I'll tell you what I'd do first."],
  qs: ["What worries you about your hair?", "How long has it been like this?", "What do you wash it with?"],
  taps: [["Look at my scalp", "My hair is falling out", "Which shampoo"], ["An itchy scalp", "After colouring", "Thin hair"]],
  models: [
    { q: "Is this a dry scalp?", opts: ["Yes", "Somewhat", "No"], says: "Your scalp looks dry here. That is a common place to start." },
    { q: "Is the hair thinning here?", opts: ["Yes", "Somewhat", "No"], says: "The hair is thinner at the crown than around it." },
  ],
  sample_in: "A photo of the top of my head.",
  sample_out: "Thank you. I can see the crown clearly. Here is what I notice, and what I'd do first.",
};
type R = Record<string, unknown>;
const first = (over: R = {}): R => ({
  spec: "Trichologist",
  suggest: SUGGEST,
  line: SUGGEST.line[0],
  send: ["photo"],
  out: "answer",
  hello: SUGGEST.hello[0],
  questions: [],
  taps: SUGGEST.taps[0],
  smart: true,
  way: "own",
  models: [],
  who: "shadow",
  share: false,
  price: 2,
  cost: { people: 10, sends: 1 },
  live: false,
  ...over,
});
const FREE = { lines: [], per_send: 0, month: 0, nothing: true };

let recipe: R;
/** The backend as the contract has it: each PUT keeps one part. */
function backend(read: R = { recipe: null, parts: [], own_chat: null, cost: null }) {
  // Each PUT keeps a part of the recipe the read serves (a new one before).
  recipe = (read.recipe as R | null) ?? first();
  bff.routes["GET /api/v2/chats/setup"] = () => read;
  bff.routes["POST /api/v2/chats/setup/start"] = { recipe };
  for (const part of ["care", "line", "name", "send", "out", "hello", "questions", "taps", "smart", "way", "models", "who", "share", "price", "cost", "live", "walk"]) {
    bff.routes[`PUT /api/v2/chats/setup/${part}`] = (c: Call) => {
      recipe = { ...recipe, [part]: (c.json as R).value };
      return { recipe, cost: FREE };
    };
  }
  bff.routes["GET /api/v2/chats/setup/models"] = { models: [] };
  bff.routes["POST /api/v2/chats/setup/walk/want"] = () => {
    recipe = { ...recipe, walk: { ...((recipe.walk as R) ?? {}), wanted: true } };
    return { wanted: true };
  };
}

let container: HTMLDivElement;
let root: Root;
beforeEach(() => {
  bff.calls = [];
  bff.routes = {};
  forgetSetup();
  container = document.createElement("div");
  container.setAttribute("data-chats-front", "");
  document.body.appendChild(container);
  root = createRoot(container);
});
afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

const flush = async () => {
  for (let i = 0; i < 6; i += 1) await act(async () => { await Promise.resolve(); });
};
const text = () => container.textContent ?? "";
function button(label: string): HTMLButtonElement {
  const found = [...container.querySelectorAll("button")].find((b) => b.textContent?.trim() === label || b.textContent?.includes(label));
  if (!found) throw new Error(`no button "${label}" in: ${text()}`);
  return found as HTMLButtonElement;
}
async function tap(label: string) {
  await act(async () => button(label).click());
  await flush();
}
/** The one top bar's back arrow (backend N639). */
const backArrow = () => container.querySelector<HTMLButtonElement>('[data-one-top-bar] button[aria-label="Back"]');
async function back() {
  const arrow = backArrow();
  if (!arrow) throw new Error(`no back arrow in: ${text()}`);
  await act(async () => arrow.click());
  await flush();
}
const chips = () => [...container.querySelectorAll("[data-chip]")].map((c) => c.textContent);
const blocks = () => [...container.querySelectorAll("[data-model-stack] > *")].map((b) => b.textContent);
async function tapBlock(label: string) {
  const found = [...container.querySelectorAll("[data-model-stack] button")].find((b) => b.textContent === label) as HTMLButtonElement | undefined;
  if (!found) throw new Error(`no block "${label}" in: ${blocks().join(" | ")}`);
  await act(async () => found.click());
  await flush();
}
/** One's own model in blocks, from "What should it give back?": the ready
 *  choices, Will's first question, and "Teach it" unless asked to stop at the stack. */
async function makeOwn(teach = true) {
  await tap("A pick from a list");
  await tap("GPT");
  await tap("Keep");
  // "People answer with:" (N646): Will's own answers first.
  await tap("Keep");
  if (teach) await tap("Teach it");
}
async function type(words: string) {
  const ta = container.querySelector("textarea") as HTMLTextAreaElement;
  const set = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value")!.set!;
  await act(async () => {
    set.call(ta, words);
    ta.dispatchEvent(new Event("input", { bubbles: true }));
  });
  await act(async () => (container.querySelector("form") as HTMLFormElement).requestSubmit());
  await flush();
}
const puts = (part: string) => bff.calls.filter((c) => c.method === "PUT" && c.path === `/api/v2/chats/setup/${part}`).map((c) => (c.json as R).value);

async function mount() {
  act(() => root.render(createElement(HostSetupRows)));
  await flush();
}
/** The first person ever: Will's row opens "What do you do?"; they say it. */
async function begun() {
  backend();
  await mount();
  act(() => void openSetupFromWill(0));
  await flush();
  await tap("Answer");
  await type("trichologist");
  await tap("No");
}
/** On to a step, keeping Will's first suggestion on each. */
async function keepTo(say: string) {
  for (let i = 0; i < 12 && !text().includes(say); i += 1) {
    if (text().includes("Ask one more question?")) await tap("No");
    else if (text().includes("Tick all that apply")) await tap("Done");
    else await tap("Keep");
  }
  expect(text()).toContain(say);
}

describe("the blank setup (FIRST-)", () => {
  it("FIRST-02 Will asks what you do; you type it in his chat; three dots while he works it out", async () => {
    backend();
    let answer: (v: unknown) => void = () => undefined;
    bff.routes["POST /api/v2/chats/setup/start"] = () => new Promise((r) => { answer = r; });
    await mount();
    expect(openSetupFromWill(1)).toBe(false);
    act(() => void openSetupFromWill(0));
    await flush();
    expect(text()).toContain("Hi Lena. I'm Will. Let's set up your chat, so people can come to you through one link.");
    expect(text()).toContain("I ask one thing at a time. You tap Keep or Change. It takes about five minutes.");
    expect(text()).toContain("What do you do?");
    await tap("Answer");
    expect((container.querySelector("textarea") as HTMLTextAreaElement).placeholder).toBe("Speaking coach");
    await type("trichologist");
    expect(text()).toContain("Trichologist. One moment.");
    expect(container.querySelector('[role="status"][aria-label="Will is thinking"]')).not.toBeNull();
    await act(async () => answer({ recipe: first() }));
    await flush();
    expect(bff.calls.find((c) => c.path === "/api/v2/chats/setup/start")?.json).toEqual({ what: "trichologist" });
    expect(text()).toContain("Is your work about health, law or money?");
  });

  it("FIRST-15 health, law or money is asked first; with Yes, nothing goes out until the host sends it", async () => {
    backend();
    await mount();
    act(() => void openSetupFromWill(0));
    await flush();
    await tap("Answer");
    await type("dermatologist");
    expect(text()).toContain("Is your work about health, law or money?");
    expect(text()).toContain("If yes, I only suggest answers to you, and you send each one. Not sure? Say yes.");
    await tap("Yes");
    expect(puts("care")).toEqual([true]);
    expect(text()).toContain("People come to you for this:");
    await keepTo("Right now your chat isn't a specialist in anything.");
    await tap("Not now");
    expect(text()).toContain("Your work is about health, law or money, so nothing goes out until you send it.");
    expect(text()).toContain("I draft, you send");
    expect(text()).toContain("Only you");
    expect(text()).not.toContain("I answer at once");
  });

  it("FIRST-03 the line says new people read it; refused words keep the screen and say so", async () => {
    await begun();
    expect(text()).toContain("New people read this before they join your chat.");
    bff.routes["PUT /api/v2/chats/setup/line"] = { status: 400, body: { code: "RECIPE_WORDS" } };
    await tap("Type my own");
    await type("People come to you for a score out of ten.");
    await tap("Keep");
    expect(text()).toContain("People come to you for this:");
    expect(text()).toContain("Try other words. Your chat can't show a score or a number about someone.");
    await tap("Change");
    expect(text()).not.toContain("Try other words.");
  });

  it("N642-1 the chat's name comes after why people come: Keep, Change or Type my own; among the parts its row is Name", async () => {
    const NAMES = ["Lena's chat", "Ask Lena", "Trichologist with Lena"];
    backend({ recipe: null, parts: [], own_chat: null, cost: null });
    recipe = first({ suggest: { ...SUGGEST, name: NAMES }, name: null });
    bff.routes["POST /api/v2/chats/setup/start"] = { recipe };
    await mount();
    act(() => void openSetupFromWill(0));
    await flush();
    await tap("Answer");
    await type("trichologist");
    await tap("No");
    await tap("Keep");
    expect(text()).toContain("Your chat is called:");
    expect(text()).toContain(NAMES[0]);
    const calls = bff.calls.length;
    await tap("Change");
    expect(text()).toContain(NAMES[1]);
    expect(bff.calls.length).toBe(calls);
    await tap("Type my own");
    expect(text()).toContain("What should your chat be called?");
    await type("Hair with Lena");
    expect(text()).toContain("Hair with Lena");
    bff.routes["PUT /api/v2/chats/setup/name"] = { status: 400, body: { code: "RECIPE_WORDS" } };
    await tap("Keep");
    expect(text()).toContain("Your chat is called:");
    expect(text()).toContain("Try other words.");
    bff.routes["PUT /api/v2/chats/setup/name"] = (c: Call) => ({ recipe: { ...recipe, name: (c.json as R).value }, cost: FREE });
    await tap("Keep");
    expect(puts("name")).toEqual(["Hair with Lena", "Hair with Lena"]);
    expect(text()).toContain("What do people send you? Tick all that apply.");
  });

  it("N642-1 the Name part opens its step and comes back to the parts; without suggested names the step is not asked", async () => {
    const parts = [
      { part: "name", title: "Name", value: "Ask Lena" },
      { part: "line", title: "Why people come", value: SUGGEST.line[0] },
    ];
    backend({ recipe: first({ live: true, suggest: { ...SUGGEST, name: ["Lena's chat", "Ask Lena"] }, name: "Ask Lena" }), parts, own_chat: { title: "Ask Lena", line: SUGGEST.hello[0] }, cost: FREE });
    bff.routes["POST /api/v2/chats/setup/edit"] = { line: "Here are your chat's parts. Tap one to change it.", parts };
    await mount();
    await act(async () => { expect(await sayToWill("I want to edit my chat")).toBe(true); });
    await flush();
    await tap("Name");
    expect(text()).toContain("Your chat is called:");
    expect(text()).toContain("Ask Lena");
    await tap("Change");
    await tap("Keep");
    expect(puts("name")).toEqual(["Lena's chat"]);
    expect(text()).toContain("Here are your chat's parts. Tap one to change it.");
  });

  it("FIRST-06 Type my own on the taps sends the one tap typed", async () => {
    await begun();
    await keepTo("People tap what they want:");
    await tap("Type my own");
    await type("Check my scalp");
    expect(text()).toContain("Check my scalp");
    expect(text()).toContain("Something else");
    await tap("Keep");
    expect(puts("taps")).toEqual([["Check my scalp"]]);
  });

  it("FIRST-03 one decision per screen: Change shows Will's next, Type my own comes back, Back keeps it", async () => {
    await begun();
    const calls = bff.calls.length;
    await tap("Change");
    expect(text()).toContain(SUGGEST.line[1]);
    expect(bff.calls.length).toBe(calls);
    await tap("Type my own");
    expect(text()).toContain("Why do people come to you?");
    await type("People come to me when their hair worries them.");
    expect(text()).toContain("People come to you for this:");
    expect(text()).toContain("People come to me when their hair worries them.");
    await tap("Keep");
    expect(puts("line")).toEqual(["People come to me when their hair worries them."]);
    expect(text()).toContain("What do people send you? Tick all that apply.");
    await back();
    expect(text()).toContain("People come to me when their hair worries them.");
  });

  it("FIRST-04 what people send: Will's first comes ticked, several can be, Done keeps them", async () => {
    await begun();
    await tap("Keep");
    const ticks = () => [...container.querySelectorAll('[role="checkbox"]')].map((b) => `${b.textContent}:${b.getAttribute("aria-checked")}`);
    expect(ticks()[0]).toContain("A photo");
    expect(ticks()[0]).toContain("true");
    await tap("A message");
    await tap("Done");
    expect(puts("send")).toEqual([["photo", "text"]]);
  });

  it("FIRST-04 what people send shows what the recipe holds: A message ticked with the first suggestion (N625)", async () => {
    backend();
    recipe = first({ send: ["photo", "text"] });
    bff.routes["POST /api/v2/chats/setup/start"] = { recipe };
    await mount();
    act(() => void openSetupFromWill(0));
    await flush();
    await tap("Answer");
    await type("trichologist");
    await tap("No");
    await tap("Keep");
    const ticked = [...container.querySelectorAll('[role="checkbox"][aria-checked="true"]')].map((b) => b.querySelector("b")?.textContent);
    expect(ticked).toEqual(["A photo", "A message"]);
    await tap("Done");
    expect(puts("send")).toEqual([["photo", "text"]]);
  });

  it("FIRST-04 several rows tick, each on its own; the last tick cannot be unticked; Done saves them all", async () => {
    await begun();
    await tap("Keep");
    const ticked = () => [...container.querySelectorAll('[role="checkbox"][aria-checked="true"]')].map((b) => b.querySelector("b")?.textContent);
    const row = (name: string) => [...container.querySelectorAll<HTMLButtonElement>('[role="checkbox"]')].find((b) => b.querySelector("b")?.textContent === name)!;
    const press = async (name: string) => {
      await act(async () => row(name).click());
      await flush();
    };
    expect(ticked()).toEqual(["A photo"]);
    await press("A message");
    await press("A recording");
    await press("A file");
    expect(ticked()).toEqual(["A photo", "A message", "A recording", "A file"]);
    for (const name of ["A photo", "A message", "A recording"]) await press(name);
    expect(ticked()).toEqual(["A file"]);
    await press("A file");
    expect(ticked()).toEqual(["A file"]);
    await press("A message");
    await tap("Done");
    expect(puts("send")).toEqual([["text", "file"]]);
  });

  /** On "What do people send you?", a recording ticked too, then Done. */
  async function withRecording() {
    await keepTo("What do people send you? Tick all that apply.");
    await tap("A recording");
    await tap("Done");
  }
  const posts = (path: string) => bff.calls.filter((c) => c.method === "POST" && c.path === path);

  it("N641 a chat that takes a recording says what its feedback walk holds, its order and its end; the walk is kept as one part", async () => {
    await begun();
    await withRecording();
    expect(puts("send")).toEqual([["photo", "rec"]]);
    expect(text()).toContain("After a recording, people get a feedback walk.");
    expect(text()).toContain("What should yours hold? Tick all that apply.");
    const ticked = () => [...container.querySelectorAll('[role="checkbox"]')].filter((b) => b.getAttribute("aria-checked") === "true").map((b) => b.textContent);
    expect(ticked()).toEqual(["Their best moment", "One moment to try another way", "The helper words"]);
    await tap("Their best moment");
    await tap("One moment to try another way");
    // The last tick stays.
    await tap("The helper words");
    expect(ticked()).toEqual(["The helper words"]);
    await tap("Their best moment");
    await tap("Done");
    expect(text()).toContain("Your walk goes in this order:");
    expect(text()).toContain("1. The helper words");
    expect(text()).toContain("2. Their best moment");
    await tap("Change");
    expect(text()).toContain("1. Their best moment");
    await tap("Keep");
    expect(text()).toContain("What do they get at the end?");
    expect(puts("walk")).toEqual([]);
    await tap("Nothing for now");
    expect(puts("walk")).toEqual([{ steps: ["best", "words"], out: "none" }]);
    expect([...container.querySelectorAll("[data-walk-blocks] > *")].map((b) => b.textContent)).toEqual(["Their best moment", "The helper words", "Nothing for now"]);
    expect(text()).toContain("Your chat can't run this yet. Want it?");
    expect(container.querySelector("small")).toBeNull();
    await tap("Not now");
    expect(posts("/api/v2/chats/setup/walk/want")).toHaveLength(0);
    expect(text()).toContain("Your chat opens with:");
  });

  it("N641 \"I want this\" tells the founder once: the thanks and Done, and the question never again", async () => {
    await begun();
    await withRecording();
    await tap("Done");
    await tap("Keep");
    await tap("An Ideal Text");
    expect(puts("walk")).toEqual([{ steps: ["best", "fix", "words"], out: "ideal_text" }]);
    await tap("I want this");
    expect(posts("/api/v2/chats/setup/walk/want")).toHaveLength(1);
    expect(text()).toContain("Thanks. I've told Artur.");
    expect(text()).not.toContain("Want it?");
    await back();
    await tap("An Ideal Text");
    expect(text()).toContain("Thanks. I've told Artur.");
    expect(() => button("I want this")).toThrow();
    await tap("Done");
    expect(posts("/api/v2/chats/setup/walk/want")).toHaveLength(1);
    expect(text()).toContain("Your chat opens with:");
  });

  it("N641 a chat that takes no recording has no feedback walk", async () => {
    await begun();
    await keepTo("What do people send you? Tick all that apply.");
    await tap("Done");
    expect(text()).toContain("Your chat opens with:");
    expect(text()).not.toContain("feedback walk");
  });

  it("N641 the walk's part opens its steps, and after the end the parts again", async () => {
    backend({
      recipe: first({ send: ["rec"], walk: { steps: ["fix", "best"], out: "ideal_text", wanted: true } }),
      parts: [{ part: "walk", title: "The feedback walk", value: "One moment to try another way · Their best moment · An Ideal Text" }],
      own_chat: null,
      cost: FREE,
    });
    await mount();
    act(() => void openSetupFromNote());
    await flush();
    await tap("The feedback walk");
    expect(text()).toContain("What should yours hold? Tick all that apply.");
    await tap("Done");
    expect(text()).toContain("1. One moment to try another way");
    await tap("Keep");
    await tap("An Ideal Text");
    expect(puts("walk")).toEqual([{ steps: ["fix", "best"], out: "ideal_text" }]);
    expect(text()).toContain("Thanks. I've told Artur.");
    await tap("Done");
    expect(text()).toContain("Open your chat to people?");
  });

  it("FIRST-03 every step of the setup has Back, and Back returns to the step before", async () => {
    backend();
    await mount();
    act(() => void openSetupFromWill(0));
    await flush();
    const steps: { go: () => Promise<void>; see: string }[] = [
      { go: async () => undefined, see: "What do you do?" },
      { go: async () => { await tap("Answer"); await type("trichologist"); }, see: "Is your work about health, law or money?" },
      { go: () => tap("No"), see: "People come to you for this:" },
      { go: () => tap("Keep"), see: "What do people send you? Tick all that apply." },
      { go: () => tap("Done"), see: "Your chat opens with:" },
      { go: () => tap("Keep"), see: "Then it asks:" },
      { go: () => tap("Keep"), see: "Ask one more question?" },
      { go: () => tap("No"), see: "People tap what they want:" },
      { go: () => tap("Keep"), see: "Right now your chat isn't a specialist in anything." },
      { go: () => tap("Yes"), see: "Two ways to make it smart. Pick one." },
      { go: () => tap("Train your own"), see: "Your own model answers one question the way you would." },
      { go: () => tap("Train my own"), see: "What should it give back?" },
      { go: () => tap("A pick from a list"), see: "What should it be built on?" },
      { go: () => tap("GPT"), see: "What should it notice?" },
      { go: () => tap("Keep"), see: "People answer with:" },
      { go: () => tap("Keep"), see: "Your model. Tap a block to change it." },
      // Back to the blocks and "Teach it" again saves no second model.
      { go: () => tap("Teach it"), see: "Add another model?" },
      { go: () => tap("No"), see: "People will ask you things when you are busy. Who answers them?" },
      { go: () => tap("I draft, you send"), see: "These are your models. Share them, and earn tokens each time someone uses one." },
      { go: () => tap("Share them"), see: "Each use costs them:" },
      { go: () => tap("Keep"), see: "Your chat costs you nothing." },
      { go: () => tap("Next"), see: "Your chat is ready." },
      { go: () => tap("Not now"), see: "Open your chat to people?" },
    ];
    for (let k = 0; k < steps.length; k += 1) {
      await steps[k].go();
      expect(text()).toContain(steps[k].see);
      // The one top bar (N639): the arrow and "Your chat"; no "Back" word, no circle.
      expect(backArrow()).not.toBeNull();
      expect(container.querySelector("[data-one-top-bar]")?.textContent).toBe("Your chat");
      expect(container.querySelector("[data-host-back]")).toBeNull();
      if (k === 0) continue;
      await back();
      expect(text()).toContain(steps[k - 1].see);
      await steps[k].go();
      expect(text()).toContain(steps[k].see);
    }
  });

  it("FIRST-05 what they get back is asked only when it isn't simply an answer", async () => {
    await begun();
    await tap("Keep");
    await tap("Done");
    expect(text()).not.toContain("They get back:");
    expect(text()).toContain("Your chat opens with:");
    backend();
    recipe = first({ suggest: { ...SUGGEST, out: ["words", "answer", "todo", "mark"] }, out: "words" });
    bff.routes["POST /api/v2/chats/setup/start"] = { recipe };
    act(() => root.unmount());
    root = createRoot(container);
    await mount();
    act(() => void openSetupFromWill(0));
    await flush();
    await tap("Answer");
    await type("speaking coach");
    await tap("No");
    await tap("Keep");
    await tap("Done");
    expect(text()).toContain("They get back:");
    expect(text()).toContain("Their own words, tidied");
  });

  it("FIRST-06 the hello, up to three first questions one at a time, and the taps with Something else", async () => {
    await begun();
    await keepTo("Your chat opens with:");
    await tap("Keep");
    expect(puts("hello")).toEqual([SUGGEST.hello[0]]);
    expect(text()).toContain("Then it asks:");
    await tap("Keep");
    expect(text()).toContain("Ask one more question?");
    await tap("Yes");
    expect(text()).toContain(SUGGEST.qs[1]);
    await tap("Keep");
    await tap("No");
    expect(puts("questions")).toEqual([[{ q: SUGGEST.qs[0] }, { q: SUGGEST.qs[1] }]]);
    expect(text()).toContain("People tap what they want:");
    expect(text()).toContain("Something else");
    await tap("Keep");
    expect(puts("taps")).toEqual([SUGGEST.taps[0]]);
  });

  it("FIRST-17 Want to make it trichologist-smart? Not now leaves it without models and goes to who answers", async () => {
    await begun();
    await keepTo("Right now your chat isn't a specialist in anything.");
    expect(text()).toContain("Want to make it trichologist-smart?");
    await tap("Not now");
    expect(puts("smart")).toEqual([false]);
    expect(text()).toContain("People will ask you things when you are busy. Who answers them?");
  });

  it("FIRST-18 two ways: use a model that exists is greyed out while nobody shared one", async () => {
    await begun();
    await keepTo("Right now your chat isn't a specialist in anything.");
    await tap("Yes");
    expect(text()).toContain("Two ways to make it smart. Pick one.");
    expect(text()).toContain("Nobody has shared one yet. Yours can be the first.");
    expect(button("Use a model that exists").disabled).toBe(true);
    expect(text()).toContain("Free. It needs your answers and some time before it works. Later, others can pay you to use it.");
  });

  it("FIRST-13 models you can use: each with who made it and its price; one that doesn't fit is greyed out; Add it", async () => {
    await begun();
    bff.routes["GET /api/v2/chats/setup/models"] = {
      models: [
        { model_id: "m1", q: "Is the skin red?", opts: ["Yes", "Somewhat", "No"], by: "Kasia", price: 3, fits: true, needs: "" },
        { model_id: "m2", q: "Do they sound sure?", opts: ["Yes", "In between", "No"], by: "Artur", price: 2, fits: false, needs: "A recording" },
      ],
    };
    await keepTo("Right now your chat isn't a specialist in anything.");
    await tap("Yes");
    expect(text()).toContain("Ready now. You pay its owner a few tokens each time it runs.");
    await tap("Use a model that exists");
    expect(text()).toContain("Models you can use.");
    expect(text()).toContain("Kasia made it. 3 tokens each use.");
    expect(text()).toContain("Artur made it. It needs a recording.");
    expect(button("Do they sound sure?").disabled).toBe(true);
    await tap("Is the skin red?");
    expect(text()).toContain("It costs you 3 tokens each time it runs. Your people pay nothing.");
    await tap("Add it");
    expect(puts("models")).toEqual([[{ q: "Is the skin red?", opts: ["Yes", "Somewhat", "No"], says: "", own: false, model_id: "m1", by: "Kasia", price: 3 }]]);
    expect(text()).toContain("Add another model?");
  });

  it("N633-1 a model still learning: marked Still learning, no price and no promise of a line; added free, and so in the parts and the cost", async () => {
    await begun();
    bff.routes["GET /api/v2/chats/setup/models"] = {
      models: [{ model_id: "m3", q: "Is the scalp flaky?", opts: ["Yes", "Somewhat", "No"], by: "Kasia", price: 0, fits: true, needs: "", learning: true }],
    };
    const LEARNING = { lines: [{ q: "Is the scalp flaky?", by: "Kasia", price: 0 }], per_send: 0, month: 0, nothing: true };
    bff.routes["PUT /api/v2/chats/setup/models"] = (c: Call) => {
      // The backend keeps a model still learning with learning true.
      recipe = { ...recipe, models: ((c.json as R).value as R[]).map((m) => ({ ...m, learning: true })) };
      return { recipe, cost: LEARNING };
    };
    await keepTo("Right now your chat isn't a specialist in anything.");
    await tap("Yes");
    await tap("Use a model that exists");
    const row = button("Is the scalp flaky?");
    expect(row.textContent).toContain("Still learning");
    expect(row.textContent).toContain("Kasia made it.");
    expect(row.textContent).not.toContain("tokens");
    await tap("Is the scalp flaky?");
    expect(text()).toContain("Still learning");
    expect(text()).not.toContain("Your chat gets smarter today");
    expect(text()).not.toContain("It costs you");
    await tap("Add it");
    expect(puts("models")).toEqual([[{ q: "Is the scalp flaky?", opts: ["Yes", "Somewhat", "No"], says: "", own: false, model_id: "m3", by: "Kasia", price: 0 }]]);
    await tap("No");
    bff.routes["PUT /api/v2/chats/setup/who"] = (c: Call) => {
      recipe = { ...recipe, who: (c.json as R).value };
      return { recipe, cost: LEARNING };
    };
    await tap("I draft, you send");
    // What it costs: the model listed, still learning, counting nothing.
    const line = container.querySelector("[data-cost-line]")!;
    expect(line.textContent).toContain("Still learning");
    expect(line.textContent).not.toContain("Kasia's model");
    expect(text()).toContain("Your chat costs you nothing.");
    await tap("Next");
    await tap("Not now");
    bff.routes["GET /api/v2/chats/setup"] = () => ({
      recipe,
      parts: [{ part: "models", title: "Your models", value: "Is the scalp flaky?" }],
      own_chat: { title: "Lena", line: SUGGEST.hello[0] },
      cost: LEARNING,
    });
    expect(puts("models")).toHaveLength(1);
    await tap("Not yet");
    act(() => void openSetupFromNote());
    await flush();
    expect(container.querySelector('[data-part="models"]')?.textContent).toBe("Your modelsIs the scalp flaky?Still learning");
  });

  it("N636-6 a model in blocks: what it gives back, then what it is built on, only a ready one taps; no small grey text; kept on the card", async () => {
    await begun();
    bff.routes["GET /api/v2/chats/setup/models"] = {
      models: [{ model_id: "m1", q: "Is the skin red?", opts: ["Yes", "Somewhat", "No"], by: "Kasia", price: 3, fits: true, needs: "" }],
    };
    await keepTo("Right now your chat isn't a specialist in anything.");
    await tap("Yes");
    await tap("Train your own");
    await tap("Train my own");
    expect(text()).toContain("What should it give back?");
    expect(button("A pick from a list").disabled).toBe(false);
    expect(button("A score, not ready yet").disabled).toBe(true);
    expect(button("An answer in your words, not ready yet").disabled).toBe(true);
    expect(container.querySelector("small")).toBeNull();
    await tap("A pick from a list");
    expect(text()).toContain("What should it be built on?");
    expect(button("GPT").disabled).toBe(false);
    expect(button("Claude, not ready yet").disabled).toBe(true);
    expect(button("WillpowerLab's own, not ready yet").disabled).toBe(true);
    expect(text()).not.toContain("A general model from OpenAI");
    expect(container.querySelector("small")).toBeNull();
    await tap("GPT");
    expect(text()).toContain("What should it notice?");
    expect(text()).toContain(SUGGEST.models[0].q);
    expect(chips()).toEqual(["Yes", "Somewhat", "No"]);
    expect(text()).not.toContain("One question, three answers.");
    expect(container.querySelector("small")).toBeNull();
    await tap("Keep");
    // N646: Will's suggested answers are the first set, shown before the blocks.
    expect(container.querySelector("[data-model-answers]")?.textContent).toBe("Yes · Somewhat · No");
    expect(container.querySelector("small")).toBeNull();
    await tap("Keep");
    expect(blocks()).toEqual([SUGGEST.models[0].q, "It gives back a pick from a list", "Built on GPT", "Taught by you"]);
    expect(container.querySelector("small")).toBeNull();
    expect(puts("models")).toEqual([]);
    await tap("Teach it");
    expect(puts("models")).toEqual([[{ ...SUGGEST.models[0], own: true, base: "gpt", gives: "pick" }]]);
    // Another of one's own: neither asked again.
    await tap("Yes");
    await tap("Train your own");
    expect(text()).toContain("Your next model:");
    expect(text()).not.toContain("What should it give back?");
    expect(text()).not.toContain("What should it be built on?");
    // Someone else's model: never asked.
    await back();
    await tap("Use a model that exists");
    expect(text()).toContain("Models you can use.");
    expect(text()).not.toContain("What should it give back?");
  });

  it("N646 a typed question: its answers come from it; Change shows the next set; one's own, one on each line, at most three", async () => {
    await begun();
    bff.routes["POST /api/v2/models/setup/answers"] = { sets: [["Cracked", "Broken", "Not sure"], ["Split", "Whole", "Not sure"]] };
    await keepTo("Right now your chat isn't a specialist in anything.");
    await tap("Yes");
    await tap("Train your own");
    await tap("Train my own");
    await tap("A pick from a list");
    await tap("GPT");
    await tap("Type my own");
    await type("Is the wood cracked or broken");
    expect(bff.calls.filter((c) => c.path === "/api/v2/models/setup/answers").map((c) => c.json)).toEqual([{ question: "Is the wood cracked or broken?" }]);
    expect(text()).toContain("People answer with:");
    expect(container.querySelector("[data-model-answers]")?.textContent).toBe("Cracked · Broken · Not sure");
    await tap("Change");
    expect(container.querySelector("[data-model-answers]")?.textContent).toBe("Split · Whole · Not sure");
    await tap("Type my own");
    expect(text()).toContain("Type two or three answers, one on each line.");
    await type("Cracked\nBroken\n\nNot sure\nRotten");
    expect(container.querySelector("[data-model-answers]")?.textContent).toBe("Cracked · Broken · Not sure");
    await tap("Keep");
    await tap("Teach it");
    expect(puts("models")).toEqual([[{ q: "Is the wood cracked or broken?", opts: ["Cracked", "Broken", "Not sure"], says: "Is the wood cracked or broken? Cracked.", own: true, base: "gpt", gives: "pick" }]]);
  });

  it("N646 Will's suggested model: its own answers first, then the backend's other sets; one's own answers there too", async () => {
    await begun();
    bff.routes["POST /api/v2/models/setup/answers"] = { sets: [["Yes", "Somewhat", "No"], ["Dry", "Oily", "Not sure"]] };
    await keepTo("Right now your chat isn't a specialist in anything.");
    await tap("Yes");
    await tap("Train your own");
    await tap("Train my own");
    await tap("A pick from a list");
    await tap("GPT");
    await tap("Keep");
    expect(text()).toContain("People answer with:");
    expect(container.querySelector("[data-model-answers]")?.textContent).toBe("Yes · Somewhat · No");
    await tap("Change");
    expect(container.querySelector("[data-model-answers]")?.textContent).toBe("Dry · Oily · Not sure");
    await tap("Type my own");
    await type("Very dry\nA little dry");
    expect(container.querySelector("[data-model-answers]")?.textContent).toBe("Very dry · A little dry");
    await tap("Keep");
    await tap("Teach it");
    expect((puts("models")[0] as R[])[0]).toMatchObject({ q: SUGGEST.models[0].q, opts: ["Very dry", "A little dry"] });
  });

  it("N636-6 a tapped block changes that one choice and comes back to the stack; the card is saved only on Teach it", async () => {
    await begun();
    await keepTo("Right now your chat isn't a specialist in anything.");
    await tap("Yes");
    await tap("Train your own");
    await tap("Train my own");
    await makeOwn(false);
    await tapBlock("It gives back a pick from a list");
    expect(text()).toContain("What should it give back?");
    await tap("A pick from a list");
    expect(text()).toContain("Your model. Tap a block to change it.");
    await tapBlock("Built on GPT");
    expect(text()).toContain("What should it be built on?");
    await tap("GPT");
    expect(text()).toContain("Your model. Tap a block to change it.");
    await tapBlock(SUGGEST.models[0].q);
    expect(text()).toContain("What should it notice?");
    await tap("Change");
    await tap("Keep");
    await tap("Keep");
    expect(blocks()[0]).toBe(SUGGEST.models[1].q);
    expect(puts("models")).toEqual([]);
    await tap("Teach it");
    expect(puts("models")).toEqual([[{ ...SUGGEST.models[1], own: true, base: "gpt", gives: "pick" }]]);
    expect(text()).toContain("Add another model?");
    // A second of one's own goes straight to its question, then its blocks; two speak in an order.
    await tap("Yes");
    await tap("Train your own");
    await tap("Keep");
    await tap("Keep");
    expect(text()).toContain("Your model. Tap a block to change it.");
    await tap("Teach it");
    expect((puts("models")[1] as R[]).length).toBe(2);
    await tap("No");
    expect(text()).toContain("Your models speak in this order:");
  });

  it("N634-2 a model still learning says so about itself under Still learning; the list's caption stays", async () => {
    await begun();
    bff.routes["GET /api/v2/chats/setup/models"] = {
      models: [{ model_id: "m3", q: "Is the scalp flaky?", opts: ["Yes", "Somewhat", "No"], by: "Kasia", price: 0, fits: true, needs: "", learning: true }],
    };
    await keepTo("Right now your chat isn't a specialist in anything.");
    await tap("Yes");
    await tap("Use a model that exists");
    expect(button("Is the scalp flaky?").textContent?.startsWith("Still learningIt says nothing yet. Your answers teach it.")).toBe(true);
    expect(text()).toContain("Add one and your chat gets a key to it.");
  });

  it("N636-6 a card saved again from its blocks always carries its model_id back, even with a changed question", async () => {
    await begun();
    bff.routes["PUT /api/v2/chats/setup/models"] = (c: Call) => {
      recipe = { ...recipe, models: ((c.json as R).value as R[]).map((m) => ({ ...m, model_id: m.model_id ?? "m-own" })) };
      return { recipe, cost: FREE };
    };
    await keepTo("Right now your chat isn't a specialist in anything.");
    await tap("Yes");
    await tap("Train your own");
    await tap("Train my own");
    await makeOwn();
    expect(puts("models")).toHaveLength(1);
    // Back from "Add another model?" goes through its teaching to the blocks.
    await back();
    expect(text()).toContain("Your model. Tap a block to change it.");
    await tapBlock(SUGGEST.models[0].q);
    await tap("Change");
    await tap("Keep");
    await tap("Keep");
    await tap("Teach it");
    expect(puts("models")).toHaveLength(2);
    expect((puts("models")[1] as R[])).toEqual([{ ...SUGGEST.models[1], own: true, base: "gpt", gives: "pick", model_id: "m-own" }]);
  });

  it("FIRST-19 N636-6 your own model, in two lines: what it does and what it takes; Not now or Train my own", async () => {
    await begun();
    await keepTo("Right now your chat isn't a specialist in anything.");
    await tap("Yes");
    await tap("Train your own");
    expect(text()).toContain("Your own model answers one question the way you would.");
    expect(text()).toContain("Four choices, then you teach it by answering examples. It needs about 200 to get good.");
    for (const b of ["What it is", "Worth it", "Not worth it"]) expect(text()).not.toContain(b);
    expect(container.querySelector("small")).toBeNull();
    expect(button("Not now").disabled).toBe(false);
    await tap("Train my own");
    expect(text()).toContain("What should it give back?");
  });

  it("FIRST-07 a model is one question with three answers; Change shows another; Keep keeps it", async () => {
    await begun();
    await keepTo("Right now your chat isn't a specialist in anything.");
    await tap("Yes");
    await tap("Train your own");
    await tap("Train my own");
    await tap("A pick from a list");
    await tap("GPT");
    expect(text()).toContain("Is this a dry scalp?");
    expect(chips()).toEqual(["Yes", "Somewhat", "No"]);
    await tap("Change");
    expect(text()).toContain("Is the hair thinning here?");
    await tap("Keep");
    await tap("Keep");
    await tap("Teach it");
    expect(puts("models")).toEqual([[{ ...SUGGEST.models[1], own: true, base: "gpt", gives: "pick" }]]);
    expect(text()).toContain("Add another model?");
  });

  /** On to a model of one's own that the backend made, with its model_id. */
  async function madeModel() {
    await begun();
    bff.routes["PUT /api/v2/chats/setup/models"] = (c: Call) => {
      recipe = { ...recipe, models: ((c.json as R).value as R[]).map((m) => ({ ...m, model_id: "m-own" })) };
      return { recipe, cost: FREE };
    };
    await keepTo("Right now your chat isn't a specialist in anything.");
    await tap("Yes");
    await tap("Train your own");
    await tap("Train my own");
    await makeOwn();
  }
  const own = (state: R) => ({ ...state, model_id: "m-own" });

  it("FIRST-08 teach it: the owner's first 10 for the model just made, then on to another model", async () => {
    bff.routes["GET /api/v2/models/m-own/setup/first-ten"] = own(MS.first10);
    bff.routes["POST /api/v2/models/m-own/setup/first10"] = own(MS.share);
    await madeModel();
    expect(text()).toContain("Now answer the first 10 yourself, the way your teachers will.");
    bff.routes["GET /api/v2/models/m-own/setup/first-ten"] = own(MS.first10Teach);
    await tap("Start");
    expect(text()).toContain("How rushed does it sound?");
    expect(text()).toContain("So our ask is two million and we close in March");
    bff.routes["GET /api/v2/models/m-own/setup/first-ten"] = own(MS.first10);
    act(() => root.unmount());
    root = createRoot(container);
    await madeModel();
    await tap("Do it later");
    expect(text()).toContain("Add another model?");
  });

  it("LEARN-03 check its guesses: one example per screen, its guess first, Keep or the right answer; no numbers", async () => {
    const item = (id: string, words: string, guess: string) => ({ example_id: id, example: { id, content: { text: words } }, guess, kept: null as boolean | null, answer: null });
    const ITEMS = [item("c1", "My scalp is tight and flaky after washing.", "Yes"), item("c2", "My hair feels soft and my scalp is calm.", "Somewhat")];
    let state = { version: "v1", answers: ["Yes", "Somewhat", "No"], items: ITEMS, done: false };
    bff.routes["GET /api/v2/models/m-own/setup/first-ten"] = own(MS.first10);
    bff.routes["POST /api/v2/models/m-own/setup/first10"] = own(MS.share);
    bff.routes["GET /api/v2/models/m-own/check"] = () => state;
    bff.routes["POST /api/v2/models/m-own/check"] = (c: Call) => {
      const sent = c.json as { example_id: string };
      const items = state.items.map((x) => (x.example_id === sent.example_id ? { ...x, kept: true } : x));
      state = { ...state, items, done: items.every((x) => x.kept !== null) };
      return state;
    };
    await madeModel();
    await tap("Do it later");
    expect(text()).toContain("Now it guesses. You check.");
    expect(text()).toContain("My scalp is tight and flaky after washing.");
    expect(text()).toContain("Is this a dry scalp?");
    expect(text()).toContain("Its guess: Yes");
    expect(text()).not.toMatch(/\d/);
    await tap("Keep");
    expect(text()).toContain("My hair feels soft and my scalp is calm.");
    await back();
    expect(text()).toContain("My scalp is tight and flaky after washing.");
    await tap("Keep");
    await tap("Change");
    expect(text()).toContain("What's the right answer?");
    expect(text()).toContain("Each fix teaches it.");
    expect([...container.querySelectorAll("button")].map((b) => b.textContent)).not.toContain("Somewhat");
    await tap("No");
    const posted = bff.calls.filter((c) => c.path === "/api/v2/models/m-own/check" && c.method === "POST").map((c) => c.json);
    expect(posted).toEqual([{ example_id: "c1", keep: true }, { example_id: "c1", keep: true }, { example_id: "c2", keep: false, answer: "No" }]);
    expect(text()).toContain("Add another model?");
  });

  it("FIRST-23 a new model has no examples yet: the host adds one of their own for that model", async () => {
    bff.routes["GET /api/v2/models/m-own/setup/first-ten"] = own(MS.first10None);
    bff.routes["GET /api/v2/models/queue"] = { models: [{ id: "other", name: "Someone's model" }], examples: [] };
    await madeModel();
    expect(text()).toContain("A case is one real thing someone sent you.");
    expect(text()).toContain("Upload a set");
    expect(text()).not.toContain("Someone's model");
    // A set of their own cases (N645), with no answer; then answered as the first 10.
    bff.routes["POST /api/v2/models/m-own/examples/set"] = { added: 2, skipped: 0 };
    await tap("Upload a set");
    await tap("Texts");
    await tap("I may use these.");
    const file = container.querySelector<HTMLInputElement>("[data-model-add-files]")!;
    bff.routes["GET /api/v2/models/m-own/setup/first-ten"] = own(MS.first10Teach);
    await act(async () => {
      Object.defineProperty(file, "files", {
        value: [new File(["My scalp itches after I wash it."], "a.txt", { type: "text/plain" }), new File(["It flakes in winter."], "b.txt", { type: "text/plain" })],
        configurable: true,
      });
      file.dispatchEvent(new Event("change", { bubbles: true }));
    });
    await flush();
    expect(bff.calls.find((c) => c.path === "/api/v2/models/m-own/examples/set")?.json).toEqual({ texts: ["My scalp itches after I wash it.", "It flakes in winter."], may_use: true });
    expect(text()).toContain("How rushed does it sound?");
    bff.routes["GET /api/v2/models/m-own/setup/first-ten"] = own(MS.first10None);
    act(() => root.unmount());
    root = createRoot(container);
    await madeModel();
    const back = container.querySelector<HTMLButtonElement>("[data-walk-nav] button, button[aria-label]")!;
    await act(async () => back.click());
    await flush();
    expect(text()).toContain("Add another model?");
  });

  it("FIRST-22 who answers is three plain choices on one screen; one tap chooses", async () => {
    await begun();
    await keepTo("Right now your chat isn't a specialist in anything.");
    await tap("Not now");
    for (const w of ["I draft, you send", "Only you", "I answer at once", "Once I have 20 of your own answers to learn from. You correct me afterwards."]) expect(text()).toContain(w);
    await tap("Only you");
    expect(puts("who")).toEqual(["you"]);
    expect(text()).toContain("Your chat is ready.");
  });

  it("FIRST-10 sharing your model asks its price in tokens", async () => {
    await begun();
    await keepTo("Right now your chat isn't a specialist in anything.");
    await tap("Yes");
    await tap("Train your own");
    await tap("Train my own");
    await makeOwn();
    await tap("No");
    await tap("I draft, you send");
    expect(text()).toContain("These are your models. Share them, and earn tokens each time someone uses one.");
    await tap("Share them");
    expect(puts("share")).toEqual([true]);
    expect(text()).toContain("Each use costs them:");
    expect(text()).toContain("2 tokens");
    await tap("Change");
    expect(text()).toContain("1 token");
    await tap("Keep");
    expect(puts("price")).toEqual([1]);
  });

  it("FIRST-14 what your chat costs you: nothing with only your own models; else typed people and the month's total", async () => {
    await begun();
    await keepTo("Right now your chat isn't a specialist in anything.");
    await tap("Yes");
    await tap("Train your own");
    await tap("Train my own");
    await makeOwn();
    await tap("No");
    await tap("I draft, you send");
    await tap("Not now");
    expect(text()).toContain("Your chat costs you nothing.");
    expect(text()).toContain("Every model in it is yours. You pay only when you add someone else's model.");
    expect(container.querySelector("input")).toBeNull();
  });

  it("FIRST-14 with someone else's model: each model's cost, typed people, and the month's total", async () => {
    await begun();
    const SOLD = { lines: [{ q: "Is the skin red?", by: "Kasia", price: 3 }], per_send: 3, month: 120 };
    bff.routes["GET /api/v2/chats/setup/models"] = { models: [{ model_id: "m1", q: "Is the skin red?", opts: ["Yes", "Somewhat", "No"], by: "Kasia", price: 3, fits: true, needs: "" }] };
    bff.routes["PUT /api/v2/chats/setup/models"] = (c: Call) => {
      recipe = { ...recipe, models: (c.json as R).value };
      return { recipe, cost: SOLD };
    };
    bff.routes["PUT /api/v2/chats/setup/cost"] = (c: Call) => {
      const value = (c.json as R).value as { people: number; sends: number };
      recipe = { ...recipe, cost: value };
      return { recipe, cost: { ...SOLD, month: 3 * value.people * value.sends * 4 } };
    };
    await keepTo("Right now your chat isn't a specialist in anything.");
    await tap("Yes");
    await tap("Use a model that exists");
    await tap("Is the skin red?");
    await tap("Add it");
    await tap("No");
    bff.routes["PUT /api/v2/chats/setup/who"] = (c: Call) => {
      recipe = { ...recipe, who: (c.json as R).value };
      return { recipe, cost: SOLD };
    };
    await tap("I draft, you send");
    expect(text()).toContain("What your chat costs you:");
    expect(text()).toContain("Kasia's model");
    expect(text()).toContain("3 tokens");
    expect(text()).toContain("Each time someone sends you something");
    expect(container.querySelector("[data-cost-month]")?.textContent).toBe("120");
    const people = container.querySelector("input") as HTMLInputElement;
    const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!;
    await act(async () => {
      set.call(people, "20");
      people.dispatchEvent(new Event("input", { bubbles: true }));
    });
    await flush();
    expect(puts("cost")).toEqual([{ people: 20, sends: 1 }]);
    expect(container.querySelector("[data-cost-month]")?.textContent).toBe("240");
  });

  it("TRIAL-2 the setup and Test my chat open like a chat: no site bar above them while they are open", async () => {
    backend();
    let covered = false;
    function SiteBar() {
      covered = useSiteBarCovered();
      return null;
    }
    act(() => root.render(createElement("div", null, createElement(SiteBar), createElement(HostSetupRows))));
    await flush();
    expect(covered).toBe(false);
    act(() => void openSetupFromWill(0));
    await flush();
    expect(text()).toContain("What do you do?");
    expect(covered).toBe(true);
    await tap("Answer");
    await type("trichologist");
    await tap("No");
    await keepTo("Right now your chat isn't a specialist in anything.");
    await tap("Not now");
    await tap("I draft, you send");
    await tap("Test my chat");
    expect(container.querySelector("[data-host-own-chat]")).not.toBeNull();
    expect(covered).toBe(true);
    await tap("‹ Back");
    await tap("Not yet");
    expect(container.querySelector("[data-host-setup]")).toBeNull();
    expect(covered).toBe(false);
  });

  it("FIRST-20 Test my chat opens my own chat under my name, taps as orange bubbles, the answer and each model's line", async () => {
    await begun();
    bff.routes["POST /api/v2/chats/setup/try"] = {
      messages: [
        { kind: "answer", body: "Thank you. I can see the crown clearly.", by: "Lena's assistant" },
        { kind: "model", body: "Your scalp looks dry here.", by: "Lena's model" },
      ],
      useful: true,
    };
    await keepTo("Right now your chat isn't a specialist in anything.");
    await tap("Not now");
    await tap("I draft, you send");
    await tap("Test my chat");
    const own = container.querySelector("[data-host-own-chat]");
    expect(own?.textContent).toContain("Lena");
    expect(own?.textContent).toContain(SUGGEST.hello[0]);
    expect(own?.textContent).toContain("Tell me what you'd like to do, and I'll show you where.");
    const taps = [...container.querySelectorAll("[data-host-taps] button")].map((b) => b.textContent);
    expect(taps).toEqual([...SUGGEST.taps[0], "Something else"]);
    await tap("Look at my scalp");
    expect(text()).toContain(SUGGEST.qs[0]);
    await type("My scalp itches.");
    expect(bff.calls.find((c) => c.path === "/api/v2/chats/setup/try")?.json).toEqual({ body: "My scalp itches." });
    expect(text()).toContain("Thank you. I can see the crown clearly.");
    expect(text()).toContain("Lena's assistant");
    expect(text()).toContain("Lena's model");
    expect(text()).toContain("Was this useful?");
    expect(container.querySelector("textarea")).not.toBeNull();
    await tap("‹ Back");
    expect(text()).toContain("Open your chat to people?");
  });

  it("FIRST-11 open it to people: Yes makes it live, and the setup closes", async () => {
    await begun();
    await keepTo("Right now your chat isn't a specialist in anything.");
    await tap("Not now");
    await tap("I draft, you send");
    bff.routes["GET /api/v2/chats/setup"] = { recipe, parts: [], own_chat: { title: "Lena", line: SUGGEST.hello[0], join_line: "People come to Lena with hair and scalp worries." }, cost: FREE };
    await tap("Not now");
    expect(text()).toContain("Anyone with your link can use it. This is what they read before they join:");
    expect(text()).toContain("Lena's chat");
    expect(text()).toContain("People come to Lena with hair and scalp worries.");
    bff.routes["GET /api/v2/chats/setup"] = { recipe: { ...recipe, live: true }, parts: [], own_chat: { title: "Lena", line: SUGGEST.hello[0] }, cost: FREE };
    await tap("Yes");
    expect(puts("live")).toEqual([true]);
    expect(container.querySelector("[data-host-setup]")).toBeNull();
  });

  it("FIRST-21 'I want to edit my chat' said to Will opens the parts again, each one tap to change", async () => {
    const parts = [
      { part: "line", title: "Why people come", value: SUGGEST.line[0] },
      { part: "hello", title: "Your hello", value: SUGGEST.hello[0] },
    ];
    backend({ recipe: first({ live: true }), parts, own_chat: { title: "Lena", line: SUGGEST.hello[0], link: { token: "k7Q2", path: "/c/k7Q2" } }, cost: FREE });
    bff.routes["POST /api/v2/chats/setup/edit"] = { line: "Here are your chat's parts. Tap one to change it.", parts };
    await mount();
    expect(openSetupFromWill(0)).toBe(false);
    await act(async () => { expect(await sayToWill("I want to edit my chat")).toBe(true); });
    await flush();
    expect(bff.calls.find((c) => c.path === "/api/v2/chats/setup/edit")?.json).toEqual({ said: "I want to edit my chat" });
    expect(text()).toContain("Here are your chat's parts. Tap one to change it.");
    expect(text()).toContain("Why people come");
    expect(text()).toContain("willpowerlab.com/c/k7Q2");
    expect(text()).toContain("This link opens your chat.");
    await tap("Your hello");
    expect(text()).toContain("Your chat opens with:");
    await tap("Change");
    await tap("Keep");
    expect(puts("hello")).toEqual([SUGGEST.hello[1]]);
    expect(text()).toContain("Your hello");
  });

  it("N632-2 what the first Take said fills What do you do?, to send as it is or change", async () => {
    backend({ recipe: null, parts: [], own_chat: null, cost: null, spec_guess: "Trichologist" });
    await mount();
    act(() => void openSetupFromWill(0));
    await flush();
    expect(text()).toContain("What do you do?");
    await tap("Answer");
    expect((container.querySelector("textarea") as HTMLTextAreaElement).value).toBe("Trichologist");
    await act(async () => (container.querySelector("form") as HTMLFormElement).requestSubmit());
    await flush();
    expect(bff.calls.find((c) => c.path === "/api/v2/chats/setup/start")?.json).toEqual({ what: "Trichologist" });
    expect(text()).toContain("Is your work about health, law or money?");
  });

  it("N632-4 Start again, quiet under the parts, begins again from What do you do? and the chat is not open until the end", async () => {
    const parts = [{ part: "line", title: "Why people come", value: SUGGEST.line[0] }];
    backend({ recipe: first({ live: true }), parts, own_chat: { title: "Lena", line: SUGGEST.hello[0] }, cost: FREE });
    await mount();
    act(() => void openSetupFromNote());
    await flush();
    expect(text()).toContain("Why people come");
    // Under the parts, not in the foot beside "Back to my chats".
    expect(button("Start again").closest("[data-host-foot]")).toBeNull();
    await tap("Start again");
    expect(text()).toContain("What do you do?");
    await back();
    expect(text()).toContain("Why people come");
    await tap("Start again");
    await tap("Answer");
    await type("barber");
    expect(bff.calls.find((c) => c.path === "/api/v2/chats/setup/start")?.json).toEqual({ what: "barber" });
    expect(text()).toContain("Is your work about health, law or money?");
    await tap("No");
    // Every step again, not back to the parts after one.
    await tap("Keep");
    expect(text()).toContain("What do people send you? Tick all that apply.");
  });

  it("N632-5 a Not now is never final: Your models, after Not now, adds a model and the parts show it", async () => {
    await begun();
    await keepTo("Right now your chat isn't a specialist in anything.");
    await tap("Not now");
    await tap("I draft, you send");
    await tap("Not now");
    // The parts as the backend reads them now: "Your models" always, "None yet" while there are none.
    bff.routes["GET /api/v2/chats/setup"] = () => ({
      recipe,
      parts: [
        { part: "line", title: "Why people come", value: SUGGEST.line[0] },
        { part: "models", title: "Your models", value: ((recipe.models as R[]) ?? []).map((m) => m.q).join(" · ") || "None yet" },
      ],
      own_chat: { title: "Lena", line: SUGGEST.hello[0] },
      cost: FREE,
    });
    await tap("Not yet");
    expect(container.querySelector("[data-host-setup]")).toBeNull();
    act(() => void openSetupFromNote());
    await flush();
    expect(text()).toContain("Your modelsNone yet");
    await tap("Your models");
    expect(text()).toContain("Want to make it trichologist-smart?");
    await back();
    expect(text()).toContain("Your modelsNone yet");
    await tap("Your models");
    await tap("Yes");
    expect(puts("smart")).toEqual([false, true]);
    expect(text()).toContain("Two ways to make it smart. Pick one.");
    await tap("Train your own");
    await tap("Train my own");
    await makeOwn();
    expect(puts("models")).toEqual([[{ ...SUGGEST.models[0], own: true, base: "gpt", gives: "pick" }]]);
    await tap("No");
    // Sharing them, then whether to open it, as in the first run; a Not yet stays a Not yet.
    expect(text()).toContain("These are your models.");
    await tap("Not now");
    expect(text()).toContain("Open your chat to people?");
    await tap("Not yet");
    expect(text()).toContain(`Your models${SUGGEST.models[0].q}`);
  });

  it("FIRST-21 an ordinary message from a host with a set-up chat goes to Will as before", async () => {
    backend({ recipe: first({ live: true }), parts: [], own_chat: { title: "Lena", line: SUGGEST.hello[0] }, cost: FREE });
    bff.routes["POST /api/v2/chats/setup/edit"] = { line: "Here are your chat's parts. Tap one to change it.", parts: [{ part: "line", title: "Why people come", value: "x" }] };
    await mount();
    for (const said of ["How do I record my next talk?", "My chat with Kasia was lovely", "Can I change my slides?"]) {
      await act(async () => { expect(await sayToWill(said)).toBe(false); });
    }
    expect(bff.calls.some((c) => c.path === "/api/v2/chats/setup/edit")).toBe(false);
    expect(container.querySelector("[data-host-setup]")).toBeNull();
    await act(async () => { expect(await sayToWill("Can I change my chat's hello?")).toBe(true); });
  });

  it("FIRST-16 a recipe with nothing suggested (from before, or empty) starts at What do you do?, never an empty step", async () => {
    const empty = first({ suggest: { ...SUGGEST, taps: [], qs: [] } });
    backend({ recipe: empty, parts: [{ part: "taps", title: "They can ask", value: "" }], own_chat: null, cost: FREE });
    bff.routes["POST /api/v2/chats/setup/start"] = { recipe: empty };
    await mount();
    act(() => void openSetupFromNote());
    await flush();
    expect(text()).toContain("What do you do?");
    expect(text()).not.toContain("They can ask");
    // A start whose suggestions come back empty stays here too.
    await tap("Answer");
    await type("trichologist");
    expect(text()).toContain("What do you do?");
    expect(text()).not.toContain("People tap what they want:");
    // Once Will has suggested every step, on as usual.
    bff.routes["POST /api/v2/chats/setup/start"] = { recipe: first() };
    await tap("Answer");
    await type("trichologist");
    expect(text()).toContain("Is your work about health, law or money?");
  });

  it("FIRST-02 404: below the ring no way in opens anything and nothing is drawn", async () => {
    await mount();
    expect(openSetupFromWill(0)).toBe(false);
    expect(openSetupFromNote()).toBe(false);
    expect(await sayToWill("I want to edit my chat")).toBe(false);
    expect(container.textContent).toBe("");
    expect(bff.calls.map((c) => c.path)).toEqual(["/api/v2/chats/setup"]);
  });
});
