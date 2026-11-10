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
    const refused = got && typeof got === "object" && "status" in got ? (got as { status: number; body: unknown }) : null;
    return refused ? { kind: "response", ok: false, ...refused } : { kind: "response", ok: true, status: 200, body: got };
  }),
}));
vi.mock("../../useUserProfile", () => ({ useUserProfile: () => ({ profile: { first_name: "Lena" }, loading: false, isCoach: false }) }));

import HostSetupRows from "./HostSetupRows";
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
  recipe = first();
  bff.routes["GET /api/v2/chats/setup"] = () => read;
  bff.routes["POST /api/v2/chats/setup/start"] = { recipe };
  for (const part of ["care", "line", "send", "out", "hello", "questions", "taps", "smart", "way", "models", "who", "share", "price", "cost", "live"]) {
    bff.routes[`PUT /api/v2/chats/setup/${part}`] = (c: Call) => {
      recipe = { ...recipe, [part]: (c.json as R).value };
      return { recipe, cost: FREE };
    };
  }
  bff.routes["GET /api/v2/chats/setup/models"] = { models: [] };
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
    expect(text()).toContain("Hi Lena. I'm Will. I ask one thing at a time. You tap Keep or Change.");
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
    expect(text()).toContain("Try other words. Your chat can't show scores or verdicts.");
    await tap("Change");
    expect(text()).not.toContain("Try other words.");
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
    await tap("‹ Back");
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

  it("FIRST-19 your own model: what it is, worth it, not worth it; Train my own goes on", async () => {
    await begun();
    await keepTo("Right now your chat isn't a specialist in anything.");
    await tap("Yes");
    await tap("Train your own");
    expect(text()).toContain("Your own model, in plain words:");
    for (const b of ["What it is", "Worth it", "Not worth it"]) expect(text()).toContain(b);
    await tap("Train my own");
    expect(text()).toContain("Now a model. It learns one thing from you.");
  });

  it("FIRST-07 a model is one question with three answers; Change shows another; Keep keeps it", async () => {
    await begun();
    await keepTo("Right now your chat isn't a specialist in anything.");
    await tap("Yes");
    await tap("Train your own");
    await tap("Train my own");
    expect(text()).toContain("Is this a dry scalp?");
    expect(text()).toContain("Yes · Somewhat · No");
    await tap("Change");
    expect(text()).toContain("Is the hair thinning here?");
    await tap("Keep");
    expect(puts("models")).toEqual([[{ ...SUGGEST.models[1], own: true }]]);
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
    await tap("Keep");
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
    await tap("Keep");
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

  it("FIRST-11 open it to people: Yes makes it live, and the list then holds that chat", async () => {
    await begun();
    await keepTo("Right now your chat isn't a specialist in anything.");
    await tap("Not now");
    await tap("I draft, you send");
    await tap("Not now");
    expect(text()).toContain("Anyone with your link can use it.");
    bff.routes["GET /api/v2/chats/setup"] = { recipe: { ...recipe, live: true }, parts: [], own_chat: { title: "Lena", line: SUGGEST.hello[0] }, cost: FREE };
    await tap("Yes");
    expect(puts("live")).toEqual([true]);
    expect(container.querySelector("[data-host-setup]")).toBeNull();
    expect(text()).toContain("your chat");
    expect(text()).toContain(SUGGEST.hello[0]);
  });

  it("FIRST-21 'I want to edit my chat' said to Will opens the parts again, each one tap to change", async () => {
    const parts = [
      { part: "line", title: "Why people come", value: SUGGEST.line[0] },
      { part: "hello", title: "Your hello", value: SUGGEST.hello[0] },
    ];
    backend({ recipe: first({ live: true }), parts, own_chat: { title: "Lena", line: SUGGEST.hello[0] }, cost: FREE });
    bff.routes["POST /api/v2/chats/setup/edit"] = { line: "Here are your chat's parts. Tap one to change it.", parts };
    await mount();
    expect(openSetupFromWill(0)).toBe(false);
    await act(async () => { expect(await sayToWill("I want to edit my chat")).toBe(true); });
    await flush();
    expect(bff.calls.find((c) => c.path === "/api/v2/chats/setup/edit")?.json).toEqual({ said: "I want to edit my chat" });
    expect(text()).toContain("Here are your chat's parts. Tap one to change it.");
    expect(text()).toContain("Why people come");
    await tap("Your hello");
    expect(text()).toContain("Your chat opens with:");
    await tap("Change");
    await tap("Keep");
    expect(puts("hello")).toEqual([SUGGEST.hello[1]]);
    expect(text()).toContain("Your hello");
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

  it("FIRST-02 404: below the ring no way in opens anything and nothing is drawn", async () => {
    await mount();
    expect(openSetupFromWill(0)).toBe(false);
    expect(openSetupFromNote()).toBe(false);
    expect(await sayToWill("I want to edit my chat")).toBe(false);
    expect(container.textContent).toBe("");
    expect(bff.calls.map((c) => c.path)).toEqual(["/api/v2/chats/setup"]);
  });
});
