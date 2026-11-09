// @vitest-environment jsdom
/*
STORY    As a business, I want to read a ready model's card, try it, take a
         free test key that I see only once, put it in my product with the
         code, and follow my month's usage; as a model's founder, I want to
         set its price with − and + and see where the money goes; as a
         teacher, I want to see my earnings; and as its owner, to download
         its data; all in the locked prototype's words, in tokens, never in
         euros (backend N528, N531, N566, N577, N583; App Model MOD-39 to
         MOD-48, MOD-51). Before the backend has the routes, or below the
         ring, no way in shows.
OUTCOME
  O1  Every way in (the list's "Use it", the page's "Try it", "Use it in
      your business", "Set your price", "Your usage", "Download its data",
      "Your earnings") hides while its route answers 404.
  O2  Each story's Then holds with the backend's exact words (the BFF answers
      with what services/model_api.py builds, modelApiFixtures.json), and
      prices read in tokens.
  O3  The key is shown once: after "I copied it" it is on no screen, and
      only a test key is ever asked for (no live charge).
PROVES   O1 -> "before the backend has the routes …"
         O2 -> one test per story, named by its id
         O3 -> "MOD-42 …"
WHY      The App Model's stories are the contract the founder compares the
         code with (backend N574); hiding on 404 keeps the screens safe to
         merge before backend #1866 and its migration.
*/
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import F from "./modelsFixtures.json";
import A from "./modelApiFixtures.json";

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

import ModelsOverlay, { type ModelsScreen } from "./ModelsOverlay";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let container: HTMLDivElement;
let root: Root;
const clipboard = { writeText: vi.fn(async () => undefined) };

const pitchReady = { ...F.pagePitch, status: "ready" };
/** Every route of a model's API and money, as backend #1866 answers them. */
const API: Record<string, Answer> = {
  "GET /api/v2/models": F.list,
  "GET /api/v2/models/job": { ...F.page, id: "job", name: "Job interview coach", status: "ready" },
  "GET /api/v2/models/job/card": A.card,
  "GET /api/v2/models/job/code": A.code,
  "GET /api/v2/models/job/use": A.terms,
  "POST /api/v2/models/job/keys": A.key,
  "GET /api/v2/models/job/usage": A.usage,
  "POST /api/v2/models/job/try": A.tryUnsure,
  "GET /api/v2/models/pitch": pitchReady,
  "GET /api/v2/models/pitch/card": { ...A.card, title: "Pitch Coach" },
  "GET /api/v2/models/pitch/code": A.code,
  "GET /api/v2/models/pitch/use": A.termsOwn,
  "POST /api/v2/models/pitch/keys": A.keyOwn,
  "GET /api/v2/models/pitch/price": (c: Call) => {
    const uses = c.path.includes("uses=20000") ? A.price20k : A.price;
    return c.path.includes("units=310") ? { ...A.price310, uses: uses.uses, uses_line: uses.uses_line } : uses;
  },
  "POST /api/v2/models/pitch/price": A.price310,
  "GET /api/v2/models/pitch/download": (c: Call) => (c.path.includes("rows=1") ? A.downloadRows : A.download),
  "GET /api/v2/models/earnings": A.earnings,
  "POST /api/v2/models/keys/key1/unsure": { on: true },
  "POST /api/v2/models/keys/key1/switch": { version: 2 },
  "DELETE /api/v2/models/keys/key1": { deleted: true },
};

beforeEach(() => {
  bff.calls = [];
  bff.routes = {};
  clipboard.writeText.mockClear();
  Object.defineProperty(navigator, "clipboard", { value: clipboard, configurable: true });
  container = document.createElement("div");
  container.className = "relative";
  document.body.appendChild(container);
  root = createRoot(container);
});
afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

const serve = (routes: Record<string, Answer>) => {
  bff.routes = routes as Record<string, unknown>;
};
const flush = () =>
  act(async () => {
    for (let i = 0; i < 20; i += 1) await new Promise((r) => setTimeout(r, 0));
  });
const text = () => container.textContent ?? "";
const buttons = () => [...container.querySelectorAll("button")];
function button(label: string): HTMLButtonElement {
  const found = buttons().find((b) => b.textContent?.trim() === label || b.getAttribute("aria-label") === label);
  if (!found) throw new Error(`no button "${label}" in: ${text()}`);
  return found as HTMLButtonElement;
}
const hasButton = (label: string) => buttons().some((b) => b.textContent?.trim() === label);
async function tap(label: string) {
  await act(async () => button(label).click());
  await flush();
}
async function open(start: ModelsScreen) {
  await act(async () => root.render(createElement(ModelsOverlay, { start, queueTitle: "Your queue", onClose: () => {} })));
  await flush();
}
const sent = (method: string, suffix: string) => bff.calls.filter((c) => c.method === method && c.path.split("?")[0].endsWith(suffix));
function expectAll(words: string[]) {
  for (const w of words) expect(text()).toContain(w);
}
async function type(value: string) {
  const box = container.querySelector("textarea") as HTMLTextAreaElement;
  const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value")!.set!;
  await act(async () => {
    setter.call(box, value);
    box.dispatchEvent(new Event("input", { bubbles: true }));
  });
}
/** The list, then a ready model's "Use it": its card. */
async function toCard() {
  await open({ at: "list" });
  const card = [...container.querySelectorAll('[data-testid="model-card"]')].find((c) => c.textContent?.includes("Job interview coach"));
  await act(async () => [...card!.querySelectorAll("button")].find((b) => b.textContent === "Use it")!.click());
  await flush();
}

describe("a model's API and money (MOD-39 to MOD-48, MOD-51)", () => {
  it("before the backend has the routes, or below the ring, no way in shows", async () => {
    serve({ "GET /api/v2/models": F.list, "GET /api/v2/models/pitch": pitchReady });
    await open({ at: "list" });
    const job = [...container.querySelectorAll('[data-testid="model-card"]')].find((c) => c.textContent?.includes("Job interview coach"))!;
    expect([...job.querySelectorAll("button")].map((b) => b.textContent)).toEqual(["Teach it"]);
    expect(text()).not.toContain("Your earnings");
    await open({ at: "page", id: "pitch" });
    for (const w of ["Try it", "Use it in your business", "Set your price", "Your usage", "Download its data"]) expect(hasButton(w)).toBe(false);
    expect(hasButton("Teach it")).toBe(true);
  });

  it("MOD-39: a ready model's card: \"Good at\", \"Not so good at\", \"Not for\", \"On its final exam\", \"When it isn’t sure\", \"Version\", with \"Use it in your business\" and \"Try it\"", async () => {
    serve(API);
    await toCard();
    expectAll([
      "Job interview coach passed its final exam.",
      "Good at",
      "Not so good at",
      "Not for",
      "On its final exam",
      "Coaches who didn’t know which answer was whose rated its answers as good as a coach’s about 8 times in 10.",
      "When it isn’t sure",
      "It says so, and a coach answers instead",
      "Version",
      "Try it for free. Use it in your own product, and pay for each answer.",
    ]);
    expect(button("Use it in your business").disabled).toBe(false);
    expect(hasButton("Try it")).toBe(true);
  });

  it("MOD-40: trying it, when it is not sure it says so: \"I’m not sure about this one, so I won’t guess. …\" and \"Not sure · a coach will answer\"", async () => {
    serve(API);
    await toCard();
    await tap("Try it");
    await type("Can you check my contract?");
    await tap("Send");
    expect(sent("POST", "/job/try")[0].json).toEqual({ message: "Can you check my contract?" });
    expectAll([
      "Can you check my contract?",
      "I’m not sure about this one, so I won’t guess. One of the coaches who taught me will answer it here within a day.",
      "Not sure · a coach will answer",
      "ready to use",
    ]);
  });

  it("MOD-41: the terms: the price in tokens, \"Start with a test key\", \"Set a monthly limit\", the users' data line and \"Create a key\"", async () => {
    serve(API);
    await toCard();
    await tap("Use it in your business");
    expectAll([
      "You can put Job interview coach inside your own app or website.",
      "300 tokens an answer",
      "No monthly fee. Stop any time.",
      "Start with a test key",
      "Free for your first 100 answers. It never bills you.",
      "Set a monthly limit",
      "500,000 tokens · a mistake can never cost you more than you chose",
      "Your users’ questions are not used to train it unless you allow it.",
      "Create a key",
      "Not now",
    ]);
    expect(text()).not.toContain("€");
  });

  it("MOD-42: the key is shown once: \"This is your secret key.\", the test key's note, \"Copy\" and \"I copied it\"; then it is gone", async () => {
    serve(API);
    await toCard();
    await tap("Use it in your business");
    await tap("Create a key");
    expect(sent("POST", "/job/keys")[0].json).toEqual({ kind: "test", monthly_limit_units: 500000, allow_training: false });
    expectAll([
      "This is your secret key. It lets your product talk to Job interview coach.",
      "This is a test key: free for 100 answers. You see it only once. Keep it secret, like a password. If it leaks, delete it and make a new one.",
      A.key.key,
    ]);
    await tap("Copy");
    expect(clipboard.writeText).toHaveBeenCalledWith(A.key.key);
    await tap("I copied it");
    expect(text()).not.toContain(A.key.key);
    await act(async () => (container.querySelector('[aria-label="Back"]') as HTMLButtonElement).click());
    await flush();
    expect(text()).toContain("Good at");
    expect(text()).not.toContain(A.key.key);
    expect(bff.calls.every((c) => c.method !== "POST" || !c.path.endsWith("/keys") || (c.json as { kind: string }).kind === "test")).toBe(true);
  });

  it("MOD-43: the code in \"JavaScript\", \"Python\" and \"curl\", with \"sure\" in every answer and \"Send it to your developer\"", async () => {
    serve(API);
    await open({ at: "code", id: "job" } as ModelsScreen);
    expectAll(["Put it in your product", "JavaScript", "Python", "curl", "Each answer comes with “sure”: true or false.", "Done", "Send it to your developer"]);
    for (const lang of ["JavaScript", "Python", "curl"]) {
      await tap(lang);
      expect(container.querySelector("[data-model-code]")!.textContent).toContain(A.code.tabs.find((t) => t.label === lang)!.code);
    }
    expect(container.querySelector("[data-model-code]")!.textContent).not.toContain("wpl_sk_");
  });

  it("MOD-44: usage: the month, the unsure questions back to its teachers, the pinned version and \"Delete this key\"", async () => {
    serve(API);
    await open({ at: "code", id: "job" } as ModelsScreen);
    await tap("Done");
    expectAll([
      "Job interview coach answered 1,240 questions for your users this month.",
      "Send the questions it wasn’t sure about to its teachers",
      "124 this month, with your users’ names removed.",
      "You use version 1. When version 2 passes the same exam, you choose when to switch.",
      "Every answer you pay for also pays the three people who taught it.",
    ]);
    await act(async () => (container.querySelector('input[role="switch"]') as HTMLInputElement).click());
    await flush();
    expect(sent("POST", "/keys/key1/unsure")[0].json).toEqual({ on: true });
    await tap("Delete this key");
    expect(sent("DELETE", "/keys/key1")).toHaveLength(1);
    expect(hasButton("Back to the list")).toBe(true);
  });

  it("MOD-44: a newer version: \"Switch to version 2\" moves the keys when the business chooses", async () => {
    serve({ ...API, "GET /api/v2/models/job/usage": A.usageNewer });
    await open({ at: "usage", id: "job" } as ModelsScreen);
    expectAll(["Version 2 passed the same exam.", "You use version 1. Nothing changes until you switch."]);
    expect(sent("POST", "/switch")).toHaveLength(0);
    await tap("Switch to version 2");
    expect(sent("POST", "/keys/key1/switch")).toHaveLength(1);
  });

  it("MOD-44: a test key that used its 100 free answers says so, and offers no live key (no live charge yet)", async () => {
    serve({ ...API, "GET /api/v2/models/job/usage": A.usageFreeUsed });
    await open({ at: "usage", id: "job" } as ModelsScreen);
    expect(text()).toContain("Your test key used its 100 free answers.");
    expect(hasButton("Make a live key")).toBe(false);
  });

  it("MOD-45: a model not yet for sale is tried in text: \"trying it · not for sale yet\"", async () => {
    serve({ ...API, "GET /api/v2/models/pitch": F.pagePitch, "GET /api/v2/models/pitch/card": undefined, "POST /api/v2/models/pitch/try": A.tryNotForSale });
    await open({ at: "page", id: "pitch" });
    expect(hasButton("Use it in your business")).toBe(false);
    await tap("Try it");
    await type("How do I open my pitch?");
    await tap("Send");
    expectAll(["trying it · not for sale yet", "How do I open my pitch?", "Open with the problem, not your company."]);
    expect(container.querySelector("[data-try-unsure]")).toBeNull();
  });

  it("MOD-46: \"Set your price\" with − and + around \"for one answer\", the suggestions, the uses a month, and the split live with \"Infrastructure\" as one row", async () => {
    serve(API);
    await open({ at: "page", id: "pitch" });
    await tap("Set your price");
    expectAll([
      "Set your price",
      "Pitch Coach passed its final exam. Set the price for one answer; you can change it at any time.",
      "300 tokens",
      "for one answer",
      "200 tokens",
      "500 tokens",
      "Similar models charge 200 tokens to 500 tokens. The lowest is 60 tokens, what an answer costs to run.",
      "If businesses use it 10,000 times a month",
      "3,000,000 tokens a month would go here:",
      "Infrastructure",
      "The AI company, our servers and WillpowerLab",
      "You, who started it",
      "The teachers, by their points",
      "Use 300 tokens",
    ]);
    expect([...container.querySelectorAll("[data-split]")].map((r) => r.getAttribute("data-split"))).toEqual(["infra", "founder", "teachers"]);
    expect(text()).not.toContain("€");
    await tap("−");
    await tap("+");
    expect(bff.calls.some((c) => c.method === "GET" && c.path.endsWith("/pitch/price?uses=10000&units=310"))).toBe(true);
    expectAll(["310 tokens", "Use 310 tokens"]);
    expect(sent("POST", "/pitch/price")).toHaveLength(0);
    const slider = container.querySelector('input[type="range"]') as HTMLInputElement;
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!;
    await act(async () => {
      setter.call(slider, "20000");
      slider.dispatchEvent(new Event("input", { bubbles: true }));
    });
    await act(async () => new Promise((r) => setTimeout(r, 300)));
    await flush();
    expect(bff.calls.some((c) => c.path.endsWith("/pitch/price?uses=20000&units=310"))).toBe(true);
    expect(text()).toContain("If businesses use it 20,000 times a month");
    expect(sent("POST", "/pitch/price")).toHaveLength(0);
    await tap("Use 310 tokens");
    expect(sent("POST", "/pitch/price").map((c) => c.json)).toEqual([{ units: 310 }]);
  });

  it("MOD-46: when the preview fails, the last split stays and nothing is saved", async () => {
    serve(API);
    await open({ at: "price", id: "pitch" } as ModelsScreen);
    const { "GET /api/v2/models/pitch/price": _preview, ...withoutPreview } = API;
    serve(withoutPreview);
    await tap("+");
    expectAll(["300 tokens", "1,080,000 tokens", "Use 300 tokens"]);
    expect(sent("POST", "/pitch/price")).toHaveLength(0);
  });

  it("MOD-46: \"−\" stops at the running cost", async () => {
    serve({ ...API, "GET /api/v2/models/pitch/price": A.priceFloor });
    await open({ at: "price", id: "pitch" } as ModelsScreen);
    expect(text()).toContain("60 tokens");
    expect(button("−").disabled).toBe(true);
    expect(button("+").disabled).toBe(false);
  });

  it("MOD-47: \"Your earnings\": \"Your share of version 1\" as a percentage, \"Your answers that trained it\", \"Next payout\" and the minimum", async () => {
    serve(API);
    await open({ at: "list" });
    await act(async () => (container.querySelector("[data-models-earnings]") as HTMLButtonElement).click());
    await flush();
    expectAll([
      "Pitch Coach version 1 earned you 41,000 tokens this month.",
      "Your share of version 1",
      "23%",
      "Your answers that trained it",
      "214",
      "Next payout",
      "When you have earned 200,000 tokens",
      "We pay once a month when you have earned €20 or more.",
    ]);
  });

  it("MOD-48: a model's own key: \"Use Pitch Coach in your own product.\" and the test key's note", async () => {
    serve(API);
    await open({ at: "page", id: "pitch" });
    await tap("Use it in your business");
    await tap("Use it in your business");
    expect(text()).toContain("Use Pitch Coach in your own product.");
    await tap("Create a key");
    expect(text()).toContain("This is a test key: free for 100 answers.");
  });

  it("MOD-51: \"Download its data\": the teachers' own ratings and answers only, the licence line, \"Download the data\" and \"Not now\"", async () => {
    serve(API);
    const made: Blob[] = [];
    URL.createObjectURL = vi.fn((b: Blob) => {
      made.push(b);
      return "blob:x";
    });
    URL.revokeObjectURL = vi.fn();
    await open({ at: "page", id: "pitch" });
    await tap("Download its data");
    expectAll([
      "You can download what Pitch Coach has learned from, and build your own on it.",
      "You get your teachers’ ratings and answers. What speakers said is left out until the training yes says it may be shared. Recordings stay with WillpowerLab.",
      "To sell a product built on it, you need a licence",
      "Download the data",
      "Not now",
    ]);
    await tap("Download the data");
    expect(bff.calls.some((c) => c.path.endsWith("/pitch/download?rows=1"))).toBe(true);
    const saved = JSON.parse(await made[0].text());
    expect(saved[0]).toMatchObject({ example: 1, teacher: 1 });
    expect(Object.keys(saved[0])).not.toContain("content");
  });

  it("MOD-51: someone outside its team reads why, and cannot download", async () => {
    serve({ ...API, "GET /api/v2/models/pitch/download": A.downloadRefused });
    await open({ at: "download", id: "pitch" } as ModelsScreen);
    expect(text()).toContain("Only its owner and its teachers can download its data.");
    expect(hasButton("Download the data")).toBe(false);
  });
});
