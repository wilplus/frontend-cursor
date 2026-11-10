// @vitest-environment jsdom
/*
STORY    As a host with the chat builder's ring, I find what needs me in
         Will: the answers he drafted, my speakers' moments, examples to
         teach and models to check, each opening its work; the list of chats
         holds Will and people only; and I send drafted answers one per
         screen, changing the words where I want (backend N629).
OUTCOME
  O1  Drafted answers, one per screen, in N629's words; Change sends my own
      words, Back never sends a sent one twice; then "All sent." and Done.
  O2  Will's lines count my own work from routes that exist, in N629's
      words, singular and plural, each opening its work.
  O4  A model left out today for want of tokens is a line to read in Will,
      one of the things that need me (backend N630 item 1).
  O3  With the ring the list has no "Your queue" and no "AI models" rows and
      Will's line says how many things need me; without it, as it was.
PROVES   O1 -> "N629-3 drafted answers: one per screen, Change sends my own words, Back never sends twice"
         O4 -> "N630-1 a model left out today because the host is out of tokens gets its line in Will and counts in the list"
         O2 -> "N629-1 Will says what needs you, each line opening its work; nothing waiting says so"
         O3 -> "N629-2 the list holds Will and people only, Will's line counts what needs you; without the ring as it was"
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
vi.mock("../../useUserProfile", () => ({ useUserProfile: () => ({ profile: { first_name: "Lena" }, loading: false, isCoach: true }) }));

import HostSetupRows from "./HostSetupRows";
import WillNeedsYou from "./WillNeedsYou";
import ChatList from "../ChatList";
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
    await tap("‹ Back");
    expect(text()).toContain("Tomek asked:");
    await tap("Send");
    expect(posts().map((c) => [c.path, c.json])).toEqual([
      ["/api/v2/chats/setup/drafts/d1/send", {}],
      ["/api/v2/chats/setup/drafts/d2/send", { body: "Some thinning is normal. Send me a photo." }],
    ]);
    await tap("Done");
    expect(container.querySelector("[data-host-setup]")).toBeNull();
  });

  it("N629-1 Will says what needs you, each line opening its work; nothing waiting says so", async () => {
    bff.routes["GET /api/v2/chats/setup"] = SETUP;
    bff.routes["GET /api/v2/chats/setup/drafts"] = { drafts: DRAFTS };
    bff.routes["GET /api/v2/models/queue"] = { models: [], examples: [{ id: "e1", model_id: "m1" }] };
    bff.routes["GET /api/v2/models/m1/check"] = { version: "v1", answers: ["Yes", "Somewhat", "No"], items: [{ example_id: "c1", example: {}, guess: "Yes", kept: null, answer: null }], done: false };
    moments.speakers = [{ waiting: 2 }, { waiting: 1 }];
    act(() => root.render(createElement(WillNeedsYou)));
    await flush();
    const rows = [...container.querySelectorAll("[data-needs-you]")].map((r) => r.textContent);
    expect(text().startsWith("This needs you:")).toBe(true);
    expect(rows).toEqual([
      "2 answers to sendI drafted them. You fix and send.›",
      "3 moments to answerFrom your speakers. Nobody shows you my guess first.›",
      "1 example to teachFor the models you teach.›",
      "1 model to checkIts guesses, on examples it has not seen.›",
      "AI modelsTeach one, or start your own.›",
      "Your chatSee it, test it, change it.›",
    ]);
    expect(text()).toContain("And yours to open any time:");
    const opened: unknown[] = [];
    const onOpen = (e: Event) => opened.push((e as CustomEvent).detail ?? "queue");
    window.addEventListener(OPEN_EVENT, onOpen);
    window.addEventListener(OPEN_QUEUE_EVENT, onOpen);
    for (const kind of ["answers", "moments", "examples", "check", "models", "chat"]) {
      await act(async () => (container.querySelector(`[data-needs-you="${kind}"]`) as HTMLButtonElement).click());
    }
    window.removeEventListener(OPEN_EVENT, onOpen);
    window.removeEventListener(OPEN_QUEUE_EVENT, onOpen);
    expect(opened).toEqual([{ open: "drafts" }, "queue", { open: "teach" }, { open: "check", modelId: "m1" }, { open: "models" }, { open: "parts" }]);

    // Nothing waiting: Will says so, and the AI models stay to open.
    forgetHostWork();
    bff.routes["GET /api/v2/chats/setup/drafts"] = { drafts: [] };
    bff.routes["GET /api/v2/models/queue"] = { models: [], examples: [] };
    bff.routes["GET /api/v2/models/m1/check"] = { version: "v1", answers: [], items: [], done: true };
    moments.speakers = [];
    act(() => root.unmount());
    root = createRoot(container);
    act(() => root.render(createElement(WillNeedsYou)));
    await flush();
    expect(text()).toContain("Nothing needs you now.");
    expect(text()).not.toContain("This needs you:");
    expect(container.querySelector('[data-needs-you="models"]')).not.toBeNull();
  });

  it("N629-2 the list holds Will and people only, Will's line counts what needs you; without the ring as it was", async () => {
    const list = () =>
      createElement(ChatList, {
        chats: [],
        coachRow: createElement("div", { "data-coach-row-marker": "" }),
        modelsRows: createElement("div", { "data-models-rows-marker": "" }),
        onOpenWill: () => undefined,
        onOpen: () => undefined,
      });
    // Without the ring: the rows as they are, and no word of what needs you.
    act(() => root.render(list()));
    await flush();
    expect(container.querySelector("[data-coach-row-marker]")).not.toBeNull();
    expect(container.querySelector("[data-models-rows-marker]")).not.toBeNull();
    expect(text()).not.toMatch(/need you|needs you/);

    // With it: Will and people only; Will's line counts the lines that show.
    forgetHostWork();
    bff.routes["GET /api/v2/chats/setup"] = SETUP;
    bff.routes["GET /api/v2/chats/setup/drafts"] = { drafts: DRAFTS };
    bff.routes["GET /api/v2/models/queue"] = { models: [], examples: [{ id: "e1", model_id: "m1" }] };
    act(() => root.unmount());
    root = createRoot(container);
    act(() => root.render(list()));
    await flush();
    expect(container.querySelector("[data-coach-row-marker]")).toBeNull();
    expect(container.querySelector("[data-models-rows-marker]")).toBeNull();
    expect(text()).toContain("2 things need you");

    forgetHostWork();
    bff.routes["GET /api/v2/chats/setup/drafts"] = { drafts: [] };
    bff.routes["GET /api/v2/models/queue"] = { models: [], examples: [] };
    act(() => root.unmount());
    root = createRoot(container);
    act(() => root.render(list()));
    await flush();
    expect(text()).toContain("Nothing needs you now");
  });

  it("N630-1 a model left out today because the host is out of tokens gets its line in Will and counts in the list", async () => {
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
    expect(text().startsWith("This needs you:")).toBe(true);
    const left = [...container.querySelectorAll("[data-left-out]")].map((p) => p.textContent);
    expect(left).toEqual(["I left out Kasia's model today. You're out of tokens."]);
    expect(container.querySelector("[data-left-out] button, button[data-left-out]")).toBeNull();
    act(() => root.unmount());
    root = createRoot(container);
    act(() =>
      root.render(createElement(ChatList, { chats: [], onOpenWill: () => undefined, onOpen: () => undefined })),
    );
    await flush();
    expect(text()).toContain("1 thing needs you");
  });
});
