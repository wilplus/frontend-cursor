// @vitest-environment jsdom
/*
STORY    As a host with the chat builder's ring, my chat is built in Build:
         "Your chat" holds its parts and what needs me about it (the answers
         Will drafted, a model left out, a changed price); "AI models" holds
         the models and everything I teach, my speakers' moments among it, so
         a coach always reaches them; Live is my chat as people meet it. The
         list of chats holds Will and people only, and I send drafted answers
         one per screen, changing the words where I want (backend N629, N642,
         N643).
OUTCOME
  O1  Drafted answers, one per screen, in N629's words; Change sends my own
      words, Back never sends a sent one twice; then "All sent." and Done.
  O2  Build's "Your chat": Will's line and the parts, each opening its step
      and coming back to Build; the answers to send under them; without a
      chat, "Your chat" opens the setup at "What do you do?".
  O4  A model left out today for want of tokens is a line to read in Will,
      one of the things that need me (backend N630 item 1).
  O5  A model whose price changed is a line in Will with Keep and Drop; one
      tap saves the chat's models and the line goes (backend N633 item 4).
  O3  With the ring the list has no "Your queue" and no "AI models" rows,
      and its pinned row is my own chat under its name with its hello
      ("Your chat" before there is one); without it, as it was.
  O6  A ring coach reaches the moments from Build's AI models in every state
      (no chat, Live, Build); someone who is not a coach has no such line.
  O7  AI models: the models and what is taught, each opening where it is
      worked today, and Start your own; Live is the test chat under the
      chat's name with "You run this chat.", the switch only once there is
      something to try.
  O8  AI models shows the queue's tasks as models with what waits, each
      opening the queue, and "Images, coming." and "Video, coming." with
      "I want this", which tells the founder once (backend N642 item 6).
PROVES   O1 -> "N629-3 drafted answers: one per screen, Change sends my own words, Back never sends twice"
         O4 -> "N630-1 a model left out today because the host is out of tokens gets its line in Will"
         O5 -> "N633-4 a changed price: Keep keeps the model at the new price, Drop drops it, each line then goes"
         O2 -> "N642-3 Build's Your chat: Will's line, the chat's parts, each opening its step, then the answers to send; what is taught is not here"
         O2 -> "N642-3 a part opened from Build opens its step, and Keep comes back to Build, not to the parts"
         O2 -> "N629-1 without a chat of the new setup, Your chat opens the setup at What do you do?"
         O3 -> "N642-2 for the ring the pinned row is one's own chat, its circle, name and hello; Your chat before there is one; without the ring as it was"
         O6 -> "N642-5 a ring coach always reaches the moments from their chat: Build's AI models, with or without a chat, from Live too"
         O6 -> "N642-5 someone who is not a coach has no moments line in AI models"
         O7 -> "N642-3 AI models: the models and what is taught, each opening where it is worked today, and Start your own"
         O8 -> "N642-6 AI models shows the queue's tasks as models, each opening the queue, and images and video coming with I want this"
         O7 -> "N642-3 Live is the chat as people meet it, under its name with You run this chat.; the switch shows only once there is something to try"
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
    const body = typeof answer === "function" ? (answer as (c: Call) => unknown)(call) : answer;
    return { kind: "response", ok: true, status: 200, body };
  }),
}));
const moments = vi.hoisted(() => ({ speakers: [] as { waiting: number }[] }));
vi.mock("@/services/api/coachWalk", async (orig) => ({
  ...(await orig<typeof import("@/services/api/coachWalk")>()),
  fetchMomentsQueue: vi.fn(async () => ({ ok: true, speakers: moments.speakers })),
}));
const who = vi.hoisted(() => ({ coach: true }));
vi.mock("../../useUserProfile", () => ({ useUserProfile: () => ({ profile: { first_name: "Lena" }, loading: false, isCoach: who.coach }) }));

import HostSetupRows from "./HostSetupRows";
import WillNeedsYou from "./WillNeedsYou";
import ChatList from "../ChatList";
import WillBuild from "../WillBuild";
import { forgetSetup, openOverList, OPEN_EVENT } from "./hostSetupDoor";
import { forgetHostWork } from "./hostWork";
import { OPEN_QUEUE_EVENT } from "@/lib/willab/coachDoor";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const RECIPE = {
  spec: "Trichologist",
  suggest: { line: [], send: [], out: [], hello: [], qs: [], taps: [], models: [], sample_in: "", sample_out: "" },
  models: [{ q: "Is this a dry scalp?", opts: ["Yes", "Somewhat", "No"], says: "", own: true, model_id: "m1" }],
};
const SETUP = { recipe: RECIPE, parts: [], own_chat: { title: "Lena", line: "Hi." }, cost: null };
const DRAFTS = [
  { message_id: "d1", thread_id: "t1", from: "Kasia", said: "My scalp itches after washing.", answer: "Try a milder shampoo for a week.",
    lines: [{ body: "Your scalp looks dry here.", by: "Lena's model" }], sensitive: false },
  { message_id: "d2", thread_id: "t2", from: "Tomek", said: "Is thinning normal?", answer: "Some thinning is common.", lines: [], sensitive: false },
];

let container: HTMLDivElement;
let root: Root;
beforeEach(() => {
  bff.calls = [];
  bff.routes = {};
  moments.speakers = [];
  who.coach = true;
  forgetSetup();
  forgetHostWork();
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
  for (let i = 0; i < 8; i += 1) await act(async () => { await Promise.resolve(); });
};
const text = () => container.textContent ?? "";
async function tap(label: string) {
  const b = [...container.querySelectorAll("button")].find((x) => x.textContent?.trim() === label || x.textContent?.includes(label));
  if (!b) throw new Error(`no button "${label}" in: ${text()}`);
  await act(async () => (b as HTMLButtonElement).click());
  await flush();
}
const posts = () => bff.calls.filter((c) => c.method === "POST" && c.path.startsWith("/api/v2/chats/setup/drafts/"));

describe("what needs you is in Will (backend N629)", () => {
  it("N629-3 drafted answers: one per screen, Change sends my own words, Back never sends twice", async () => {
    bff.routes["GET /api/v2/chats/setup"] = SETUP;
    bff.routes["GET /api/v2/chats/setup/drafts"] = { drafts: DRAFTS };
    bff.routes["POST /api/v2/chats/setup/drafts/d1/send"] = { message: { id: "m1" } };
    bff.routes["POST /api/v2/chats/setup/drafts/d2/send"] = { message: { id: "m2" } };
    act(() => root.render(createElement(HostSetupRows)));
    await flush();
    act(() => openOverList({ open: "drafts" }));
    await flush();
    expect(text()).toContain("Kasia asked:");
    expect(text()).toContain("My scalp itches after washing.");
    expect(text()).toContain("I'd answer:");
    expect(text()).toContain("Try a milder shampoo for a week.");
    expect(text()).toContain("Your scalp looks dry here.");
    expect(text()).toContain("Lena's model");
    await tap("Send");
    expect(text()).toContain("Tomek asked:");
    await tap("Change");
    const box = container.querySelector("[data-draft-words]") as HTMLTextAreaElement;
    await act(async () => {
      Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value")!.set!.call(box, "Some thinning is normal. Send me a photo.");
      box.dispatchEvent(new Event("input", { bubbles: true }));
    });
    await tap("Send");
    expect(text()).toContain("All sent.");
    expect(text()).toContain("Each one you changed teaches me to answer like you.");
    await act(async () => container.querySelector<HTMLButtonElement>('[data-one-top-bar] button[aria-label="Back"]')!.click());
    await flush();
    expect(text()).toContain("Tomek asked:");
    await tap("Send");
    expect(posts().map((c) => [c.path, c.json])).toEqual([
      ["/api/v2/chats/setup/drafts/d1/send", {}],
      ["/api/v2/chats/setup/drafts/d2/send", { body: "Some thinning is normal. Send me a photo." }],
    ]);
    await tap("Done");
    expect(container.querySelector("[data-host-setup]")).toBeNull();
  });

  it("N651 the parts sit in four groups under their headings, a group with no part is absent, an unknown part comes last with none", async () => {
    const p = (part: string, value = "x") => ({ part, title: `T-${part}`, value });
    bff.routes["GET /api/v2/chats/setup"] = { ...SETUP, parts: [p("odd"), p("models", "None yet"), p("who"), p("taps"), p("name")] };
    act(() => root.render(createElement("div", null, createElement(WillNeedsYou), createElement(HostSetupRows))));
    await flush();
    const seq = [...container.querySelectorAll("[data-will-needs-you] h3, [data-build-part]")].map((e) => (e.tagName === "H3" ? `# ${e.textContent}` : (e as HTMLElement).dataset.buildPart));
    expect(seq).toEqual(["# About your chat", "name", "# What comes in", "taps", "# What goes back", "who", "# What makes it smart", "models", "odd"]);
  });

  it("N642-3 Build's Your chat: Will's line, the chat's parts, each opening its step, then the answers to send; what is taught is not here", async () => {
    const parts = [
      { part: "name", title: "Name", value: "Ask Lena" },
      { part: "line", title: "Why people come", value: "People come to you with scalp worries." },
    ];
    bff.routes["GET /api/v2/chats/setup"] = { ...SETUP, parts };
    bff.routes["GET /api/v2/chats/setup/drafts"] = { drafts: DRAFTS };
    bff.routes["GET /api/v2/models/queue"] = { models: [], examples: [{ id: "e1", model_id: "m1" }] };
    bff.routes["GET /api/v2/models/m1/check"] = { version: "v1", answers: ["Yes", "Somewhat", "No"], items: [{ example_id: "c1", example: {}, guess: "Yes", kept: null, answer: null }], done: false };
    moments.speakers = [{ waiting: 2 }, { waiting: 1 }];
    act(() => root.render(createElement("div", null, createElement(WillNeedsYou), createElement(HostSetupRows))));
    await flush();
    const mine = () => container.querySelector("[data-will-needs-you]")?.textContent ?? "";
    expect(mine().startsWith("Your chat is saved. Nobody can see it yet. Tap a part to change it.")).toBe(true);
    expect([...container.querySelectorAll("[data-build-part]")].map((r) => r.textContent)).toEqual([
      "NameAsk Lena›",
      "Why people comePeople come to you with scalp worries.›",
    ]);
    expect([...container.querySelectorAll("[data-needs-you]")].map((r) => r.textContent)).toEqual(["2 answers to sendI drafted them. You fix and send.›"]);
    expect(mine()).toContain("This needs you:");
    for (const gone of ["moments to answer", "example to teach", "model to check", "And yours to open any time:", "Teach one, or start your own."]) {
      expect(mine()).not.toContain(gone);
    }
    const opened: unknown[] = [];
    const onOpen = (e: Event) => opened.push((e as CustomEvent).detail);
    window.addEventListener(OPEN_EVENT, onOpen);
    await act(async () => (container.querySelector('[data-build-part="line"]') as HTMLButtonElement).click());
    await act(async () => (container.querySelector('[data-needs-you="answers"]') as HTMLButtonElement).click());
    window.removeEventListener(OPEN_EVENT, onOpen);
    expect(opened).toEqual([{ part: "line" }, { open: "drafts" }]);
  });

  it("N642-3 a part opened from Build opens its step, and Keep comes back to Build, not to the parts", async () => {
    const parts = [{ part: "hello", title: "Your hello", value: "Hi." }];
    const recipe = {
      ...RECIPE,
      suggest: { ...RECIPE.suggest, line: ["a"], send: ["text"], out: ["answer"], hello: ["Hi.", "Welcome."], qs: ["q"], taps: [["t"]], models: [{ q: "q", opts: ["a", "b", "c"], says: "" }] },
      line: "a", send: ["text"], out: "answer", hello: "Hi.", questions: [], taps: ["t"], smart: false, way: "own", who: "shadow",
      share: false, price: 0, cost: { people: 0, sends: 0 }, live: true,
    };
    bff.routes["GET /api/v2/chats/setup"] = { ...SETUP, recipe, parts };
    bff.routes["PUT /api/v2/chats/setup/hello"] = (c: Call) => ({ recipe: { ...recipe, hello: (c.json as { value: string }).value }, cost: null });
    act(() => root.render(createElement("div", null, createElement(WillNeedsYou), createElement(HostSetupRows))));
    await flush();
    await act(async () => (container.querySelector('[data-build-part="hello"]') as HTMLButtonElement).click());
    await flush();
    expect(container.querySelector("[data-host-setup]")?.textContent).toContain("Your chat opens with:");
    await tap("Change");
    await tap("Keep");
    expect(bff.calls.filter((c) => c.path === "/api/v2/chats/setup/hello").map((c) => (c.json as { value: string }).value)).toEqual(["Welcome."]);
    expect(container.querySelector("[data-host-setup]")).toBeNull();
  });

  it("N629-1 without a chat of the new setup, Your chat opens the setup at What do you do?", async () => {
    // A coach whose chat came from the older builder: no v2 recipe.
    bff.routes["GET /api/v2/chats/setup"] = { recipe: null, parts: [], own_chat: null, cost: null };
    act(() => root.render(createElement("div", null, createElement(WillNeedsYou), createElement(HostSetupRows))));
    await flush();
    await act(async () => (container.querySelector('[data-needs-you="chat"]') as HTMLButtonElement).click());
    await flush();
    expect(container.querySelector("[data-host-setup]")?.textContent).toContain("What do you do?");
  });

  it("N642-2 for the ring the pinned row is one's own chat, its circle, name and hello; Your chat before there is one; without the ring as it was", async () => {
    const list = () =>
      createElement(ChatList, {
        chats: [],
        coachRow: createElement("div", { "data-coach-row-marker": "" }),
        modelsRows: createElement("div", { "data-models-rows-marker": "" }),
        setupRows: createElement(HostSetupRows),
        onOpenWill: () => undefined,
        onOpen: () => undefined,
      });
    const pinned = () => container.querySelector('[data-chat-row="will"]')?.textContent ?? "";
    // Without the ring: the rows as they are, Will as he was.
    act(() => root.render(list()));
    await flush();
    expect(container.querySelector("[data-coach-row-marker]")).not.toBeNull();
    expect(container.querySelector("[data-models-rows-marker]")).not.toBeNull();
    expect(pinned()).toContain("Will");
    expect(text()).not.toMatch(/need you|needs you/);

    // With it and a chat: one row, the chat's name and its hello; no
    // second row for one's own chat, no coach or models rows.
    forgetHostWork();
    forgetSetup();
    bff.routes["GET /api/v2/chats/setup"] = { ...SETUP, own_chat: { title: "Ask Lena", line: "Hi.", hello: "Hi. Show me your scalp." } };
    act(() => root.unmount());
    root = createRoot(container);
    act(() => root.render(list()));
    await flush();
    expect(container.querySelector("[data-coach-row-marker]")).toBeNull();
    expect(container.querySelector("[data-models-rows-marker]")).toBeNull();
    expect(pinned()).toContain("Ask Lena");
    expect(pinned()).toContain("Hi. Show me your scalp.");
    expect(pinned()).not.toContain("Will");
    expect(text().match(/Ask Lena/g)?.length).toBe(1);

    // No chat yet: "Your chat".
    forgetHostWork();
    forgetSetup();
    bff.routes["GET /api/v2/chats/setup"] = { recipe: null, parts: [], own_chat: null, cost: null };
    act(() => root.unmount());
    root = createRoot(container);
    act(() => root.render(list()));
    await flush();
    expect(pinned()).toContain("Your chat");
  });

  it("N630-1 a model left out today because the host is out of tokens gets its line in Will", async () => {
    const d = new Date();
    const two = (n: number) => String(n).padStart(2, "0");
    const on = `${d.getFullYear()}-${two(d.getMonth() + 1)}-${two(d.getDate())}`;
    bff.routes["GET /api/v2/chats/setup"] = {
      ...SETUP,
      skipped_models: [
        { model_id: "k1", q: "Is the skin red?", by: "Kasia", on },
        { model_id: "t1", q: "Is it thinning?", by: "Tomek", on: "2001-01-01" },
      ],
    };
    act(() => root.render(createElement(WillNeedsYou)));
    await flush();
    expect(text()).toContain("This needs you:");
    const left = [...container.querySelectorAll("[data-left-out]")].map((p) => p.textContent);
    expect(left).toEqual(["I left out Kasia's model today. You're out of tokens."]);
    expect(container.querySelector("[data-left-out] button, button[data-left-out]")).toBeNull();
  });

  it("N633-4 a changed price: Keep keeps the model at the new price, Drop drops it, each line then goes", async () => {
    const kasia = { q: "Is the skin red?", opts: ["Yes", "Somewhat", "No"], says: "", own: false, model_id: "k1", by: "Kasia", price: 3 };
    const tomek = { q: "Is it thinning?", opts: ["Yes", "Somewhat", "No"], says: "", own: false, model_id: "t1", by: "Tomek", price: 0, learning: true };
    let models: Record<string, unknown>[] = [...RECIPE.models, kasia, tomek];
    let changes = [
      { model_id: "k1", q: kasia.q, by: "Kasia", was: 3, now: 5 },
      // A model added while still learning that has passed: the same line.
      { model_id: "t1", q: tomek.q, by: "Tomek", was: 0, now: 2 },
    ];
    bff.routes["GET /api/v2/chats/setup"] = () => ({ ...SETUP, recipe: { ...RECIPE, models }, price_changes: changes });
    bff.routes["PUT /api/v2/chats/setup/models"] = (c: Call) => {
      models = (c.json as { value: Record<string, unknown>[] }).value;
      changes = changes.filter((ch) => !models.some((m) => m.model_id === ch.model_id && m.price === ch.now) && models.some((m) => m.model_id === ch.model_id));
      return { recipe: { ...RECIPE, models }, cost: null };
    };
    act(() => root.render(createElement(WillNeedsYou)));
    await flush();
    expect(text()).toContain("This needs you:");
    const lines = () => [...container.querySelectorAll("[data-price-changed] p")].map((p) => p.textContent);
    expect(lines()).toEqual([
      "Kasia changed the price of their model. Keep it at the new price, or drop it?",
      "Tomek changed the price of their model. Keep it at the new price, or drop it?",
    ]);
    const tapIn = async (id: string, label: string) => {
      const b = [...container.querySelectorAll(`[data-price-changed="${id}"] button`)].find((x) => x.textContent === label) as HTMLButtonElement;
      await act(async () => b.click());
      await flush();
    };
    await tapIn("k1", "Keep");
    const saved = (k: number) => (bff.calls.filter((c) => c.method === "PUT" && c.path === "/api/v2/chats/setup/models")[k].json as { value: unknown }).value;
    expect(saved(0)).toEqual([RECIPE.models[0], { ...kasia, price: 5 }, tomek]);
    expect(lines()).toEqual(["Tomek changed the price of their model. Keep it at the new price, or drop it?"]);
    await tapIn("t1", "Drop");
    expect(saved(1)).toEqual([RECIPE.models[0], { ...kasia, price: 5 }]);
    expect(container.querySelector("[data-price-changed]")).toBeNull();
  });

  /** Will's chat for the ring, as the door draws it: Build's bar and tabs
   *  over Will's lines, with the list's setup rows that read the setup. */
  async function build(read: Record<string, unknown>) {
    bff.routes["GET /api/v2/chats/setup"] = read;
    act(() => root.render(createElement("div", null, createElement(WillBuild, { onBack: () => undefined }), createElement(WillNeedsYou), createElement(HostSetupRows))));
    await flush();
  }
  const queueOpened = async () => {
    const got: unknown[] = [];
    const on = (e: Event) => got.push((e as CustomEvent).detail);
    window.addEventListener(OPEN_QUEUE_EVENT, on);
    await act(async () => (container.querySelector('[data-needs-you="moments"]') as HTMLButtonElement).click());
    window.removeEventListener(OPEN_QUEUE_EVENT, on);
    return got;
  };
  const tab = async (t: string) => {
    await act(async () => (container.querySelector(`[data-build-tab="${t}"]`) as HTMLButtonElement).click());
    await flush();
  };
  const toggle = async (m: string) => {
    await act(async () => (container.querySelector(`[data-switch="${m}"]`) as HTMLButtonElement).click());
    await flush();
  };

  it("N642-5 a ring coach always reaches the moments from their chat: Build's AI models, with or without a chat, from Live too", async () => {
    moments.speakers = [{ waiting: 2 }, { waiting: 1 }];
    // No chat yet: no switch, Build at once; the moments in AI models.
    await build({ recipe: null, parts: [], own_chat: null, cost: null, can_try: false });
    expect(container.querySelector("[data-live-build]")).toBeNull();
    expect(container.querySelector("[data-build-bar] [data-walk-back-label]")?.textContent).toBe("Your chat");
    await tab("models");
    expect(container.querySelector('[data-needs-you="moments"]')?.textContent).toBe("Moments to answer3 waiting›");
    expect(await queueOpened()).toEqual([{ fromWill: true }]);

    // A chat: Live, then Build, then AI models, and the moments are there.
    act(() => root.unmount());
    root = createRoot(container);
    forgetSetup();
    forgetHostWork();
    await build({ ...SETUP, recipe: { ...RECIPE, hello: "Hi.", taps: [], questions: [] }, own_chat: { title: "Ask Lena", line: "Hi." }, can_try: true });
    // Opened, a chat with something to try is Live.
    expect(container.querySelector("[data-build-tab]")).toBeNull();
    await toggle("build");
    await tab("models");
    expect(await queueOpened()).toEqual([{ fromWill: true }]);
    // And nothing waiting: the line stays, so the way in never goes.
    act(() => root.unmount());
    root = createRoot(container);
    forgetSetup();
    forgetHostWork();
    moments.speakers = [];
    await build({ ...SETUP, recipe: { ...RECIPE, hello: "Hi.", taps: [], questions: [] }, can_try: true });
    await toggle("build");
    await tab("models");
    expect(container.querySelector('[data-needs-you="moments"]')?.textContent).toBe("Moments to answer0 waiting›");
  });

  it("N642-5 someone who is not a coach has no moments line in AI models", async () => {
    who.coach = false;
    await build({ ...SETUP, can_try: false });
    await tab("models");
    expect(container.querySelector("[data-build-models]")).not.toBeNull();
    expect(container.querySelector('[data-needs-you="moments"]')).toBeNull();
  });

  it("N642-3 AI models: the models and what is taught, each opening where it is worked today, and Start your own", async () => {
    bff.routes["GET /api/v2/models/queue"] = { models: [], examples: [{ id: "e1", model_id: "m1" }] };
    bff.routes["GET /api/v2/models/m1/check"] = { version: "v1", answers: ["Yes"], items: [{ example_id: "c1", example: {}, guess: "Yes", kept: null, answer: null }], done: false };
    const kasia = { q: "Is the skin red?", opts: ["Yes", "Somewhat", "No"], says: "", own: false, model_id: "k1", by: "Kasia" };
    await build({ ...SETUP, recipe: { ...RECIPE, models: [...RECIPE.models, kasia] }, can_try: false });
    await tab("models");
    const models = container.querySelector("[data-build-models]")!;
    expect(models.textContent?.startsWith("Your models, and everything you teach.")).toBe(true);
    expect([...models.querySelectorAll("[data-needs-you]")].map((r) => r.textContent)).toEqual([
      "Is this a dry scalp?Teach it›",
      "Is the skin red?Kasia's model›",
      "Moments to answer0 waiting›",
      "1 example to teachFor the models you teach.›",
      "1 model to checkIts guesses, on examples it has not seen.›",
    ]);
    const opened: unknown[] = [];
    const on = (e: Event) => opened.push((e as CustomEvent).detail);
    window.addEventListener(OPEN_EVENT, on);
    for (const el of [...models.querySelectorAll('[data-needs-you="model"]'), models.querySelector('[data-needs-you="examples"]'), models.querySelector('[data-needs-you="check"]'), models.querySelector("[data-build-start]")]) {
      await act(async () => (el as HTMLButtonElement).click());
    }
    window.removeEventListener(OPEN_EVENT, on);
    expect(opened).toEqual([
      { open: "models", modelId: "m1" },
      { open: "models", modelId: "k1" },
      { open: "teach" },
      { open: "check", modelId: "m1" },
      { open: "start" },
    ]);
    expect(models.textContent).toContain("Start your own");
  });

  it("N642-3 Live is the chat as people meet it, under its name with You run this chat.; the switch shows only once there is something to try", async () => {
    bff.routes["POST /api/v2/chats/setup/try"] = { messages: [{ kind: "answer", body: "Try a milder shampoo.", by: "Lena" }] };
    await build({
      ...SETUP,
      recipe: { ...RECIPE, hello: "Hi.", taps: [], questions: [] },
      own_chat: { title: "Ask Lena", line: "Hi.", about: ["Lena is a trichologist."], hello: "Hi. Show me your scalp.", taps: ["Look at my scalp", "Something else"] },
      can_try: true,
    });
    // Opened: Live, the chat as people meet it, its about lines, hello and taps.
    expect([...container.querySelectorAll("[data-switch]")].map((b) => b.textContent)).toEqual(["Live", "Build"]);
    expect(container.querySelector("[data-chat-header]")?.textContent).toContain("Ask LenaYou run this chat.");
    const live = container.querySelector("[data-host-own-chat]")?.textContent ?? "";
    expect(live).toContain("Lena is a trichologist.");
    expect(live).toContain("Hi. Show me your scalp.");
    expect([...container.querySelectorAll("[data-host-taps] button")].map((b) => b.textContent)).toEqual(["Look at my scalp", "Something else"]);
    await toggle("build");
    expect(container.querySelector("[data-build-bar] [data-walk-back-label]")?.textContent).toBe("Ask Lena");
    act(() => root.unmount());
    root = createRoot(container);
    forgetSetup();
    forgetHostWork();
    await build({ ...SETUP, can_try: false });
    expect(container.querySelector("[data-live-build]")).toBeNull();
  });

  it("N642-6 AI models shows the queue's tasks as models, each opening the queue, and images and video coming with I want this", async () => {
    bff.routes["GET /api/v2/models/coach-tasks"] = {
      tasks: [
        { id: "moments", kind: "moments", title: "Moments to answer", line: "", waiting: 37, open: { at: "coach_queue" } },
        { id: "hear_it", kind: "hear_it", title: "Do you hear it?", line: "", waiting: 20, open: { at: "screen", screen: "error_audit" } },
      ],
      coming: [{ kind: "images", title: "Images", wanted: false }, { kind: "video", title: "Video", wanted: true }, { kind: "recordings", title: "", wanted: false }],
    };
    let told = 0;
    bff.routes["POST /api/v2/models/coming/images/want"] = () => {
      told += 1;
      return { wanted: true };
    };
    await build({ ...SETUP, can_try: false });
    await tab("models");
    const models = container.querySelector("[data-build-models]")!;
    const rows = [...models.querySelectorAll("[data-needs-you]")].map((r) => r.textContent);
    expect(rows).toContain("Moments to answer37 waiting›");
    expect(rows).toContain("Do you hear it?20 waiting›");
    expect(rows.filter((r) => r?.startsWith("Moments to answer"))).toHaveLength(1);
    const got: unknown[] = [];
    const on = (e: Event) => got.push((e as CustomEvent).detail);
    window.addEventListener(OPEN_QUEUE_EVENT, on);
    await act(async () => (models.querySelector('[data-needs-you="task"]') as HTMLButtonElement).click());
    window.removeEventListener(OPEN_QUEUE_EVENT, on);
    expect(got).toEqual([{ fromWill: true }]);
    const coming = () => [...models.querySelectorAll("[data-build-coming]")].map((b) => b.textContent);
    expect(coming()).toEqual(["Images, coming. I want this", "Video, coming. Thanks. I've told Artur."]);
    await act(async () => (models.querySelector('[data-build-coming="images"]') as HTMLButtonElement).click());
    await flush();
    expect(coming()).toEqual(["Images, coming. Thanks. I've told Artur.", "Video, coming. Thanks. I've told Artur."]);
    await act(async () => (models.querySelector('[data-build-coming="images"]') as HTMLButtonElement).click());
    await flush();
    expect(told).toBe(1);
  });
});
