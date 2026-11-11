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
  type WalkStepId,
  type WalkRead,
  readWalk,
  readTry,
  startTry,
  endTry,
  type TryRead,
  type TryDirection,
  setWalkItem,
  wantWalk,
} from "@/services/api/hostSetup";
import { OUT, PRICES, SEND, W, WHO } from "./hostSetupCopy";
import { Box, Btn, Cap, Card, Chips, Dots, Frame, FrameHistory, FrameNote, Link, Mine, Opt, Say, Two } from "./SetupBits";
import { SetupHistory, answerOf, willLines, type Said } from "./setupLog";
import HostOwnChat from "./HostOwnChat";
import HostTeach from "./HostTeach";
import HostCheck from "./HostCheck";
import { AnswersScreen, BLOCK, BaseScreen, BlocksScreen, GivesScreen, OwnWhyScreen, answersOf, withFirst } from "./ModelBlockScreens";
import { answerSets } from "@/services/api/modelSetup";

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
  | "what" | "care" | "line" | "name" | "send" | "out" | "walk" | "walkorder" | "walkout" | "walkwant" | "walkhome" | "walknotice" | "walksay" | "walkrun" | "hello" | "q" | "qmore" | "taps" | "smart" | "way" | "ownwhy"
  | "gives" | "base" | "model" | "stack" | "teach" | "check" | "more" | "order" | "who" | "share" | "price" | "cost" | "try" | "live" | "done";
const ORDER: Step[] = ["what", "care", "line", "name", "send", "out", "walk", "walkorder", "walkout", "walkwant", "hello", "q", "qmore", "taps", "smart", "way", "ownwhy", "gives", "base", "model", "stack", "teach", "check", "more", "order", "who", "share", "price", "cost", "try", "live", "done"];
/** The steps an edit goes through before the parts again (the prototype's
 *  `next`); "Your models" goes the whole way of a model, from "smart" to its
 *  check, as in the first run (N632 item 5). */
const THROUGH: Step[] = ["walk", "walkorder", "walkout", "q", "qmore", "smart", "way", "ownwhy", "gives", "base", "model", "stack", "teach", "check", "try", "live"];
/** A part's row opens its step. */
const PART_STEP: Record<string, Step> = { name: "name", line: "line", send: "send", out: "out", hello: "hello", questions: "q", taps: "taps", who: "who", walk: "walk" };

/** The parts with Will's line over them; null: the line of where the chat is. */
type Parts = { line: string | null; parts: SetupPart[] };

type State = {
  at: Step;
  history: Step[];
  recipe: HostRecipe | null;
  cost: ChatCost | null;
  /** Will's chat while words are asked for: his question, then one's own. */
  thread: { w: boolean; t: string }[];
  typing: { ask: string; ph: string; done: (v: string) => boolean; initial?: string; lines?: boolean } | null;
  thinking: string | null;
  i: Record<string, number>;
  own: Record<string, string | null>;
  qs: string[];
  sendSet: SendKind[] | null;
  mi: number;
  ownQ: string | null;
  /** The answers the typed question suggests (N646), and which is shown;
   *  `ownOpts` once the host typed their own. */
  ownSets: string[][] | null;
  setI: number;
  ownOpts: string[] | null;
  /** A suggested model's own line, kept while its own answers are kept. */
  ownSays: string | null;
  ownSeen: boolean;
  /** What the host's own models are built on, once chosen (N634 item 1). */
  base: string | null;
  /** What they give back, once chosen (N636 item 6). */
  gives: string | null;
  /** A block of the stack was tapped: its choice comes back to the stack. */
  toStack: boolean;
  /** The model as kept, shown in blocks until "Teach it" saves its card. */
  draft: RecipeModel | null;
  /** Where on the card the draft was saved: Back to the stack shows it, and
   *  "Teach it" again saves no second one. */
  savedAt: number | null;
  /** The feedback walk's steps in order, once ticked (N641); null: as kept. */
  walk: WalkStepId[] | null;
  /** The ticks on "What should yours hold?" while it is open. */
  walkTicks: WalkStepId[] | null;
  /** The host asked for the walk ("I want this"): never asked again. */
  wanted: boolean;
  /** The walk part by part, as read (N647); the item open on its screen. */
  walkRead: WalkRead | null;
  walkItem: string | null;
  /** "See it run": the host answered "Did this help?" (N647 item 1). */
  runHelped: boolean;
  /** The silent try on filler words; null: the route does not answer (N647 item 3). */
  filler: TryRead | null;
  shared: SharedModel[] | null;
  picked: SharedModel | null;
  edit: boolean;
  parts: SetupPart[];
  partsLine: string | null;
  testing: boolean;
  busy: boolean;
  /** The backend refused the host's own words on this screen (N622 item 3). */
  refused: boolean;
  /** A part could not be kept: Will says so under the screen (N649 item 1). */
  failed: boolean;
  ownChat: OwnChat | null;
  /** Opened at one part from Build's "Your chat": kept or Back, Build again
   *  (backend N642 item 3). */
  onePart: boolean;
  /** The last move was Back: a step with nothing to show passes on backwards. */
  backward: boolean;
  /** The steps answered, one per step in `history` (null: moved on with no
   *  answer to show), drawn above the one on show (N647 item 9). */
  log: (Said | null)[];
  /** What the last tap answered, kept once the step moves on. */
  pending: Said | null;
  /** Will's lines on the screen of the last tap (typing keeps them). */
  lastWill: string[];
  /** "What do you do?" answered before this visit, rebuilt from the recipe. */
  seed: Said[];
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
  ownQ: null,
  ownSets: null,
  setI: 0,
  ownOpts: null,
  ownSays: null,
  ownSeen: false,
  base: recipe?.models?.find((m) => m.own && m.base)?.base ?? null,
  gives: recipe?.models?.find((m) => m.own && m.gives)?.gives ?? null,
  toStack: false,
  draft: null,
  savedAt: null,
  walk: null,
  walkTicks: null,
  wanted: !!recipe?.walk?.wanted,
  walkRead: null,
  walkItem: null,
  runHelped: false,
  filler: null,
  shared: null,
  picked: null,
  edit: !!parts && !!recipe,
  parts: parts?.parts ?? [],
  partsLine: parts?.line ?? null,
  testing: false,
  busy: false,
  refused: false,
  failed: false,
  ownChat: null,
  onePart: false,
  backward: false,
  log: [],
  pending: null,
  lastWill: [],
  seed: [],
});

/** The step a part's row opens. */
function stepOfPart(part: string, recipe: HostRecipe): Step {
  // A walk already kept opens part by part (N647 item 1).
  if (part === "walk" && recipe.walk) return "walkhome";
  return PART_STEP[part] ?? (part === "models" ? ((recipe.models ?? []).length ? "more" : "smart") : "line");
}

/** Opened at one part (Build's "Your chat"): that step, as an edit, with
 *  nothing before it, so Back and the end of the edit both close. */
function atPart(state: State, part: string | null): State {
  if (!part || !state.recipe || !state.edit) return state;
  return { ...state, at: stepOfPart(part, state.recipe), onePart: true, qs: part === "questions" ? [] : state.qs };
}

const capital = (v: string) => v.charAt(0).toUpperCase() + v.slice(1);
const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

function useSetup(start: () => State) {
  const s = useRef<State | null>(null);
  if (!s.current) s.current = start();
  const [, paint] = useReducer((n: number) => n + 1, 0);
  return { S: s.current, paint };
}

export default function HostSetup({ name, recipe = null, parts = null, cost = null, ownChat = null, guess = null, part = null, onClose }: {
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
  /** Opened at this part from Build's "Your chat" (N642 item 3). */
  part?: string | null;
  onClose: () => void;
}) {
  const { S, paint } = useSetup(() => atPart(seeded({ ...fresh(recipe, parts, cost), ownChat }, name), part));
  const R = S.recipe;
  // Read at the moment of the step, after the last part kept.
  const models = (): RecipeModel[] => S.recipe?.models ?? [];
  const noModels = () => S.recipe?.smart === false;

  /** One's own model's first screens, each shown once. */
  const ownSeen = (id: Step): boolean => (id === "ownwhy" ? S.ownSeen : id === "gives" ? !!S.gives : !!S.base);
  const skip = (id: Step): boolean => {
    const R = S.recipe;
    if (!R) return false;
    switch (id) {
      case "out": return R.suggest.out[0] === "answer" && !S.edit;
      // A backend that suggests no names yet: the first name stays the name.
      case "name": return !R.suggest.name?.length;
      case "qmore": case "teach": case "check": return true;
      case "way": case "model": case "more": return noModels();
      case "ownwhy": case "gives": case "base": return noModels() || R.way !== "own" || ownSeen(id);
      case "stack": return !S.draft;
      case "order": return models().length < 2;
      case "share": return !models().some((m) => m.own);
      case "price": return !R.share;
      case "cost": return !models().length;
      case "done": return !S.edit;
      default: return skipWalk(id, S, R);
    }
  };
  const go = (to: Step) => {
    S.refused = false;
    S.failed = false;
    S.backward = false;
    S.history.push(S.at);
    // The answer to the step left stays above (N647 item 9).
    S.log.length = S.history.length - 1;
    S.log.push(S.pending);
    S.pending = null;
    S.at = to;
    S.walkItem = null;
    S.runHelped = false;
    if ((to === "walkhome" || to === "walkwant") && !S.walkRead) {
      void readWalk().then((read) => {
        S.walkRead = read;
        paint();
      });
    }
    // What a newcomer reads is the line as kept now (N622 item 2).
    if (to === "walknotice") {
      void readTry("filler_cluster").then((read) => {
        S.filler = read;
        paint();
      });
    }
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
    if (S.onePart) return onClose();
    void readSetup().then((read) => {
      if (read) {
        S.parts = read.parts;
        S.ownChat = read.own_chat ?? S.ownChat;
        S.cost = read.cost ?? S.cost;
      }
      S.history = [];
      S.log = [];
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
    S.failed = false;
    S.backward = true;
    const was = S.history.pop();
    if (!was) return onClose();
    // The answer to the step asked again goes (N647 item 9).
    S.log.length = S.history.length;
    S.pending = null;
    if (was === "q" && (S.at === "qmore" || S.at === "taps")) S.qs.pop();
    S.at = was;
    paint();
  };
  /** One part kept, then on; a refusal keeps the screen. */
  const keep = (part: string, value: unknown, then: () => void = next) => {
    if (S.busy) return;
    S.busy = true;
    S.failed = false;
    void keepPart(part, value).then((got) => {
      S.busy = false;
      if (!got || "refused" in got) {
        S.refused = got?.refused === "RECIPE_WORDS";
        // Any other failure says so, never a dead button (N649 item 1).
        S.failed = !S.refused;
        return paint();
      }
      S.recipe = got.recipe;
      S.cost = got.cost ?? S.cost;
      then();
    });
  };
  /** `done` returning false does not take the words: the box keeps them. */
  const typeIn = (ask: string, done: (v: string) => void | boolean, ph: string = W.typeHere, initial?: string, lines = false) => {
    S.thread.push({ w: true, t: ask });
    S.typing = {
      ask,
      ph,
      initial,
      lines,
      done: (v) => {
        if (done(v) === false) return false;
        S.thread.push({ w: false, t: v });
        S.pending = { will: S.lastWill, me: v };
        S.typing = null;
        S.refused = false;
        paint();
        return true;
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
        Object.assign(S, { seed: [], recipe: got, qs: [], edit: false, i: {}, own: {}, sendSet: null, mi: 0, ownQ: null, ownSets: null, setI: 0, ownOpts: null, ownSays: null, ownSeen: false, base: null, gives: null, toStack: false, draft: null, savedAt: null, walk: null, walkTicks: null, wanted: false, picked: null });
        go("care");
      } else paint();
    });
  };

  // A tap on the screen: what it answered, and Will's lines it answered.
  const heard = (e: { target: EventTarget; currentTarget: HTMLElement }) => {
    const button = (e.target as Element).closest?.("button");
    if (!(button instanceof HTMLElement)) return;
    S.lastWill = willLines(e.currentTarget);
    const me = answerOf(e.currentTarget, button);
    if (me !== null) S.pending = { will: S.lastWill, me };
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
  // An edit of one part stands alone; the first run reads as a chat.
  const history = S.edit ? null : <SetupHistory log={[...S.seed, ...S.log]} />;
  return (
    <FrameHistory.Provider value={history}>
      <FrameNote.Provider value={S.failed ? <div role="alert" data-setup-failed="" className="max-w-[86%] self-start rounded-2xl bg-muted px-3.5 py-2.5 text-[16px] leading-snug text-foreground">{W.notSaved}</div> : null}>
      <div className="contents" onClickCapture={heard}>
        <SetupScreen S={S} R={R} name={name} guess={guess} back={back} typeIn={typeIn} begin={begin} ctx={{ S, R: R as HostRecipe, paint, go, next, back, keep, typeIn, name, onClose, done: () => (S.edit ? toParts() : onClose()) }} />
      </div>
      </FrameNote.Provider>
    </FrameHistory.Provider>
  );
}

/** Before this visit, "What do you do?" was answered: its answer stays
 *  above, rebuilt from the recipe (N647 item 9). */
function seeded(S: State, name: string): State {
  if (S.recipe && !S.edit && S.at === "care") S.seed = [{ will: [...W.hi(name), W.whatDoYouDo], me: S.recipe.spec }];
  return S;
}

/** The screen on show: Will working, the typing, "What do you do?", or a step. */
function SetupScreen({ S, R, name, guess, back, typeIn, begin, ctx }: {
  S: State;
  R: HostRecipe | null;
  name: string;
  guess: string | null;
  back: () => void;
  typeIn: (ask: string, done: (v: string) => void, ph?: string, initial?: string) => void;
  begin: (v: string) => void;
  ctx: Ctx;
}) {
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
    // Typing is the app's own bottom bar, its send on the right (N647 item 9).
    return (
      <div className="flex min-h-0 flex-1 flex-col">
        <Frame onBack={back}>
          {S.thread.map((m, k) => (m.w ? <Say key={k}>{m.t}</Say> : <Mine key={k}>{m.t}</Mine>))}
        </Frame>
        <Box key={t.ask} placeholder={t.ph} onSend={t.done} initial={t.initial} lines={t.lines} />
      </div>
    );
  }
  if (!R || S.at === "what") {
    return (
      <Frame onBack={back} foot={<Btn label={W.answer} onClick={() => typeIn(W.whatDoYouDo, begin, W.whatPlaceholder, guess ?? undefined)} />}>
        {W.hi(name).map((line) => <Say key={line}>{line}</Say>)}
        <Say>{W.whatDoYouDo}</Say>
      </Frame>
    );
  }
  // In an edit, a step that ended the first run ends at the parts instead.
  return <StepScreen {...ctx} />;
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
  typeIn: (ask: string, done: (v: string) => void | boolean, ph?: string, initial?: string, lines?: boolean) => void;
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

/** The chat's own words, each Keep or Change with "Type my own": why
 *  people come, the chat's name (backend N642 item 1, N643 item 1) and the
 *  hello. */
function WordSteps(c: Ctx): ReactNode {
  const { R } = c;
  switch (c.S.at) {
    case "line":
      return kc(c, "line", W.lineSay, R.suggest.line, R.line, (v) => <><Card b={v} /><div className="mt-2"><Cap>{W.lineCap}</Cap></div></>, (v) => c.keep("line", v), W.lineAsk, (v) => v);
    case "name": {
      const names = R.suggest.name ?? [];
      return kc(c, "name", W.nameSay, names, R.name ?? names[0], (v) => <Card b={v} />, (v) => c.keep("name", v), W.nameAsk, (v) => v);
    }
    case "hello":
      return kc(c, "hello", W.helloSay, R.suggest.hello, R.hello, (v) => <Card><Say>{v}</Say></Card>, (v) => c.keep("hello", v), W.helloAsk, (v) => v);
    default:
      return null;
  }
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
      return made?.model_id ? <HostTeach key={made.model_id} modelId={made.model_id} onDone={S.backward ? c.back : () => c.go("check")} /> : null;
    }
    default:
      return null;
  }
}

/** One's own model, made in blocks, one choice per screen (N636 item 6). */
function OwnModelStep(c: Ctx): ReactNode {
  const { S } = c;
  const models = c.R.models ?? [];
  switch (S.at) {
    case "ownwhy":
      return (
        <OwnWhyScreen
          onBack={c.back}
          onNo={() => (models.length ? c.go("more") : c.keep("smart", false, S.edit ? c.done : () => c.go("who")))}
          onYes={() => { S.ownSeen = true; c.next(); }}
        />
      );
    case "gives":
      return <GivesScreen onBack={c.back} on={S.gives} onPick={(id) => { S.gives = id; chosen(c); }} />;
    case "base":
      return <BaseScreen onBack={c.back} on={S.base} onPick={(id) => { S.base = id; chosen(c); }} />;
    case "model":
      return <ModelStep c={c} />;
    case "stack":
      return <StackStep c={c} />;
    default:
      return null;
  }
}

/** The walk's three steps, in the order they are first suggested (N641). */
const WALK_IDS: WalkStepId[] = ["best", "fix", "words"];
/** The walk's steps in order: as ticked now, else as kept, else as Will
 *  suggests, else all three. */
const walkSteps = (S: State, R: HostRecipe): WalkStepId[] => S.walk ?? R.walk?.steps ?? R.suggest.walk?.steps ?? WALK_IDS;
const walkOut = (R: HostRecipe) => R.walk?.out ?? R.suggest.walk?.out ?? "ideal_text";

/** The feedback walk's steps, only in a chat that takes a recording (N641);
 *  its order only when it holds more than one step. Any other step: no. */
function skipWalk(id: Step, S: State, R: HostRecipe): boolean {
  if (!id.startsWith("walk")) return false;
  if (!R.send.includes("rec")) return true;
  return id === "walkorder" && walkSteps(S, R).length < 2;
}

/** The feedback walk a host's chat holds (N641): what it holds, its order,
 *  what comes at the end, then the walk in blocks; the chat cannot run it
 *  yet, and "I want this" tells the founder once. */
function WalkStep(c: Ctx): ReactNode {
  const { S, R } = c;
  switch (S.at) {
    case "walk": {
      const ticks = S.walkTicks ?? walkSteps(S, R);
      S.walkTicks = ticks;
      // Any number of ticks; the last one stays, as on "What do people send you?".
      const tick = (k: WalkStepId) => {
        if (ticks.includes(k) && ticks.length === 1) return;
        S.walkTicks = ticks.includes(k) ? ticks.filter((y) => y !== k) : [...ticks, k];
        c.paint();
      };
      return (
        <Frame onBack={c.back} foot={<Btn label={W.done} onClick={() => { S.walk = ticks; S.walkTicks = null; c.next(); }} />}>
          {W.walkSay.map((line) => <Say key={line}>{line}</Say>)}
          {WALK_IDS.map((k) => <Opt key={k} title={W.walkSteps[k]} tick={ticks.includes(k)} onClick={() => tick(k)} />)}
        </Frame>
      );
    }
    case "walkorder": {
      const steps = walkSteps(S, R);
      return (
        <Frame onBack={c.back} foot={<Two left={<Btn out label={W.change} onClick={() => { S.walk = [...steps.slice(1), steps[0]]; c.paint(); }} />} right={<Btn label={W.keep} onClick={c.next} />} />}>
          <Say>{W.walkOrderSay}</Say>
          {steps.map((k, n) => <Card key={k} b={`${n + 1}. ${W.walkSteps[k]}`} />)}
        </Frame>
      );
    }
    case "walkout":
      return (
        <Frame onBack={c.back}>
          <Say>{W.walkOutSay}</Say>
          {(["ideal_text", "none"] as const).map((k) => (
            <Opt key={k} title={W.walkOuts[k]} on={R.walk?.out === k} onClick={() => c.keep("walk", { steps: walkSteps(S, R), out: k })} />
          ))}
        </Frame>
      );
    case "walkwant": {
      const wanted = S.wanted || !!R.walk?.wanted;
      const want = () => {
        if (S.busy) return;
        S.busy = true;
        void wantWalk().then((told) => {
          S.busy = false;
          if (told) S.wanted = true;
          c.paint();
        });
      };
      return (
        <Frame
          onBack={c.back}
          foot={wanted ? <Btn label={W.done} onClick={c.next} /> : <Two left={<Btn out label={W.notNow} onClick={c.next} />} right={<Btn label={W.iWantThis} onClick={want} />} />}
        >
          <Say>{W.walkYours}</Say>
          <div data-walk-blocks="" className="flex flex-col gap-[3px]">
            {walkSteps(S, R).map((k) => <div key={k} className={BLOCK}>{W.walkSteps[k]}</div>)}
            <div className={BLOCK}>{W.walkOuts[walkOut(R)]}</div>
          </div>
          <Say>{wanted ? W.walkTold : S.walkRead?.runs_on_messages ? W.walkOnMessages : W.walkNotYet}</Say>
        </Frame>
      );
    }
    default:
      return null;
  }
}

/** The walk, part by part (N647 items 1, 2, 6, 7): its home, what it
 *  notices, what it says. Each change is sent as it is made; a refused one
 *  keeps the screen. Counts are the host's only. */
function WalkParts(c: Ctx): ReactNode {
  const { S } = c;
  switch (S.at) {
    case "walkhome": {
      const notices = (S.walkRead?.notice ?? []).filter((n) => n.on).map((n) => n.q);
      const lines = (S.walkRead?.say ?? []).filter((l) => l.on).length;
      return (
        <Frame onBack={c.back}>
          <Say>{W.walkHome}</Say>
          <PartRow part="steps" title={W.walkParts.steps} onClick={() => c.go("walk")}>
            {value(walkSteps(S, c.R).map((id) => W.walkSteps[id]).join(" · "))}
          </PartRow>
          <PartRow part="notice" title={W.walkParts.notice} onClick={() => c.go("walknotice")}>
            {S.walkRead ? value(notices.length ? notices.join(" · ") : W.nothingYet) : null}
          </PartRow>
          <PartRow part="say" title={W.walkParts.say} onClick={() => c.go("walksay")}>
            {S.walkRead ? value(W.lineCount(lines)) : null}
          </PartRow>
          <PartRow part="out" title={W.walkParts.out} onClick={() => c.go("walkout")}>
            {value(W.walkOuts[walkOut(c.R)])}
          </PartRow>
          <Opt title={W.seeItRun} onClick={() => c.go("walkrun")} />
        </Frame>
      );
    }
    case "walknotice":
      return <WalkNoticeStep c={c} />;
    case "walksay":
      return <WalkSayStep c={c} />;
    case "walkrun": {
      // The walk on a sample message, as their people meet it; nothing is kept.
      const lines = (S.walkRead?.say ?? []).filter((l) => l.on).slice(0, walkSteps(S, c.R).length);
      return (
        <Frame onBack={c.back}>
          <Card b={W.sampleTake} />
          {lines.map((l) => <Say key={l.model_id}>{l.says}</Say>)}
          <Say>{S.runHelped ? W.thanks : W.didThisHelp}</Say>
          {S.runHelped ? null : (
            <>
              <Opt title={W.yes} onClick={() => { S.runHelped = true; c.paint(); }} />
              <Opt title={W.no} onClick={() => { S.runHelped = true; c.paint(); }} />
            </>
          )}
        </Frame>
      );
    }
    default:
      return null;
  }
}

/** One change to an item of the walk: the walk read again, or the screen kept. */
function changeItem(c: Ctx, modelId: string, change: { on: boolean } | { says: string }, then: () => void) {
  const { S } = c;
  if (S.busy) return;
  S.busy = true;
  void setWalkItem(modelId, change).then((read) => {
    S.busy = false;
    if (!read) return c.paint();
    S.walkRead = read;
    then();
    c.paint();
  });
}

/** One thing the walk notices, with Catch more / Catch fewer and the silent
 *  try's result (N647 item 3, the prototype's walkParts). */
function FillerStep({ c, back }: { c: Ctx; back: () => void }) {
  const { S } = c;
  const read = S.filler;
  const t = read?.try ?? null;
  const run = (job: Promise<TryRead | null | boolean>, then: (r: unknown) => void) => {
    if (S.busy) return;
    S.busy = true;
    void job.then((r) => { S.busy = false; then(r); c.paint(); });
  };
  const start = (d: TryDirection) => run(startTry("filler_cluster", d), (r) => { if (r) S.filler = r as TryRead; });
  const end = (how: "drop" | "use") => t && run(endTry("filler_cluster", t.id, how), (ok) => { if (ok) { S.filler = read && { ...read, try: null }; back(); } });
  if (!read) return null;
  if (!t) {
    return (
      <Frame onBack={back}>
        <Say>{W.fillerTitle + "."}</Say>
        <Opt title={W.catchMore} onClick={() => start("more")} />
        <Opt title={W.catchFewer} onClick={() => start("fewer")} />
      </Frame>
    );
  }
  const d = t.direction;
  if (t.state !== "ready") {
    return (
      <Frame onBack={back} foot={<Btn label={W.tryDone} onClick={back} />}>
        <Say>{W.tryTold(d, t.needed)}</Say>
        <Say>{W.tryThen}</Say>
      </Frame>
    );
  }
  return (
    <Frame
      onBack={back}
      foot={read.can_use
        ? <Two left={<Btn out label={W.goBack} onClick={() => end("drop")} />} right={<Btn label={W.useIt} onClick={() => end("use")} />} />
        : <Btn label={W.goBack} onClick={() => end("drop")} />}
    >
      <Say>{W.tried(d, t.needed)}</Say>
      <Say>{d === "more" ? W.caughtMore(t.changed, t.agreed) : W.caughtFewer(t.changed, t.agreed)}</Say>
      {t.note ? <Say>{t.note}</Say> : null}
    </Frame>
  );
}

function WalkNoticeStep({ c }: { c: Ctx }) {
  const { S } = c;
  const notice = S.walkRead?.notice ?? [];
  if (S.walkItem === "filler_cluster" && S.filler) {
    return <FillerStep c={c} back={() => { S.walkItem = null; c.paint(); }} />;
  }
  const open = notice.find((n) => n.model_id === S.walkItem);
  const close = () => { S.walkItem = null; c.paint(); };
  if (open) {
    return (
      <Frame
        onBack={close}
        foot={<Two left={<Btn out label={W.keepIt} onClick={close} />} right={<Btn label={open.on ? W.turnOff : W.turnOn} onClick={() => changeItem(c, open.model_id, { on: !open.on }, close)} />} />}
      >
        <Say>{open.q}</Say>
      </Frame>
    );
  }
  const want = () => {
    if (S.busy || S.wanted) return;
    S.busy = true;
    void wantWalk().then((told) => {
      S.busy = false;
      if (told) S.wanted = true;
      c.paint();
    });
  };
  return (
    <Frame onBack={c.back}>
      <Say>{W.noticeSay}</Say>
      {notice.map((n) => (
        <Opt key={n.model_id} title={n.q} sub={!n.on ? W.off : n.ready ? W.readyNow : W.stillLearning} onClick={() => { S.walkItem = n.model_id; c.paint(); }} />
      ))}
      {S.filler ? (
        <Opt
          title={W.fillerTitle}
          sub={S.filler.try ? W.trying(S.filler.try.direction) : undefined}
          onClick={() => {
            S.walkItem = "filler_cluster";
            c.paint();
            void readTry("filler_cluster").then((read) => { if (read) S.filler = read; c.paint(); });
          }}
        />
      ) : null}
      <Opt title={S.wanted || c.R.walk?.wanted ? W.walkTold : W.somethingElseWant} onClick={want} />
    </Frame>
  );
}

function WalkSayStep({ c }: { c: Ctx }) {
  const { S } = c;
  const say = S.walkRead?.say ?? [];
  const open = say.find((x) => x.model_id === S.walkItem);
  const close = () => { S.walkItem = null; c.paint(); };
  if (open) {
    const words = () => c.typeIn(W.whatShouldISay, (v) => {
      changeItem(c, open.model_id, { says: v }, () => { S.typing = null; S.thread.pop(); });
      // Kept in the box until the words are taken.
      return false;
    }, W.writeHere);
    return (
      <Frame
        onBack={close}
        foot={open.on ? (
          <>
            <Two left={<Btn out label={W.keepIt} onClick={close} />} right={<Btn label={W.changeWords} onClick={words} />} />
            <Btn out label={W.turnOff} onClick={() => changeItem(c, open.model_id, { on: false }, () => undefined)} />
          </>
        ) : <Btn label={W.turnOn} onClick={() => changeItem(c, open.model_id, { on: true }, () => undefined)} />}
      >
        <Say>{W.whenINotice(open.q)}</Say>
        <Card b={open.says} />
        <Say>{!open.on ? W.off : open.helped ? W.helped(open.helped.a, open.helped.b) : W.itsNew}</Say>
      </Frame>
    );
  }
  return (
    <Frame onBack={c.back}>
      <Say>{W.saySay}</Say>
      {say.map((x) => (
        <Opt key={x.model_id} title={x.says} sub={x.on ? undefined : W.off} onClick={() => { S.walkItem = x.model_id; c.paint(); }} />
      ))}
    </Frame>
  );
}

function StepScreen(c: Ctx) {
  const { S, R } = c;
  const models = R.models ?? [];
  const yesNo = (no: string, yes: string, onNo: () => void, onYes: () => void, yesOff = false) => (
    <Two left={<Btn out label={no} onClick={onNo} />} right={<Btn label={yes} onClick={onYes} disabled={yesOff} />} />
  );
  const asked = WordSteps(c) ?? YesNoStep(c) ?? TeachSteps(c) ?? OwnModelStep(c) ?? WalkStep(c) ?? WalkParts(c);
  if (asked) return asked;
  switch (c.S.at) {
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
    case "more":
      return (
        <Frame onBack={c.back} foot={yesNo(W.no, W.yes, c.next, () => { S.mi += 1; S.ownQ = null; S.draft = null; S.savedAt = null; c.go("way"); }, models.length >= 3)}>
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

/** A model the host made has a model_id once the backend made it (with the
 *  ring ai_models): its teaching opens; without one, on to "Add another". */
const onFrom = (c: Ctx, made: RecipeModel | undefined) => c.go(made?.own && made.model_id ? "teach" : "more");

/** One more model on the card, someone's or one's own. */
function addModel(c: Ctx, m: RecipeModel) {
  const { S } = c;
  c.keep("models", [...(c.R.models ?? []), m], () => {
    S.picked = null;
    S.ownQ = null;
    onFrom(c, (S.recipe?.models ?? []).at(-1));
  });
}

/** "Teach it": the blocks saved on the card as one more model, or in place
 *  of the one saved before when Back led here; unchanged, nothing is sent. */
function teachIt(c: Ctx, m: RecipeModel) {
  const { S } = c;
  const models = c.R.models ?? [];
  const at = S.savedAt;
  if (at !== null && models[at]) {
    const was = models[at];
    // A card read before the backend kept `gives` reads without it.
    if (was.q === m.q && same(was.opts, m.opts) && was.base === m.base && (was.gives ?? m.gives) === m.gives) return onFrom(c, was);
    // The card saved again always carries its model_id back, even with a
    // changed question: without it the backend makes a second model.
    const list = models.map((x, k) => (k === at ? { ...m, ...(was.model_id ? { model_id: was.model_id } : {}) } : x));
    return c.keep("models", list, () => onFrom(c, (S.recipe?.models ?? [])[at]));
  }
  c.keep("models", [...models, m], () => {
    S.savedAt = (S.recipe?.models ?? []).length - 1;
    onFrom(c, (S.recipe?.models ?? []).at(-1));
  });
}

function ModelStep({ c }: { c: Ctx }) {
  const { S, R } = c;
  const models = R.models ?? [];
  const add = (m: RecipeModel) => addModel(c, m);
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
  if (S.ownQ) return <OwnAnswers c={c} q={S.ownQ} />;
  const d: ModelDraft = R.suggest.models[S.mi % Math.max(1, R.suggest.models.length)];
  return (
    <Frame
      onBack={c.back}
      foot={
        <>
          <Two
            left={<Btn out label={W.change} onClick={() => { S.mi += 1; c.paint(); }} />}
            right={<Btn label={W.keep} onClick={() => askedQuestion(c, d.q, d)} />}
          />
          <Link label={W.typeOwn} onClick={() => c.typeIn(W.modelAsk, (v) => askedQuestion(c, /\?$/.test(v) ? v : `${v}?`), W.modelPlaceholder)} />
        </>
      }
    >
      <Say>{models.length ? W.nextModel : W.firstModel}</Say>
      <Card b={d.q} />
      <Chips items={d.opts} />
    </Frame>
  );
}

const keepDraft = (c: Ctx, d: ModelDraft) => {
  c.S.draft = { ...d, own: true, base: c.S.base ?? "gpt", gives: c.S.gives ?? "pick" };
  c.next();
};

/** A question, typed or Will's: then the answers it suggests (N646); a
 *  suggested model's own answers come first, and show at once. */
function askedQuestion(c: Ctx, q: string, suggested: ModelDraft | null = null) {
  const { S } = c;
  Object.assign(S, { ownQ: q, ownSets: suggested ? [suggested.opts] : null, setI: 0, ownOpts: null, ownSays: suggested?.says ?? null });
  void answerSets(q).then((sets) => {
    if (S.ownQ !== q) return;
    S.ownSets = withFirst(suggested?.opts ?? null, sets);
    c.paint();
  });
}

/** "People answer with:" for the typed question (N646): the suggested
 *  sets, or the host's own; Back is the question again. */
function OwnAnswers({ c, q }: { c: Ctx; q: string }) {
  const { S } = c;
  const back = () => {
    Object.assign(S, { ownQ: null, ownSets: null, setI: 0, ownOpts: null, ownSays: null });
    c.paint();
  };
  if (!S.ownSets && !S.ownOpts) {
    return (
      <Frame onBack={back}>
        <Dots />
      </Frame>
    );
  }
  const sets = S.ownSets ?? [];
  const opts = S.ownOpts ?? sets[S.setI % Math.max(1, sets.length)] ?? [];
  return (
    <AnswersScreen
      onBack={back}
      answers={opts}
      onKeep={() => keepDraft(c, { q, opts, says: S.ownSays && opts === S.ownSets?.[0] ? S.ownSays : `${q} ${opts[0]}.` })}
      onChange={() => {
        S.ownOpts = null;
        S.setI += 1;
        c.paint();
      }}
      onType={() => c.typeIn(W.answersAsk, (v) => {
        const own = answersOf(v);
        if (!own.length) return false;
        S.ownOpts = own;
      }, W.writeHere, undefined, true)}
    />
  );
}

/** A choice of the model's made: on, or back to the stack it was opened from. */
function chosen(c: Ctx) {
  if (!c.S.toStack) return c.next();
  c.S.toStack = false;
  c.go("stack");
}

/** The model in blocks (N636 item 6): the question, what it gives back, what
 *  it is built on, who teaches it. A block opens its one choice and comes
 *  back; "Teach it" saves the card and goes on to its teaching. */
function StackStep({ c }: { c: Ctx }) {
  const { S } = c;
  const d = S.draft;
  if (!d) return null;
  return (
    <BlocksScreen
      onBack={c.back}
      q={d.q}
      gives={S.gives}
      onOpen={(to) => {
        S.toStack = to !== "model";
        // The question block opens the question, then its answers again.
        if (to === "model") Object.assign(S, { ownQ: null, ownSets: null, setI: 0, ownOpts: null, ownSays: null });
        c.go(to);
      }}
      onTeach={() => teachIt(c, { ...d, base: S.base ?? "gpt", gives: S.gives ?? "pick" })}
    />
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
            <span className="text-[16px] text-foreground">{W.aMonth}</span>
          </div>
          <div className="flex gap-3">
            <label className="flex flex-1 flex-col gap-1 text-[16px] text-foreground">
              {W.people}
              <input type="number" inputMode="numeric" min={1} max={100000} defaultValue={R.cost?.people ?? 10} onChange={typed("people", 100000)} className="rounded-xl border border-border px-3 py-2 text-[16px] text-foreground" />
            </label>
            <label className="flex flex-1 flex-col gap-1 text-[16px] text-foreground">
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
              <span className="text-[16px] text-foreground">{learns(l.q) ? W.stillLearning : l.price ? W.ownersModel(l.by) : W.yourModel}</span>
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
            {m.learning ? <span data-still-learning="" className="ml-1.5 text-[16px] font-normal text-foreground">{W.stillLearning}</span> : null}
          </span>
        ))}
      </span>
    );
  }
  return part.value ? <span className="text-[16px] font-semibold text-foreground">{part.value}</span> : null;
}

/** One row of a list of parts: its name over its value (the parts, the walk's parts). */
function PartRow({ part, title, onClick, children }: { part: string; title: string; onClick: () => void; children: ReactNode }) {
  return (
    <button type="button" data-part={part} onClick={onClick} className="flex flex-col gap-0.5 rounded-2xl border-[1.5px] border-border px-3.5 py-3 text-left">
      <span className="text-[16px] text-foreground">{title}</span>
      {children}
    </button>
  );
}

const value = (v: string) => <span className="text-[16px] font-semibold text-foreground">{v}</span>;

function PartsStep({ c }: { c: Ctx }) {
  const { S, R } = c;
  const open = (part: string) => {
    if (part === "questions") S.qs = [];
    c.go(stepOfPart(part, R));
  };
  return (
    <Frame onBack={c.onClose} foot={<Btn label={W.backToChats} onClick={c.onClose} />}>
      <Say>{S.partsLine ?? (R.live ? W.isOpen : W.isSaved)}</Say>
      {R.live && S.ownChat?.link ? <Card b={`${W.site}${S.ownChat.link.path}`} s={W.linkOpens} /> : null}
      {S.parts.map((p) => (
        <PartRow key={p.part} part={p.part} title={p.title} onClick={() => open(p.part)}>
          <PartValue part={p} models={R.models ?? []} />
        </PartRow>
      ))}
      {/* Quiet, under the parts, never beside "Back to my chats" (N632 item 4). */}
      <Link label={W.startAgain} onClick={() => c.go("what")} />
    </Frame>
  );
}
