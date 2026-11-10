"use client";

import { useEffect, useReducer, useRef, type ReactNode } from "react";
import {
  keepPart,
  readSetup,
  sharedModels,
  startSetup,
  type ChatCost,
  type HostRecipe,
  type OwnChat,
  type ModelDraft,
  type RecipeModel,
  type SendKind,
  type SetupPart,
  type SharedModel,
} from "@/services/api/hostSetup";
import { OPTS, OUT, PRICES, SEND, W, WHO } from "./hostSetupCopy";
import { Box, Btn, Cap, Card, Chips, Dots, Frame, Link, Mine, Opt, Say, Two } from "./SetupBits";
import HostOwnChat from "./HostOwnChat";
import HostTeach from "./HostTeach";
import HostCheck from "./HostCheck";

/* -------------------------------------------------------------------------- */
/*  The blank setup (backend N612, N616 to N618; the locked prototype         */
/*  docs/design/the-blank-setup-2026-11-10/the-blank-setup.html, its STEPS).  */
/*  One decision per screen, Keep or Change; what needs typing happens in     */
/*  Will's chat and comes back to the same screen; Back works on every        */
/*  screen and keeps the earlier answer. Each Keep is one PUT of one part     */
/*  (the recipe v2 contract, backend #1893); "Change" cycles through Will's   */
/*  suggestions with no call. Over the list of chats, as wide as Will's chat. */
/*                                                                            */
/*  Not drawn yet: "Teach it" and "Check its guesses" for a model of one's    */
/*  own (the recipe keeps no answers and has no model to teach before the     */
/*  backend creates one); the yes-or-no on health, law or money (no screen).  */
/* -------------------------------------------------------------------------- */

type Step =
  | "what" | "care" | "line" | "send" | "out" | "hello" | "q" | "qmore" | "taps" | "smart" | "way" | "ownwhy"
  | "base" | "model" | "teach" | "check" | "more" | "order" | "who" | "share" | "price" | "cost" | "try" | "live" | "done";
const ORDER: Step[] = ["what", "care", "line", "send", "out", "hello", "q", "qmore", "taps", "smart", "way", "ownwhy", "base", "model", "teach", "check", "more", "order", "who", "share", "price", "cost", "try", "live", "done"];
/** The steps an edit goes through before the parts again (the prototype's
 *  `next`); "Your models" goes the whole way of a model, from "smart" to its
 *  check, as in the first run (N632 item 5). */
const THROUGH: Step[] = ["q", "qmore", "smart", "way", "ownwhy", "base", "model", "teach", "check", "try", "live"];
/** A part's row opens its step. */
const PART_STEP: Record<string, Step> = { line: "line", send: "send", out: "out", hello: "hello", questions: "q", taps: "taps", who: "who" };

/** The parts with Will's line over them; null: the line of where the chat is. */
type Parts = { line: string | null; parts: SetupPart[] };

type State = {
  at: Step;
  history: Step[];
  recipe: HostRecipe | null;
  cost: ChatCost | null;
  /** Will's chat while words are asked for: his question, then one's own. */
  thread: { w: boolean; t: string }[];
  typing: { ask: string; ph: string; done: (v: string) => void; initial?: string } | null;
  thinking: string | null;
  i: Record<string, number>;
  own: Record<string, string | null>;
  qs: string[];
  sendSet: SendKind[] | null;
  mi: number;
  mopts: number;
  ownQ: string | null;
  ownSeen: boolean;
  /** What the host's own models are built on, once chosen (N634 item 1). */
  base: string | null;
  shared: SharedModel[] | null;
  picked: SharedModel | null;
  edit: boolean;
  parts: SetupPart[];
  partsLine: string | null;
  testing: boolean;
  busy: boolean;
  /** The backend refused the host's own words on this screen (N622 item 3). */
  refused: boolean;
  ownChat: OwnChat | null;
  /** The last move was Back: a step with nothing to show passes on backwards. */
  backward: boolean;
};

/** A recipe Will has suggested every step for. Without that (a recipe from
 *  before, or one whose suggestions came back empty) no step may draw an
 *  empty suggestion, so the setup starts at "What do you do?", whose start
 *  fills them all (FIRST-16; the founder's trial, 10 November 2026). */
export function suggested(recipe: HostRecipe | null): recipe is HostRecipe {
  const g = recipe?.suggest;
  const some = (list: unknown) => Array.isArray(list) && list.length > 0;
  return Boolean(
    g && some(g.line) && some(g.send) && some(g.out) && some(g.hello) && some(g.qs) && some(g.models) &&
      some(g.taps) && g.taps.every((t) => some(t)),
  );
}

const fresh = (given: HostRecipe | null, parts: Parts | null, cost: ChatCost | null): State => {
  const recipe = suggested(given) ? given : null;
  return start(recipe, recipe ? parts : null, cost);
};

const start = (recipe: HostRecipe | null, parts: Parts | null, cost: ChatCost | null): State => ({
  at: parts && recipe ? "done" : recipe ? "care" : "what",
  history: [],
  recipe,
  cost,
  thread: [],
  typing: null,
  thinking: null,
  i: {},
  own: {},
  qs: recipe ? recipe.questions.map((q) => q.q) : [],
  sendSet: null,
  mi: 0,
  mopts: 0,
  ownQ: null,
  ownSeen: false,
  base: recipe?.models?.find((m) => m.own && m.base)?.base ?? null,
  shared: null,
  picked: null,
  edit: !!parts && !!recipe,
  parts: parts?.parts ?? [],
  partsLine: parts?.line ?? null,
  testing: false,
  busy: false,
  refused: false,
  ownChat: null,
  backward: false,
});

const capital = (v: string) => v.charAt(0).toUpperCase() + v.slice(1);
const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

function useSetup(start: () => State) {
  const s = useRef<State | null>(null);
  if (!s.current) s.current = start();
  const [, paint] = useReducer((n: number) => n + 1, 0);
  return { S: s.current, paint };
}

export default function HostSetup({ name, recipe = null, parts = null, cost = null, ownChat = null, guess = null, onClose }: {
  /** The host's first name, as Will greets them. */
  name: string;
  recipe?: HostRecipe | null;
  /** Opened from Will's chat with the parts ("I want to edit my chat"). */
  parts?: Parts | null;
  cost?: ChatCost | null;
  /** The share link and the newcomer's line, as last read. */
  ownChat?: OwnChat | null;
  /** What the first Take said the person does (N632 item 2). */
  guess?: string | null;
  onClose: () => void;
}) {
  const { S, paint } = useSetup(() => ({ ...fresh(recipe, parts, cost), ownChat }));
  const R = S.recipe;
  // Read at the moment of the step, after the last part kept.
  const models = (): RecipeModel[] => S.recipe?.models ?? [];
  const noModels = () => S.recipe?.smart === false;

  const skip = (id: Step): boolean => {
    const R = S.recipe;
    if (!R) return false;
    switch (id) {
      case "out": return R.suggest.out[0] === "answer" && !S.edit;
      case "qmore": case "teach": case "check": return true;
      case "way": case "model": case "more": return noModels();
      case "ownwhy": return noModels() || R.way !== "own" || S.ownSeen;
      case "base": return noModels() || R.way !== "own" || !!S.base;
      case "order": return models().length < 2;
      case "share": return !models().some((m) => m.own);
      case "price": return !R.share;
      case "cost": return !models().length;
      case "done": return !S.edit;
      default: return false;
    }
  };
  const go = (to: Step) => {
    S.refused = false;
    S.backward = false;
    S.history.push(S.at);
    S.at = to;
    // What a newcomer reads is the line as kept now (N622 item 2).
    if (to === "live") {
      void readSetup().then((read) => {
        if (read?.own_chat) S.ownChat = read.own_chat;
        paint();
      });
    }
    if (to === "way" && S.shared === null) {
      void sharedModels().then((got) => {
        S.shared = got;
        paint();
      });
    }
    paint();
  };
  const toParts = () => {
    void readSetup().then((read) => {
      if (read) {
        S.parts = read.parts;
        S.ownChat = read.own_chat ?? S.ownChat;
        S.cost = read.cost ?? S.cost;
      }
      S.history = [];
      S.at = "done";
      paint();
    });
  };
  /** An edit is over: the parts again; for a chat not open yet, "Open it
   *  to people?" first, so a "Not yet" is never final (N632 item 5). */
  const editDone = () => (S.recipe && !S.recipe.live && S.at !== "live" ? go("live") : toParts());
  const next = () => {
    if (S.edit) {
      // After the models, sharing them and its price, as in the first run.
      const own = (S.recipe?.models ?? []).some((m) => m.own);
      if (S.at === "more" && own) return go("share");
      if (S.at === "share" && S.recipe?.share) return go("price");
      if (!THROUGH.includes(S.at)) return editDone();
    }
    let k = ORDER.indexOf(S.at) + 1;
    while (k < ORDER.length - 1 && skip(ORDER[k])) k += 1;
    if (ORDER[k] === "done" && !S.edit) return onClose();
    go(ORDER[k]);
  };
  const back = () => {
    if (S.typing) {
      S.typing = null;
      S.thread.pop();
      return paint();
    }
    S.refused = false;
    S.backward = true;
    const was = S.history.pop();
    if (!was) return onClose();
    if (was === "q" && (S.at === "qmore" || S.at === "taps")) S.qs.pop();
    S.at = was;
    paint();
  };
  /** One part kept, then on; a refusal keeps the screen. */
  const keep = (part: string, value: unknown, then: () => void = next) => {
    if (S.busy) return;
    S.busy = true;
    void keepPart(part, value).then((got) => {
      S.busy = false;
      if (!got || "refused" in got) {
        S.refused = got?.refused === "RECIPE_WORDS";
        return paint();
      }
      S.recipe = got.recipe;
      S.cost = got.cost ?? S.cost;
      then();
    });
  };
  const typeIn = (ask: string, done: (v: string) => void, ph: string = W.typeHere, initial?: string) => {
    S.thread.push({ w: true, t: ask });
    S.typing = {
      ask,
      ph,
      initial,
      done: (v) => {
        S.thread.push({ w: false, t: v });
        S.typing = null;
        S.refused = false;
        done(v);
        paint();
      },
    };
    paint();
  };
  const begin = (v: string) => {
    const spec = capital(v);
    S.thinking = spec;
    paint();
    void startSetup(v).then((got) => {
      S.thinking = null;
      if (suggested(got)) {
        // A new start, also "Start again": every step from the first, and
        // the chat is not open until the last (N632 item 4).
        Object.assign(S, { recipe: got, qs: [], edit: false, i: {}, own: {}, sendSet: null, mi: 0, mopts: 0, ownQ: null, ownSeen: false, base: null, picked: null });
        go("care");
      } else paint();
    });
  };

  if (S.testing && R) {
    return (
      <HostOwnChat
        name={name}
        recipe={R}
        onBack={() => {
          S.testing = false;
          if (S.at === "try") go("live");
          else paint();
        }}
      />
    );
  }
  if (S.thinking) {
    return (
      <Frame>
        <Say>{W.oneMoment(S.thinking)}</Say>
        <Dots />
      </Frame>
    );
  }
  if (S.typing) {
    const t = S.typing;
    return (
      <div className="flex min-h-0 flex-1 flex-col">
        <Frame onBack={back}>
          {S.thread.map((m, k) => (m.w ? <Say key={k}>{m.t}</Say> : <Mine key={k}>{m.t}</Mine>))}
        </Frame>
        <Box placeholder={t.ph} onSend={t.done} initial={t.initial} />
      </div>
    );
  }
  if (!R || S.at === "what") {
    return (
      <Frame onBack={back} foot={<Btn label={W.answer} onClick={() => typeIn(W.whatDoYouDo, begin, W.whatPlaceholder, guess ?? undefined)} />}>
        <Say>{W.hi(name)}</Say>
        <Say>{W.whatDoYouDo}</Say>
      </Frame>
    );
  }
  // In an edit, a step that ended the first run ends at the parts instead.
  const done = () => (S.edit ? toParts() : onClose());
  return <StepScreen S={S} R={R} paint={paint} go={go} next={next} back={back} keep={keep} typeIn={typeIn} name={name} onClose={onClose} done={done} />;
}

type Ctx = {
  S: State;
  R: HostRecipe;
  name: string;
  paint: () => void;
  go: (s: Step) => void;
  next: () => void;
  back: () => void;
  keep: (part: string, value: unknown, then?: () => void) => void;
  typeIn: (ask: string, done: (v: string) => void, ph?: string) => void;
  onClose: () => void;
  /** Where a "Not now" that ends the models, or the last step, goes. */
  done: () => void;
};

/** Keep or Change: Will's line, the thing, Change cycles his suggestions,
 *  "Type my own" asks in his chat and comes back here. */
function kc<T>(c: Ctx, id: string, line: string, list: T[], current: T, show: (v: T) => ReactNode, onKeep: (v: T) => void, typeAsk?: string, fromTyped?: (v: string) => T) {
  const { S } = c;
  const start = Math.max(0, list.findIndex((x) => same(x, current)));
  const typed = S.own[id];
  const value: T = typed != null && fromTyped ? fromTyped(typed) : list[((S.i[id] ?? start) % list.length + list.length) % list.length];
  return (
    <Frame
      onBack={c.back}
      foot={
        <>
          <Two
            left={<Btn out label={W.change} onClick={() => { S.own[id] = null; S.refused = false; S.i[id] = (S.i[id] ?? start) + 1; c.paint(); }} />}
            right={<Btn label={W.keep} onClick={() => onKeep(value)} />}
          />
          {typeAsk ? <Link label={W.typeOwn} onClick={() => c.typeIn(typeAsk, (v) => { S.own[id] = v; })} /> : null}
        </>
      }
    >
      <Say>{line}</Say>
      <div data-setup-value="">{show(value)}</div>
      {S.refused ? (
        <p role="alert" data-setup-refused="" className="m-0 text-[14px] font-semibold text-[#C2410C]">
          {W.refusedWords}
        </p>
      ) : null}
    </Frame>
  );
}

/** The screens of one question with two answers. */
function YesNoStep(c: Ctx): ReactNode {
  const { S, R } = c;
  const models = R.models ?? [];
  const yesNo = (no: string, yes: string, onNo: () => void, onYes: () => void) => (
    <Two left={<Btn out label={no} onClick={onNo} />} right={<Btn label={yes} onClick={onYes} />} />
  );
  switch (S.at) {
    case "care":
      return (
        <Frame onBack={c.back} foot={yesNo(W.no, W.yes, () => c.keep("care", false), () => c.keep("care", true))}>
          <Say>{W.careSay}</Say>
          <Cap>{W.careCap}</Cap>
        </Frame>
      );
    case "smart":
      return (
        <Frame onBack={c.back} foot={yesNo(W.notNow, W.yes, () => c.keep("smart", false, S.edit ? c.done : () => c.go("who")), () => c.keep("smart", true))}>
          <Say>{W.notSpecialist}</Say>
          <Say>{W.makeSmart(R.spec)}</Say>
          <Cap>{W.smartCap}</Cap>
        </Frame>
      );
    case "share":
      return (
        <Frame onBack={c.back} foot={yesNo(W.notNow, W.shareThem, () => c.keep("share", false), () => c.keep("share", true))}>
          <Say>{W.shareSay}</Say>
          {models.filter((m) => m.own).map((m) => <Card key={m.q} b={m.q} s={m.opts.join(" · ")} />)}
          <Say>{W.shareTwo}</Say>
          <Card b={W.shareHere[0]} s={W.shareHere[1]} />
          <Card b={W.shareKey[0]} s={W.shareKey[1]} />
          <Cap>{W.shareCap}</Cap>
        </Frame>
      );
    case "try":
      return (
        <Frame onBack={c.back} foot={yesNo(W.notNow, W.testMyChat, c.next, () => { S.testing = true; c.paint(); })}>
          <Say>{W.ready}</Say>
          <Say>{W.wantTest}</Say>
        </Frame>
      );
    case "live":
      return (
        <Frame onBack={c.back} foot={yesNo(W.notYet, W.yes, () => c.keep("live", false, c.done), () => c.keep("live", true, c.done))}>
          <Say>{W.openToPeople}</Say>
          <Cap>{W.anyoneLink}</Cap>
          <Card b={W.chatOf(S.ownChat?.title || c.name)} s={S.ownChat?.join_line || R.line.replace(/^People come to you/, `People come to ${S.ownChat?.title || c.name}`)} />
        </Frame>
      );
    default:
      return null;
  }
}

/** Teach it and Check its guesses, for the model the host just made. */
function TeachSteps(c: Ctx): ReactNode {
  const models = c.R.models ?? [];
  const { S } = c;
  switch (S.at) {
    case "check": {
      // Its guesses, once it has something to check; else on (LEARN-03).
      const made = models.at(-1);
      return made?.model_id ? (
        <HostCheck key={made.model_id} modelId={made.model_id} question={made.q} onBack={c.back} onDone={() => c.go("more")} onNothing={S.backward ? c.back : () => c.go("more")} />
      ) : null;
    }
    case "teach": {
      const made = models.at(-1);
      return made?.model_id ? <HostTeach key={made.model_id} modelId={made.model_id} onDone={() => c.go("check")} /> : null;
    }
    default:
      return null;
  }
}

function StepScreen(c: Ctx) {
  const { S, R } = c;
  const models = R.models ?? [];
  const yesNo = (no: string, yes: string, onNo: () => void, onYes: () => void, yesOff = false) => (
    <Two left={<Btn out label={no} onClick={onNo} />} right={<Btn label={yes} onClick={onYes} disabled={yesOff} />} />
  );
  const asked = YesNoStep(c) ?? TeachSteps(c);
  if (asked) return asked;
  switch (c.S.at) {
    case "line":
      return kc(c, "line", W.lineSay, R.suggest.line, R.line, (v) => <><Card b={v} /><div className="mt-2"><Cap>{W.lineCap}</Cap></div></>, (v) => c.keep("line", v), W.lineAsk, (v) => v);
    case "send": {
      const set = S.sendSet ?? (R.send.length ? R.send : [R.suggest.send[0]]);
      S.sendSet = set;
      // Each row ticks on its own, any number of them; the last tick stays,
      // so the screen never drops to none (FIRST-04).
      const tick = (k: SendKind) => {
        if (set.includes(k) && set.length === 1) return;
        S.sendSet = set.includes(k) ? set.filter((y) => y !== k) : [...set, k];
        c.paint();
      };
      return (
        <Frame onBack={c.back} foot={<Btn label={W.done} disabled={!set.length} onClick={() => c.keep("send", R.suggest.send.filter((k) => set.includes(k)))} />}>
          <Say>{W.sendSay}</Say>
          {R.suggest.send.map((k) => (
            <Opt key={k} title={SEND[k][0]} sub={SEND[k][1]} tick={set.includes(k)} onClick={() => tick(k)} />
          ))}
        </Frame>
      );
    }
    case "out":
      return kc(c, "out", W.outSay, R.suggest.out, R.out, (k) => <Card b={OUT[k][0]} s={OUT[k][1]} />, (v) => c.keep("out", v));
    case "hello":
      return kc(c, "hello", W.helloSay, R.suggest.hello, R.hello, (v) => <Card><Say>{v}</Say></Card>, (v) => c.keep("hello", v), W.helloAsk, (v) => v);
    case "q": {
      const n = S.qs.length;
      const list = R.suggest.qs.slice(n).concat(R.suggest.qs.slice(0, n));
      return kc(c, `q${n}`, W.qSay, list, list[0], (v) => <Card b={v} />, (v) => {
        S.qs.push(v);
        if (S.qs.length >= 3) c.keep("questions", S.qs.map((q) => ({ q })), () => c.go("taps"));
        else c.go("qmore");
      }, W.qAsk, (v) => v);
    }
    case "qmore":
      return (
        <Frame onBack={c.back} foot={yesNo(W.no, W.yes, () => c.keep("questions", S.qs.map((q) => ({ q })), () => c.go("taps")), () => c.go("q"))}>
          <Say>{W.qMore}</Say>
          <Chips items={S.qs} />
        </Frame>
      );
    case "taps":
      return kc(c, "taps", W.tapsSay, R.suggest.taps, R.taps, (v) => <Chips items={[...v, W.somethingElse]} />, (v) => c.keep("taps", v), W.tapsAsk, (v) => [v]);
    case "way": {
      const others = (S.shared ?? []).filter((m) => !models.some((x) => x.q === m.q));
      return (
        <Frame onBack={c.back}>
          <Say>{W.waySay}</Say>
          <Opt title={W.wayUse} sub={others.length ? W.wayUseYes : W.wayUseNone} disabled={!others.length} onClick={() => { S.picked = null; c.keep("way", "use"); }} />
          <Opt title={W.wayOwn} sub={W.wayOwnSub} onClick={() => c.keep("way", "own")} />
        </Frame>
      );
    }
    case "ownwhy":
      return (
        <Frame
          onBack={c.back}
          foot={yesNo(W.notNow, W.trainMyOwn, () => (models.length ? c.go("more") : c.keep("smart", false, S.edit ? c.done : () => c.go("who"))), () => { S.ownSeen = true; c.next(); })}
        >
          <Say>{W.ownSay}</Say>
          {[W.ownWhat, W.ownWorth, W.ownNot].map(([b, s]) => <Card key={b} b={b} s={s} />)}
        </Frame>
      );
    case "base":
      return (
        <Frame onBack={c.back}>
          <Say>{W.baseSay}</Say>
          {W.bases.map(([id, title, sub]) => (
            <Opt key={id} title={title} sub={sub} on={S.base === id} disabled={id !== "gpt"} onClick={() => { S.base = id; c.next(); }} />
          ))}
        </Frame>
      );
    case "model":
      return <ModelStep c={c} />;
    case "more":
      return (
        <Frame onBack={c.back} foot={yesNo(W.no, W.yes, c.next, () => { S.mi += 1; S.ownQ = null; c.go("way"); }, models.length >= 3)}>
          <Say>{W.moreSay}</Say>
          {models.map((m) => <Card key={m.q} b={m.q} s={m.opts.join(" · ")} />)}
        </Frame>
      );
    case "order":
      return (
        <Frame onBack={c.back} foot={<Two left={<Btn out label={W.change} onClick={() => c.keep("models", [...models.slice(1), models[0]], c.paint)} />} right={<Btn label={W.keep} onClick={c.next} />} />}>
          <Say>{W.orderSay}</Say>
          {models.map((m, k) => <Card key={m.q} b={`${k + 1}. ${m.q}`} />)}
        </Frame>
      );
    case "who":
      return (
        <Frame onBack={c.back}>
          <Say>{W.whoSay}</Say>
          {/* "I answer at once" waits for a No to health, law or money: until
              then the backend refuses it (sensitive defaults to true). */}
          {R.care ? <Cap>{W.careWho}</Cap> : null}
          {WHO.filter(([kind]) => !(R.care !== false && kind === "assistant")).map(([kind, title, sub], k) => (
            <Opt key={kind} title={title} sub={sub} on={R.who === kind} badge={k === 0 ? W.suggested : undefined} onClick={() => c.keep("who", kind)} />
          ))}
        </Frame>
      );
    case "price":
      return kc(c, "price", W.priceSay, PRICES, R.price, (v) => <Card b={W.tokens(v)} />, (v) => c.keep("price", v));
    case "cost":
      return <CostStep c={c} />;
    default:
      return <PartsStep c={c} />;
  }
}

function ModelStep({ c }: { c: Ctx }) {
  const { S, R } = c;
  const models = R.models ?? [];
  // A model the host made has a model_id once the backend made it (with the
  // ring ai_models): its teaching opens; without one, on to "Add another".
  const add = (m: RecipeModel) => c.keep("models", [...models, m], () => {
    S.picked = null;
    S.ownQ = null;
    const made = (S.recipe?.models ?? []).at(-1);
    c.go(made?.own && made.model_id ? "teach" : "more");
  });
  if (R.way === "use" && S.picked) {
    const m = S.picked;
    return (
      <Frame
        onBack={c.back}
        foot={<Two left={<Btn out label={W.backPlain} onClick={() => { S.picked = null; c.paint(); }} />} right={<Btn label={W.addIt} onClick={() => add({ q: m.q, opts: m.opts, says: "", own: false, model_id: m.model_id, by: m.by, price: m.learning ? 0 : m.price })} />} />}
      >
        <Say>{m.q}</Say>
        <Card b={m.opts.join(" · ")} s={W.madeIt(m.by)} />
        {/* Still learning: it says nothing yet and costs nothing, so no
            promise of a line and no price (N633 item 1). */}
        {m.learning ? (
          <Cap>{W.stillLearning}</Cap>
        ) : (
          <>
            <Say>{W.smarterToday}</Say>
            <Cap>{W.costsYou(m.price)}</Cap>
          </>
        )}
      </Frame>
    );
  }
  const others = (S.shared ?? []).filter((m) => !models.some((x) => x.q === m.q));
  if (R.way === "use" && others.length) {
    return (
      <Frame onBack={c.back} foot={<Btn out label={W.wayOwn} onClick={() => c.keep("way", "own", c.paint)} />}>
        <Say>{W.usableSay}</Say>
        <Cap>{W.usableCap}</Cap>
        {others.map((m) => (
          <Opt
            key={m.model_id}
            title={m.q}
            sub={`${m.opts.join(" · ")}\n${usable(m)}`}
            badge={m.learning ? W.stillLearning : undefined}
            under={m.learning ? W.learningLine : undefined}
            disabled={!m.fits}
            onClick={() => { S.picked = m; c.paint(); }}
          />
        ))}
      </Frame>
    );
  }
  const base: ModelDraft = R.suggest.models[S.mi % Math.max(1, R.suggest.models.length)];
  const opts = OPTS[S.mopts % OPTS.length];
  const d: ModelDraft = S.ownQ ? { q: S.ownQ, opts, says: `${S.ownQ} ${opts[0]}.` } : base;
  return (
    <Frame
      onBack={c.back}
      foot={
        <>
          <Two
            left={<Btn out label={W.change} onClick={() => { if (S.ownQ) S.mopts += 1; else S.mi += 1; c.paint(); }} />}
            right={<Btn label={W.keep} onClick={() => add({ ...d, own: true, base: S.base ?? "gpt" })} />}
          />
          <Link label={W.typeOwn} onClick={() => c.typeIn(W.modelAsk, (v) => { S.ownQ = /\?$/.test(v) ? v : `${v}?`; }, W.modelPlaceholder)} />
        </>
      }
    >
      <Say>{models.length ? W.nextModel : W.firstModel}</Say>
      <Card b={d.q} s={d.opts.join(" · ")} />
      <Cap>{W.modelCap}</Cap>
    </Frame>
  );
}

/** Under a model one can use: who made it, and its price unless it is
 *  still learning (free, and no price is written for it); or what it needs. */
function usable(m: SharedModel): string {
  if (!m.fits) return W.needs(m.by, m.needs);
  return m.learning ? W.madeIt(m.by) : W.eachUse(m.by, m.price);
}

function CostStep({ c }: { c: Ctx }) {
  const { S, R } = c;
  const learns = (q: string) => (R.models ?? []).some((m) => m.learning && m.q === q);
  const cost = S.cost;
  const per = cost?.per_send ?? 0;
  const typed = (key: "people" | "sends", max: number) => (e: { target: { value: string } }) => {
    const n = Math.max(1, Math.min(max, parseInt(e.target.value, 10) || 1));
    c.keep("cost", { ...R.cost, [key]: n }, c.paint);
  };
  return (
    <Frame onBack={c.back} foot={<Btn label={W.next} onClick={c.next} />}>
      <Say>{per ? W.costSay : W.costNothing}</Say>
      {per ? (
        <>
          <div className="flex items-baseline gap-2">
            <b data-cost-month="" className="text-[34px] font-bold text-foreground">{cost?.month ?? 0}</b>
            <span className="text-[15px] text-muted-foreground">{W.aMonth}</span>
          </div>
          <div className="flex gap-3">
            <label className="flex flex-1 flex-col gap-1 text-[13px] text-muted-foreground">
              {W.people}
              <input type="number" inputMode="numeric" min={1} max={100000} defaultValue={R.cost?.people ?? 10} onChange={typed("people", 100000)} className="rounded-xl border border-border px-3 py-2 text-[16px] text-foreground" />
            </label>
            <label className="flex flex-1 flex-col gap-1 text-[13px] text-muted-foreground">
              {W.eachSends}
              <input type="number" inputMode="numeric" min={1} max={1000} defaultValue={R.cost?.sends ?? 1} onChange={typed("sends", 1000)} className="rounded-xl border border-border px-3 py-2 text-[16px] text-foreground" />
            </label>
          </div>
        </>
      ) : null}
      <Card>
        {(cost?.lines ?? []).map((l) => (
          <div key={l.q} data-cost-line="" className="flex items-start justify-between gap-3 py-1">
            <span className="flex flex-col text-[15px] text-foreground">
              {l.q}
              <small className="text-[13px] text-muted-foreground">{learns(l.q) ? W.stillLearning : l.price ? W.ownersModel(l.by) : W.yourModel}</small>
            </span>
            <b className="text-[15px]">{l.price ? W.tokens(l.price) : W.free}</b>
          </div>
        ))}
        {per ? (
          <div className="flex items-start justify-between gap-3 border-t border-border pt-2">
            <span className="text-[15px] text-foreground">{W.eachTime}</span>
            <b className="text-[15px]">{W.tokens(per)}</b>
          </div>
        ) : null}
      </Card>
      <Cap>{per ? W.costPay : W.costOwn}</Cap>
    </Frame>
  );
}

/** A part's value; "Your models" marks each one still learning (N633 item 1). */
function PartValue({ part, models }: { part: SetupPart; models: RecipeModel[] }) {
  if (part.part === "models" && models.some((m) => m.learning)) {
    return (
      <span className="flex flex-col gap-0.5">
        {models.map((m) => (
          <span key={m.q} className="text-[16px] font-semibold text-foreground">
            {m.q}
            {m.learning ? <small data-still-learning="" className="ml-1.5 text-[13px] font-medium text-muted-foreground">{W.stillLearning}</small> : null}
          </span>
        ))}
      </span>
    );
  }
  return part.value ? <span className="text-[16px] font-semibold text-foreground">{part.value}</span> : null;
}

function PartsStep({ c }: { c: Ctx }) {
  const { S, R } = c;
  const open = (part: string) => {
    if (part === "questions") S.qs = [];
    const to: Step = PART_STEP[part] ?? (part === "models" ? ((R.models ?? []).length ? "more" : "smart") : "line");
    c.go(to);
  };
  return (
    <Frame title={R.spec} onBack={c.onClose} foot={<Btn label={W.backToChats} onClick={c.onClose} />}>
      <Say>{S.partsLine ?? (R.live ? W.isOpen : W.isSaved)}</Say>
      {R.live && S.ownChat?.link ? <Card b={`${W.site}${S.ownChat.link.path}`} s={W.linkOpens} /> : null}
      {S.parts.map((p) => (
        <button key={p.part} type="button" data-part={p.part} onClick={() => open(p.part)} className="flex flex-col gap-0.5 rounded-2xl border-[1.5px] border-border px-3.5 py-3 text-left">
          <small className="text-[13px] font-medium text-muted-foreground">{p.title}</small>
          <PartValue part={p} models={R.models ?? []} />
        </button>
      ))}
      {/* Quiet, under the parts, never beside "Back to my chats" (N632 item 4). */}
      <Link label={W.startAgain} onClick={() => c.go("what")} />
    </Frame>
  );
}
