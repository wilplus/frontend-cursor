import { PRICES, W } from "./hostSetupCopy";
import { startersFor, voiceJob } from "./jobQuestions";
import type { SendKind } from "@/services/api/hostSetup";
import { checkPlugin } from "@/lib/willab/chatBuilder/plugins";
import type { TalkPlugin, TalkSnap } from "@/lib/willab/chatBuilder/talkDraft";

export const SENDS: SendKind[] = ["rec", "text", "photo", "file"];
export const WALKS = ["best", "fix", "words"] as const;
export const COACH_HELLO = "Hi. Record a short talk, and I'll tell you what worked.";
export const WRITTEN_PASTE = "# id: hedge\n# role: detector\n# interventionType: NOTICE\n# hears: hedging\n# step: walk.message\n";

export type Phase = "brief" | "send" | "kinds" | "listen" | "listenPick" | "for" | "give" | "starters" | "walk" | "who" | "pay" | "price" | "machine" | "connect" | "model" | "other" | "otherName" | "code" | "codeWay" | "describe" | "codeKeep" | "paste" | "plan" | "edit" | "greet" | "look" | "done";
export type Snap = TalkSnap & { label: string };
export type Line = {
  who: "will" | "me";
  text: string;
  quotes?: string[];
  /** Which question this answer belongs to, so a tap can open it again. */
  q?: string;
  at?: number;
  /** The chat as it was before this answer. A change that makes later answers wrong starts again from here. */
  before?: Snap;
};
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

const FREE = new Set<Phase>(["model", "paste", "look", "done", "otherName", "greet", "edit", "codeWay", "describe", "codeKeep"]);

function planLine(snap: Snap): string {
  const hello = snap.hello || (snap.spec === "Speaking coach" ? COACH_HELLO : "Your chat is ready.");
  return `${snap.spec || "Your chat"}. First line: ${hello}`;
}

function plan(t: Turn, next: Snap, label: string, said: Line[] = t.said) {
  t.write({ snap: next, phase: "plan", add: [...said, { who: "will", text: planLine(next) }, { who: "will", text: "Say go?" }], label });
}

function afterSend(t: Turn) {
  if (t.yes) {
    t.write({
      snap: { ...t.snap, send: ["text"] }, phase: "kinds", i: 0,
      add: [...t.said, { who: "will", text: W.sendKinds }], label: `Send ${t.step}`,
    });
    return;
  }
  const next = { ...t.snap, send: ["text"] as SendKind[] };
  t.write({ snap: next, phase: "who", i: 0, add: [...t.said, { who: "will", text: W.talkCheck }], label: `Steps ${t.step}` });
}

function afterWalk(t: Turn) {
  const id = WALKS[t.i];
  let walk = t.snap.walk.filter((k) => k !== id);
  if (t.yes) walk = [...walk, id];
  if (t.i + 1 >= WALKS.length && !walk.length) walk = [id];
  const next = { ...t.snap, walk };
  if (t.i + 1 < WALKS.length) {
    const n = t.i + 1;
    t.write({ snap: next, phase: "walk", i: n, add: [...t.said, { who: "will", text: W.walkOne(WALKS[n]) }], label: `Walk ${t.step}` });
    return;
  }
  t.write({ snap: next, phase: "who", i: 0, add: [...t.said, { who: "will", text: W.talkCheck }], label: `Steps ${t.step}` });
}

function afterWho(t: Turn) {
  if (t.i === 0 && !t.yes) {
    t.write({ phase: "who", i: 1, add: [...t.said, { who: "will", text: W.talkWrite }], label: `Who ${t.step}` });
    return;
  }
  const who: Who = t.i === 0 ? "shadow" : t.yes ? "you" : "assistant";
  const next = { ...t.snap, who };
  if (voiceJob(next.spec) && next.send.includes("rec")) {
    t.write({ snap: next, phase: "pay", add: [...t.said, { who: "will", text: W.talkPay }], label: `Coach ${t.step}` });
    return;
  }
  const starters = startersFor(next.spec);
  t.write({
    snap: { ...next, starters },
    phase: "starters",
    add: [...t.said, { who: "will", text: `Are these the right first questions?\n${starters.join("\n")}` }],
    label: `Who ${t.step}`,
  });
}

function afterPay(t: Turn) {
  if (!t.yes) {
    t.write({ snap: { ...t.snap, pay: false, price: 0 }, phase: "machine", add: [...t.said, { who: "will", text: W.talkLearn }], label: `Pay ${t.step}` });
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
    t.write({ snap: { ...t.snap, price }, phase: "machine", add: [...t.said, { who: "will", text: W.talkLearn }], label: `Price ${t.step}` });
    return;
  }
  const n = t.priceAt + 1;
  t.write({ phase: "price", priceAt: n, add: [...t.said, { who: "will", text: `Charge ${PRICES[n]}?` }], label: `Price ${t.step}` });
}

function afterMachine(t: Turn) {
  t.write({ snap: { ...t.snap, machine: t.yes }, phase: "connect", add: [...t.said, { who: "will", text: W.talkModel }], label: `Train ${t.step}` });
}

function afterConnect(t: Turn) {
  if (!t.yes) {
    t.write({ snap: { ...t.snap, connect: false, model: "", otherModels: [] }, phase: "code", add: [...t.said, { who: "will", text: W.codeAsk }], label: `Model ${t.step}` });
    return;
  }
  t.write({
    snap: { ...t.snap, connect: true }, phase: "model",
    add: [...t.said, { who: "will", text: t.models.length ? W.talkWhich : W.talkNotice, quotes: t.models.map((m) => m.q) }],
    label: `Model ${t.step}`,
  });
}

function afterModel(t: Turn) {
  const picked = t.models.length ? (/^the first one$/i.test(t.text.trim()) ? t.models[0] : t.models.find((m) => m.q === t.text.trim()) ?? t.models[0]) : null;
  const model = picked?.id ?? t.text.trim();
  t.write({
    snap: { ...t.snap, model }, phase: "other",
    add: [{ who: "me", text: picked?.q ?? model, q: "model", at: t.i }, { who: "will", text: W.talkAnother }],
    label: `Model ${t.step}`,
  });
}

function afterOther(t: Turn) {
  if (!t.yes) {
    t.write({ snap: { ...t.snap, otherModels: [] }, phase: "code", add: [...t.said, { who: "will", text: W.codeAsk }], label: `Model ${t.step}` });
    return;
  }
  t.write({ phase: "otherName", add: [...t.said, { who: "will", text: W.talkNotice }], label: `Model ${t.step}` });
}

function afterOtherName(t: Turn) {
  const name = t.text.trim();
  if (!name) {
    t.write({ add: [{ who: "will", text: W.talkName }] });
    return;
  }
  t.write({ snap: { ...t.snap, otherModels: [name] }, phase: "code", add: [{ who: "me", text: name, q: "otherName", at: t.i }, { who: "will", text: W.codeAsk }], label: `Model ${t.step}` });
}

function afterCode(t: Turn) {
  if (!t.yes) {
    plan(t, { ...t.snap, code: false, paste: "", plugin: null, codeLine: "" }, `Plan ${t.step}`);
    return;
  }
  t.write({ snap: { ...t.snap, code: true }, phase: "codeWay", add: [...t.said, { who: "will", text: W.codeHow }], label: `Code ${t.step}` });
}

function afterCodeWay(t: Turn) {
  const text = t.text.trim().toLowerCase();
  if (text === W.codeTell.toLowerCase()) {
    t.write({ phase: "describe", add: [{ who: "me", text: W.codeTell, q: "codeWay" }, { who: "will", text: W.codeDescribe }], label: `Code ${t.step}` });
    return;
  }
  if (text === W.codeOwn.toLowerCase()) {
    t.write({ phase: "paste", add: [{ who: "me", text: W.codeOwn, q: "codeWay" }, { who: "will", text: W.codePaste }], label: `Code ${t.step}` });
    return;
  }
  t.write({ add: [{ who: "will", text: W.codeHow }] });
}

async function afterDescribe(t: Turn) {
  const words = t.text.trim();
  if (!words) {
    t.write({ add: [{ who: "will", text: W.codeDescribe }] });
    return;
  }
  const checked = await checkPlugin(WRITTEN_PASTE);
  if (checked.status !== "checked" || !checked.manifest) {
    t.write({ add: [{ who: "will", text: W.codeMissing }] });
    return;
  }
  const plugin: TalkPlugin = { id: checked.manifest.id, hash: checked.hash, interventionType: checked.manifest.interventionType as TalkPlugin["interventionType"] };
  t.write({
    snap: { ...t.snap, code: true, paste: WRITTEN_PASTE, plugin, codeLine: W.codeTold },
    phase: "codeKeep",
    add: [{ who: "me", text: words, q: "describe" }, { who: "will", text: W.codeTold }],
    label: `Code ${t.step}`,
  });
}

function afterCodeKeep(t: Turn) {
  if (/^keep$/i.test(t.text.trim())) {
    plan(t, t.snap, `Code ${t.step}`, [{ who: "me", text: W.codeKeep, q: "codeKeep" }]);
    return;
  }
  if (/^change$/i.test(t.text.trim())) {
    t.write({ phase: "describe", add: [{ who: "me", text: W.codeChange, q: "codeKeep" }, { who: "will", text: W.codeDescribe }], label: `Code ${t.step}` });
    return;
  }
  t.write({ add: [{ who: "will", text: W.codeHow }] });
}

async function afterPaste(t: Turn) {
  const source = /^write this for me$/i.test(t.text.trim()) ? WRITTEN_PASTE : t.text;
  const checked = await checkPlugin(source);
  if (checked.status !== "checked" || !checked.manifest) {
    t.write({ add: [{ who: "will", text: W.codeMissing, quotes: ["Write this for me"] }] });
    return;
  }
  const plugin: TalkPlugin = { id: checked.manifest.id, hash: checked.hash, interventionType: checked.manifest.interventionType as TalkPlugin["interventionType"] };
  plan(t, { ...t.snap, code: true, paste: source, plugin, codeLine: W.codePasted }, `Plan ${t.step}`, [{ who: "me", text: "Pasted.", q: "paste" }]);
}

function afterPlan(t: Turn) {
  if (t.yes) {
    t.finish(t.snap, [...t.said, { who: "will", text: W.talkReady, quotes: ["Open the list", "Try it out loud"] }], `Look ${t.step}`);
    return;
  }
  t.write({ phase: "edit", add: [...t.said, { who: "will", text: W.talkChange, quotes: ["The greeting", "The price"] }], label: `Plan ${t.step}` });
}

function afterEdit(t: Turn) {
  const lower = t.text.trim().toLowerCase();
  if (/greeting|first line/.test(lower)) {
    t.write({ phase: "greet", add: [{ who: "me", text: t.text.trim(), q: "edit" }, { who: "will", text: "What is the first line?" }], label: `Edit ${t.step}` });
    return;
  }
  if (/price|pay/.test(lower)) {
    t.priceBack.current = "plan";
    t.write({ phase: "price", priceAt: 0, add: [{ who: "me", text: t.text.trim(), q: "edit" }, { who: "will", text: `Charge ${PRICES[0]}?` }], label: `Edit ${t.step}` });
    return;
  }
  t.write({ add: [{ who: "will", text: W.talkWhichChange, quotes: ["The greeting", "The price"] }] });
}

function afterGreet(t: Turn) {
  const hello = /^write this for me$/i.test(t.text.trim()) ? (t.snap.spec === "Speaking coach" ? COACH_HELLO : "Your chat is ready.") : t.text.trim();
  plan(t, { ...t.snap, hello }, `Edit ${t.step}`, [{ who: "me", text: hello, q: "greet" }]);
}

function afterLook(t: Turn) {
  if (/list|open/i.test(t.text)) {
    t.onList();
    return;
  }
  t.write({ phase: "done", add: [{ who: "me", text: t.text.trim(), q: "look" }, { who: "will", text: W.talkReady }], label: `Done ${t.step}` });
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
  codeWay: afterCodeWay,
  describe: afterDescribe,
  codeKeep: afterCodeKeep,
  paste: afterPaste,
  plan: afterPlan,
  edit: afterEdit,
  greet: afterGreet,
  look: afterLook,
};

const YES = /^(yes|the first one|1)$/i;
type Edited = { snap: Snap; irrelevant: boolean; answer: string };

function sameAnswer(line: Line, yes: boolean): boolean {
  return (/^yes$/i.test(line.text)) === yes;
}

function editJob(line: Line, trimmed: string, snap: Snap, answer: string): Edited | null {
  if (line.q === "brief") {
    const spec = /speaking coach/i.test(trimmed) ? "Speaking coach" : trimmed;
    return { snap: { ...snap, spec }, irrelevant: false, answer: spec };
  }
  if (line.q === "greet") {
    const hello = /^write this for me$/i.test(trimmed) ? (snap.spec === "Speaking coach" ? COACH_HELLO : "Your chat is ready.") : trimmed;
    return { snap: { ...snap, hello }, irrelevant: false, answer: hello };
  }
  if (line.q === "model") return { snap: { ...snap, model: trimmed }, irrelevant: false, answer: trimmed };
  if (line.q === "otherName") return { snap: { ...snap, otherModels: [trimmed] }, irrelevant: false, answer: trimmed };
  return line.q === "send" || line.q === "walk" ? null : { snap, irrelevant: false, answer };
}

function editSend(line: Line, yes: boolean, snap: Snap, answer: string): Edited {
  if (sameAnswer(line, yes)) return { snap, irrelevant: false, answer };
  return { snap, irrelevant: true, answer };
}

function editWalk(line: Line, yes: boolean, snap: Snap, answer: string): Edited {
  const id = WALKS[line.at ?? 0];
  let walk = snap.walk.filter((k) => k !== id);
  if (yes) walk = [...walk, id];
  if (!walk.length) walk = [id];
  return { snap: { ...snap, walk }, irrelevant: false, answer };
}

function editBranch(line: Line, yes: boolean, snap: Snap, answer: string): Edited {
  if ((line.q === "who" && (line.at ?? 0) === 0) || line.q === "pay" || line.q === "connect" || line.q === "code") {
    return { snap, irrelevant: !sameAnswer(line, yes), answer };
  }
  if (line.q === "who") return { snap: { ...snap, who: yes ? "you" : "assistant" }, irrelevant: false, answer };
  if (line.q === "price") return { snap: { ...snap, pay: true, price: yes ? PRICES[line.at ?? 0] : 0 }, irrelevant: false, answer };
  if (line.q === "machine") return { snap: { ...snap, machine: yes }, irrelevant: false, answer };
  return { snap, irrelevant: false, answer };
}

/** A new answer for an old question. `irrelevant` means later answers no longer fit, so the chat asks again from there. */
export function editEffect(line: Line, text: string, snap: Snap): Edited {
  const trimmed = text.trim();
  const yes = YES.test(trimmed);
  const answer = yes ? "Yes" : /^no$/i.test(trimmed) ? "No" : trimmed;
  if (line.q === "send") return editSend(line, yes, snap, answer);
  if (line.q === "walk") return editWalk(line, yes, snap, answer);
  if (line.q === "who" || line.q === "pay" || line.q === "price" || line.q === "machine" || line.q === "connect" || line.q === "code") {
    return editBranch(line, yes, snap, answer);
  }
  return editJob(line, trimmed, snap, answer) ?? { snap, irrelevant: false, answer };
}

export async function speakTurn(t: Turn): Promise<void> {
  const trimmed = t.text.trim();
  const yes = /^(yes|the first one|1)$/i.test(trimmed) || (t.phase === "plan" && /^go$/i.test(trimmed));
  const no = /^no$/i.test(trimmed);
  if (!FREE.has(t.phase)) {
    if (!yes && !no) {
      t.write({ add: [{ who: "will", text: W.talkYesNo }] });
      return;
    }
    t.said.push({ who: "me", text: yes ? "Yes" : "No", q: t.phase, at: t.i });
  }
  const run = PHASES[t.phase];
  if (run) await run({ ...t, yes, no });
}
