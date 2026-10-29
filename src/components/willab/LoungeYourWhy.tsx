"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";
import { dayLabel, LIFE_GOALS_COPY as LG } from "@/lib/willab/lifeGoals";
import {
  answerYourWhyAsk,
  changeYourWhy,
  draftYourWhy,
  getYourWhy,
  saveYourWhy,
  WHY_LINES,
  yourWhyToday,
  type WhyLine,
  type YourWhyState,
} from "@/services/api/yourWhy";
import { Closed, DockColumn, EditorDock, LensFrame, script, WordsDock, type Item, type Script, type Ui } from "./LoungeLifeGoals";
import WalkStage from "./walk/WalkStage";
import { WalkLink, WalkPill } from "./walk/WalkFooter";

/* -------------------------------------------------------------------------- */
/*  Your why, every day (backend N255, signed N258; rules                      */
/*  docs/flows/principles.md §1 Q; prototype                                   */
/*  https://claude.ai/artifact/1hfLf8mCif8pgC1X1Z6caJ, scenes 9 to 11).        */
/*                                                                            */
/*  The life goals lens's frame and docks, the bar "‹ Your why ›": three open */
/*  questions said with the small mic or typed, each with Skip; Will's draft   */
/*  of each line only from the words, quoting them; Accept or Edit (Q2). The  */
/*  daily why is the backend's row in the Lounge; its › changes the line, as  */
/*  a goal's step (Q6). The Goals screen shows the three lines (Q5).          */
/* -------------------------------------------------------------------------- */

export const WHY_COPY = {
  bar: "Your why",
  question: { why: "Why do you do this?", vision: "What do you see when it works?", treat: "How do you want to treat people?" },
  mark: { why: "🔥", vision: "🔭", treat: "🤝" },
  label: { why: "WHY", vision: "VISION", treat: "HOW YOU TREAT PEOPLE" },
  keepLine: "Keep this line",
  set: "Noted. Your why is set.",
  everyDay: "It will be here each day, the first time you open the app.",
  setOn: (date: string) => `Set on ${date}`,
} as const;

export type WhyOpen = { mode: "sit" } | { mode: "change"; line: WhyLine };

/** The three lines in one bubble, as the ladder card draws a goal. */
export function WhyCard({ lines }: { lines: YourWhyState["lines"] }) {
  return (
    <span className="flex flex-col gap-1">
      <b>{WHY_COPY.bar}</b>
      {WHY_LINES.filter((line) => lines[line]).map((line) => (
        <span key={line} className="block">
          <span className="block text-[13.5px] font-semibold tracking-[0.02em] text-muted-foreground">
            {WHY_COPY.mark[line]} {WHY_COPY.label[line]}
          </span>
          {lines[line]}
        </span>
      ))}
    </span>
  );
}

function Draft({ line, text, quote }: { line: WhyLine; text: string; quote: string }) {
  return (
    <>
      <b>
        {WHY_COPY.mark[line]} {text}
      </b>
      <span className="mt-1 block text-[13.5px] leading-[1.4] text-muted-foreground">
        {LG.from} “{quote}”
      </span>
    </>
  );
}

async function acceptOrEdit(s: Script, text: string): Promise<string> {
  for (;;) {
    const choice = await s.ask<"accept" | "edit">((done) => (
      <DockColumn>
        <WalkPill action={{ label: LG.accept, onClick: () => done("accept") }} />
        <WalkPill outline action={{ label: LG.edit, onClick: () => done("edit") }} />
      </DockColumn>
    ));
    if (choice === "accept") {
      await s.me(LG.accept);
      return text;
    }
    const edited = await s.ask<string | null>((done) => (
      <EditorDock value={text} label={WHY_COPY.keepLine} onKeep={done} onBack={() => done(null)} />
    ));
    if (edited) {
      await s.me(edited);
      return edited;
    }
  }
}

/** The sitting (Q2): three questions, Will's drafts, the three lines kept. */
async function sit(s: Script, reload: () => Promise<unknown>): Promise<void> {
  const answers: Partial<Record<WhyLine, string | null>> = {};
  for (const line of WHY_LINES) {
    await s.say(WHY_COPY.question[line]);
    const said = await s.ask<string | null>((done) => <WordsDock onAnswer={done} />);
    await s.me(said ?? LG.skip);
    answers[line] = said;
  }
  if (!WHY_LINES.some((line) => answers[line])) {
    await s.say(LG.nothing);
    return;
  }
  const drafts = await draftYourWhy(answers);
  const kept: Partial<Record<WhyLine, string>> = {};
  for (const line of WHY_LINES) {
    const draft = drafts?.[line];
    if (!draft) continue;
    await s.say(LG.draftLead, <Draft key={line} line={line} text={draft.line} quote={draft.quote} />);
    kept[line] = await acceptOrEdit(s, draft.line);
  }
  if (!Object.keys(kept).length || !(await saveYourWhy(kept))) return;
  const lines = { why: kept.why ?? null, vision: kept.vision ?? null, treat: kept.treat ?? null };
  await s.say(<WhyCard key="set" lines={lines} />, WHY_COPY.set, WHY_COPY.everyDay);
  await reload();
}

/** A line changes as a goal's step (Q6): as it is now, their words, dated. */
async function changeLine(s: Script, state: YourWhyState, line: WhyLine, reload: () => Promise<unknown>): Promise<void> {
  const now = state.lines[line] ?? "";
  await s.say(
    <>
      {LG.now} <b>{now}</b>
    </>,
    LG.shouldSay,
  );
  const text = await s.ask<string | null>((done) => (
    <EditorDock value={now} label={LG.keepChange} onKeep={done} onBack={() => done(null)} />
  ));
  if (!text) return;
  await s.me(text);
  const after = await changeYourWhy(line, text);
  if (!after) return;
  await s.say(LG.changedOn(dayLabel(new Date().toISOString().slice(0, 10))), <WhyCard key="after" lines={after.lines} />);
  await reload();
}

function YourWhyLens({
  open,
  state,
  onClose,
  reload,
}: {
  open: (WhyOpen & { nonce: number }) | null;
  state: YourWhyState | null;
  onClose: () => void;
  reload: () => Promise<unknown>;
}) {
  const [items, setItems] = useState<Item[]>([]);
  const [typing, setTyping] = useState(false);
  const [dock, setDock] = useState<ReactNode>(null);
  const run = useRef(0);
  const seq = useRef(0);
  const fast = useRef(false);
  const nonce = open?.nonce;

  useEffect(() => {
    if (!open || !state?.enabled) return;
    const id = ++run.current;
    setItems([]);
    setTyping(false);
    setDock(null);
    const ui: Ui = {
      add: (who, node) => run.current === id && setItems((now) => [...now, { id: ++seq.current, who, node }]),
      typing: (on) => run.current === id && setTyping(on),
      dock: (node) => run.current === id && setDock(node),
      alive: () => run.current === id,
      fast,
    };
    const s = script(ui);
    const close = <DockColumn><WalkPill action={{ label: LG.close, onClick: onClose }} /></DockColumn>;
    const flow = open.mode === "change" ? changeLine(s, state, open.line, reload) : sit(s, reload);
    void flow
      .then(() => ui.dock(close))
      .catch((error: unknown) => {
        if (!(error instanceof Closed)) ui.dock(close);
      });
    return () => {
      run.current += 1;
    };
    // One run per opening (its nonce); the state it starts from is the one it had then.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nonce]);

  return (
    <div data-feedback-walk>
      <WalkStage
        screen={{ key: "your-why", overlay: Boolean(open) }}
        render={(_screen, ghost) => (
          <LensFrame label={WHY_COPY.bar} items={items} typing={!ghost && typing} dock={ghost ? null : dock} onClose={onClose} />
        )}
      />
    </div>
  );
}

/** Your why for the Lounge (and the Goals screen, with ``lounge: false``):
 *  whether it is on, the ask's answer, the first open of the day, the lens. */
export function useYourWhy({
  signedIn,
  reload,
  lounge = true,
}: {
  signedIn: boolean;
  reload: () => Promise<unknown>;
  lounge?: boolean;
}) {
  const [state, setState] = useState<YourWhyState | null>(null);
  const [open, setOpen] = useState<(WhyOpen & { nonce: number }) | null>(null);
  const refresh = useCallback(async () => {
    setState(await getYourWhy());
  }, []);
  useEffect(() => {
    if (signedIn) void refresh();
  }, [signedIn, refresh]);

  // The Lounge opened: the ask, or the day's why (Q3, Q4).
  useEffect(() => {
    if (!signedIn || !lounge) return;
    void yourWhyToday().then((wrote) => (wrote ? reload() : undefined));
    // Once per opening of the Lounge.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signedIn]);

  const openLens = useCallback(
    (spec: WhyOpen) => {
      void refresh().then(() => setOpen({ ...spec, nonce: Date.now() }));
    },
    [refresh],
  );

  async function answerAsk(choice: "start" | "not_now"): Promise<void> {
    if (!(await answerYourWhyAsk(choice))) return;
    await reload();
    if (choice === "start") openLens({ mode: "sit" });
  }

  return {
    enabled: state?.enabled === true,
    state,
    openLens,
    answerAsk: (choice: "start" | "not_now") => void answerAsk(choice),
    lens: (
      <YourWhyLens
        open={open}
        state={state}
        onClose={() => {
          setOpen(null);
          void refresh();
        }}
        reload={async () => {
          await refresh();
          await reload();
        }}
      />
    ),
  };
}

export type YourWhy = ReturnType<typeof useYourWhy>;

/** The line a daily why row shows (``your_why_line``), for its ›. */
export function yourWhyLineOf(metadata: Record<string, unknown> | null | undefined): WhyLine | null {
  const line = metadata?.your_why_line;
  return line === "why" || line === "vision" || line === "treat" ? line : null;
}

/** A chat reply that asked for the lens (``your_why_open``, Q3). */
export function yourWhyOpenOf(metadata: Record<string, unknown> | null | undefined): boolean {
  return metadata?.your_why_open === true;
}

/** The daily why in the Lounge: a › that opens the line to change it (Q4, Q6). */
export function YourWhyBubble({ body, onOpen }: { body: string; onOpen: () => void }) {
  return (
    <div className="mr-auto flex max-w-[88%] items-end gap-1.5">
      <button
        type="button"
        onClick={onOpen}
        data-your-why
        className="relative rounded-[16px] bg-muted px-3 py-2 pr-8 text-left text-[15px] leading-[1.45] text-foreground"
      >
        {body}
        <span aria-hidden className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[19px] text-muted-foreground">
          ›
        </span>
      </button>
    </div>
  );
}

/** The Life Panel's Goals screen: the three lines above Life goals, each a
 *  row with › that opens the lens over the panel on that line (Q5). Nothing
 *  before they are set. */
export function YourWhyLines() {
  const why = useYourWhy({ signedIn: true, reload: async () => undefined, lounge: false });
  const lines = why.state?.lines;
  if (!why.enabled || !lines || !WHY_LINES.some((line) => lines[line])) return null;
  return (
    <section className="mb-8" aria-label={WHY_COPY.bar}>
      <h2 className="mb-3 text-lg font-semibold tracking-tight text-foreground">{WHY_COPY.bar}</h2>
      <ul className="divide-y divide-border rounded-2xl border border-border">
        {WHY_LINES.filter((line) => lines[line]).map((line) => {
          const change = why.state?.changes[line];
          return (
            <li key={line}>
              <button
                type="button"
                onClick={() => why.openLens({ mode: "change", line })}
                className={cn("relative block w-full px-4 py-3.5 pr-10 text-left hover:bg-muted/50")}
              >
                <span className="block text-xs font-semibold tracking-[0.02em] text-muted-foreground">
                  {WHY_COPY.mark[line]} {WHY_COPY.label[line]}
                  {change ? ` · ${LG.changed(dayLabel(change.on))}` : ""}
                </span>
                <span className="mt-0.5 block text-[15px] text-foreground">{lines[line]}</span>
                {change?.earlier ? (
                  <span className="mt-0.5 block text-xs text-muted-foreground">
                    {LG.earlier} {change.earlier}
                  </span>
                ) : null}
                <span aria-hidden className="absolute right-4 top-1/2 -translate-y-1/2 text-[20px] text-muted-foreground">
                  ›
                </span>
              </button>
            </li>
          );
        })}
      </ul>
      {why.state?.set_on ? <p className="mt-2 text-xs text-muted-foreground">{WHY_COPY.setOn(dayLabel(why.state.set_on))}</p> : null}
      {why.lens}
    </section>
  );
}
