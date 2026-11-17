import { PRICES, SEND, W } from "./hostSetupCopy";
import type { SendKind } from "@/services/api/hostSetup";
import { checkPlugin } from "@/lib/willab/chatBuilder/plugins";
import type { TalkPlugin, TalkSnap } from "@/lib/willab/chatBuilder/talkDraft";

export const SENDS: SendKind[] = ["rec", "text", "photo", "file"];
export const WALKS = ["best", "fix", "words"] as const;
export const COACH_HELLO = "Hi. Record a short talk, and I'll tell you what worked.";
export const WRITTEN_PASTE = "# id: hedge\n# role: detector\n# interventionType: NOTICE\n# hears: hedging\n# step: walk.message\n";

export type Phase = "brief" | "send" | "walk" | "who" | "pay" | "price" | "machine" | "connect" | "model" | "other" | "otherName" | "code" | "paste" | "plan" | "edit" | "greet" | "look" | "done";
export type Snap = TalkSnap & { label: string };
export type Line = { who: "will" | "me"; text: string; quotes?: string[] };
type Who = TalkSnap["who"];
type Patch = { snap?: Snap; phase?: Phase; i?: number; priceAt?: number; add?: Line[]; label?: string };

export type Turn = {
  text: string;
  phase: Phase;
  yes: boolean;
  no: boolean;
  said: Line[];
  step: string;
  snap: Snap;
  i: number;
  priceAt: number;
  models: { id: string; q: string }[];
  priceBack: { current: "machine" | "plan" };
  write: (next: Patch) => void;
  finish: (next: Snap, add: Line[], label: string) => void;
  onList: () => void;
};

const FREE = new Set<Phase>(["model", "paste", "look", "done", "otherName", "greet", "edit"]);

function planLine(snap: Snap): string {
  const hello = snap.hello || (snap.spec === "Speaking coach" ? COACH_HELLO : "Your chat is ready.");
  return `${snap.spec || "Your chat"}. First line: ${hello}`;
}

function plan(t: Turn, next: Snap, label: string, said: Line[] = t.said) {
  t.write({ snap: next, phase: "plan", add: [...said, { who: "will", text: planLine(next), quotes: ["You decide"] }, { who: "will", text: "Say go?" }], label });
}

function afterSend(t: Turn) {
  const kind = SENDS[t.i];
  let send = t.snap.send.filter((k) => k !== kind);
  if (t.yes) send = [...send, kind];
  if (t.i + 1 >= SENDS.length && !send.length) send = [kind];
  const next = { ...t.snap, send };
  const n = t.i + 1;
  if (n < SENDS.length) {
    t.write({ snap: next, phase: "send", i: n, add: [...t.said, { who: "will", text: W.sendOne(SEND[SENDS[n]][0]) }], label: `Send ${t.step}` });
    return;
  }
  const ask = next.send.includes("rec")
    ? { phase: "walk" as const, text: W.walkOne(W.walkSteps.best) }
    : { phase: "who" as const, text: "Do you check each answer before it goes?" };
  t.write({ snap: next, phase: ask.phase, i: 0, add: [...t.said, { who: "will", text: ask.text }], label: `Steps ${t.step}` });
}

function afterWalk(t: Turn) {
  const id = WALKS[t.i];
  let walk = t.snap.walk.filter((k) => k !== id);
  if (t.yes) walk = [...walk, id];
  if (t.i + 1 >= WALKS.length && !walk.length) walk = [id];
  const next = { ...t.snap, walk };
  if (t.i + 1 < WALKS.length) {
    const n = t.i + 1;
    t.write({ snap: next, phase: "walk", i: n, add: [...t.said, { who: "will", text: W.walkOne(W.walkSteps[WALKS[n]]) }], label: `Walk ${t.step}` });
    return;
  }
  t.write({ snap: next, phase: "who", i: 0, add: [...t.said, { who: "will", text: "Do you check each answer before it goes?" }], label: `Steps ${t.step}` });
}

function afterWho(t: Turn) {
  if (t.i === 0 && !t.yes) {
    t.write({ phase: "who", i: 1, add: [...t.said, { who: "will", text: "Do you write every answer yourself?" }], label: `Who ${t.step}` });
    return;
  }
  const who: Who = t.i === 0 ? "shadow" : t.yes ? "you" : "assistant";
  t.write({ snap: { ...t.snap, who }, phase: "pay", add: [...t.said, { who: "will", text: "Do people pay to use it?" }], label: `Coach ${t.step}` });
}

function afterPay(t: Turn) {
  if (!t.yes) {
    t.write({ snap: { ...t.snap, pay: false, price: 0 }, phase: "machine", add: [...t.said, { who: "will", text: "Train it on your own answers?" }], label: `Pay ${t.step}` });
    return;
  }
  t.write({ snap: { ...t.snap, pay: true }, phase: "price", priceAt: 0, add: [...t.said, { who: "will", text: `Charge ${PRICES[0]}?` }], label: `Pay ${t.step}` });
}

function afterPrice(t: Turn) {
  if (t.priceBack.current === "plan") {
    const next = { ...t.snap, pay: t.yes, price: t.yes ? PRICES[0] : 0 };
    t.priceBack.current = "machine";
    plan(t, next, `Edit ${t.step}`);
    return;
  }
  if (t.yes || t.priceAt + 1 >= PRICES.length) {
    const price = t.yes ? PRICES[t.priceAt] : 0;
    t.write({ snap: { ...t.snap, price }, phase: "machine", add: [...t.said, { who: "will", text: "Train it on your own answers?" }], label: `Price ${t.step}` });
    return;
  }
  const n = t.priceAt + 1;
  t.write({ phase: "price", priceAt: n, add: [...t.said, { who: "will", text: `Charge ${PRICES[n]}?` }], label: `Price ${t.step}` });
}

function afterMachine(t: Turn) {
  t.write({ snap: { ...t.snap, machine: t.yes }, phase: "connect", add: [...t.said, { who: "will", text: "Use a model that already exists?" }], label: `Train ${t.step}` });
}

function afterConnect(t: Turn) {
  if (!t.yes) {
    t.write({ snap: { ...t.snap, connect: false, model: "", otherModels: [] }, phase: "code", add: [...t.said, { who: "will", text: "Will you add your own code later?" }], label: `Model ${t.step}` });
    return;
  }
  t.write({
    snap: { ...t.snap, connect: true }, phase: "model",
    add: [...t.said, { who: "will", text: t.models.length ? "Which one?" : "What should it notice?", quotes: t.models.map((m) => m.q) }],
    label: `Model ${t.step}`,
  });
}

function afterModel(t: Turn) {
  const picked = t.models.length ? (/^the first one$/i.test(t.text.trim()) ? t.models[0] : t.models.find((m) => m.q === t.text.trim()) ?? t.models[0]) : null;
  const model = picked?.id ?? t.text.trim();
  t.write({
    snap: { ...t.snap, model }, phase: "other",
    add: [{ who: "me", text: picked?.q ?? model }, { who: "will", text: "Add another model?" }],
    label: `Model ${t.step}`,
  });
}

function afterOther(t: Turn) {
  if (!t.yes) {
    t.write({ snap: { ...t.snap, otherModels: [] }, phase: "code", add: [...t.said, { who: "will", text: "Will you add your own code later?" }], label: `Model ${t.step}` });
    return;
  }
  t.write({ phase: "otherName", add: [...t.said, { who: "will", text: "What should the other one notice?" }], label: `Model ${t.step}` });
}

function afterOtherName(t: Turn) {
  const name = t.text.trim();
  if (!name) {
    t.write({ add: [{ who: "will", text: "Name it." }] });
    return;
  }
  t.write({ snap: { ...t.snap, otherModels: [name] }, phase: "code", add: [{ who: "me", text: name }, { who: "will", text: "Will you add your own code later?" }], label: `Model ${t.step}` });
}

function afterCode(t: Turn) {
  if (!t.yes) {
    plan(t, { ...t.snap, code: false, paste: "", plugin: null }, `Plan ${t.step}`);
    return;
  }
  t.write({ snap: { ...t.snap, code: true }, phase: "paste", add: [...t.said, { who: "will", text: "Paste the step, then send it.", quotes: ["Write this for me"] }], label: `Code ${t.step}` });
}

async function afterPaste(t: Turn) {
  const source = /^write this for me$/i.test(t.text.trim()) ? WRITTEN_PASTE : t.text;
  const checked = await checkPlugin(source);
  if (checked.status !== "checked" || !checked.manifest) {
    t.write({ add: [{ who: "will", text: "That step is missing its name. Paste another.", quotes: ["Write this for me"] }] });
    return;
  }
  const plugin: TalkPlugin = { id: checked.manifest.id, hash: checked.hash, interventionType: checked.manifest.interventionType as TalkPlugin["interventionType"] };
  plan(t, { ...t.snap, code: true, paste: source, plugin }, `Plan ${t.step}`, [{ who: "me", text: "Pasted." }]);
}

function afterPlan(t: Turn) {
  if (t.yes) {
    t.finish(t.snap, [...t.said, { who: "will", text: "This is the chat.", quotes: ["Open the list", "Try it out loud"] }], `Look ${t.step}`);
    return;
  }
  t.write({ phase: "edit", add: [...t.said, { who: "will", text: "What should change?", quotes: ["The greeting", "The price"] }], label: `Plan ${t.step}` });
}

function afterEdit(t: Turn) {
  const lower = t.text.trim().toLowerCase();
  if (/greeting|first line/.test(lower)) {
    t.write({ phase: "greet", add: [{ who: "me", text: t.text.trim() }, { who: "will", text: "What is the first line?", quotes: ["Write this for me"] }], label: `Edit ${t.step}` });
    return;
  }
  if (/price|pay/.test(lower)) {
    t.priceBack.current = "plan";
    t.write({ phase: "price", priceAt: 0, add: [{ who: "me", text: t.text.trim() }, { who: "will", text: `Charge ${PRICES[0]}?` }], label: `Edit ${t.step}` });
    return;
  }
  t.write({ add: [{ who: "will", text: "Say the greeting or the price.", quotes: ["The greeting", "The price"] }] });
}

function afterGreet(t: Turn) {
  const hello = /^write this for me$/i.test(t.text.trim()) ? (t.snap.spec === "Speaking coach" ? COACH_HELLO : "Your chat is ready.") : t.text.trim();
  plan(t, { ...t.snap, hello }, `Edit ${t.step}`, [{ who: "me", text: hello }]);
}

function afterLook(t: Turn) {
  if (/list|open/i.test(t.text)) {
    t.onList();
    return;
  }
  t.write({ phase: "done", add: [{ who: "me", text: t.text.trim() }, { who: "will", text: "This is the chat.", quotes: ["Open the list", "Try it out loud"] }], label: `Done ${t.step}` });
}

const PHASES: Record<string, (t: Turn) => void | Promise<void>> = {
  send: afterSend,
  walk: afterWalk,
  who: afterWho,
  pay: afterPay,
  price: afterPrice,
  machine: afterMachine,
  connect: afterConnect,
  model: afterModel,
  other: afterOther,
  otherName: afterOtherName,
  code: afterCode,
  paste: afterPaste,
  plan: afterPlan,
  edit: afterEdit,
  greet: afterGreet,
  look: afterLook,
};

export async function speakTurn(t: Turn): Promise<void> {
  const trimmed = t.text.trim();
  const yes = /^(yes|the first one|1)$/i.test(trimmed) || (t.phase === "plan" && /^(go|you decide)$/i.test(trimmed));
  const no = /^no$/i.test(trimmed);
  if (!FREE.has(t.phase)) {
    if (!yes && !no) {
      t.write({ add: [{ who: "will", text: "Yes or no." }] });
      return;
    }
    t.said.push({ who: "me", text: yes ? "Yes" : "No" });
  }
  const run = PHASES[t.phase];
  if (run) await run({ ...t, yes, no });
}
