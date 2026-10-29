"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { LIFE_GOALS_COPY as LG } from "@/lib/willab/lifeGoals";
import { answerStrengthAsk, decideStrength, getSuggestion, strengthsToday, type Suggestion } from "@/services/api/lifeStrengths";
import { Closed, DockColumn, EditorDock, LensFrame, script, type Item, type Script, type Ui } from "./LoungeLifeGoals";
import WalkStage from "./walk/WalkStage";
import { WalkLink, WalkPill } from "./walk/WalkFooter";

/* -------------------------------------------------------------------------- */
/*  Strengths in the Lounge (Linear WIL-112; backend N241, signed N258; rules  */
/*  docs/flows/principles.md §1 N; prototype                                   */
/*  https://claude.ai/artifact/1hfLf8mCif8pgC1X1Z6caJ, scenes 1 to 5).         */
/*                                                                            */
/*  "We spotted a strength!" and what the notes show, with Not now | Look     */
/*  (the offer ``strengths``). Look opens the lens, the bar "‹ Strengths ›":  */
/*  the notes it came from with their days, "Will suggests a strength:", then */
/*  Accept, Edit or Not now (N2). "That's your 💪 … again." has a › to the     */
/*  Life Panel's Strengths (N3). The day before a talk is the backend's rows. */
/* -------------------------------------------------------------------------- */

export const STRENGTH_COPY = {
  bar: "Strengths",
  fromNotes: "From your notes:",
  suggests: "Will suggests a strength:",
  addStrength: "Add strength",
  added: "Noted. Added to your strengths.",
  noted: "Noted.",
  notNow: "Not now",
  look: "Look",
  mark: "💪",
} as const;

function NoteQuote({ body, on, label }: { body: string; on: string; label: string | null }) {
  return (
    <>
      “{body}”
      <span className="mt-1 block text-[13.5px] leading-[1.4] text-muted-foreground">{label ? `${label} · ${on}` : on}</span>
    </>
  );
}

async function decide(s: Script, strength: Suggestion, reload: () => Promise<unknown>): Promise<void> {
  for (;;) {
    const choice = await s.ask<"accept" | "edit" | "not_now">((done) => (
      <DockColumn>
        <WalkPill action={{ label: LG.accept, onClick: () => done("accept") }} />
        <WalkPill outline action={{ label: LG.edit, onClick: () => done("edit") }} />
        <WalkLink action={{ label: STRENGTH_COPY.notNow, onClick: () => done("not_now") }} />
      </DockColumn>
    ));
    let text: string | undefined;
    if (choice === "edit") {
      const edited = await s.ask<string | null>((done) => (
        <EditorDock value={strength.title} label={STRENGTH_COPY.addStrength} onKeep={done} onBack={() => done(null)} />
      ));
      if (!edited) continue;
      text = edited;
    }
    await s.me(text ?? (choice === "accept" ? LG.accept : STRENGTH_COPY.notNow));
    if (!(await decideStrength(strength.id, choice, text))) return;
    await s.say(choice === "not_now" ? STRENGTH_COPY.noted : STRENGTH_COPY.added);
    await reload();
    return;
  }
}

async function suggest(s: Script, id: string, reload: () => Promise<unknown>): Promise<void> {
  const strength = await getSuggestion(id);
  if (!strength) return;
  await s.say(STRENGTH_COPY.fromNotes);
  for (const note of strength.notes) await s.say(<NoteQuote key={`${note.on}${note.body}`} body={note.body} on={note.on_label} label={note.label} />);
  await s.say(
    STRENGTH_COPY.suggests,
    <b key="title">
      {STRENGTH_COPY.mark} {strength.title}
    </b>,
  );
  if (strength.status === "suggested") await decide(s, strength, reload);
}

function StrengthLens({
  open,
  onClose,
  reload,
}: {
  open: { id: string; nonce: number } | null;
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
    if (!open) return;
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
    const close = <DockColumn><WalkPill action={{ label: LG.close, onClick: onClose }} /></DockColumn>;
    void suggest(script(ui), open.id, reload)
      .then(() => ui.dock(close))
      .catch((error: unknown) => {
        if (!(error instanceof Closed)) ui.dock(close);
      });
    return () => {
      run.current += 1;
    };
    // One run per opening (its nonce).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nonce]);

  return (
    <div data-feedback-walk>
      <WalkStage
        screen={{ key: "strengths", overlay: Boolean(open) }}
        render={(_screen, ghost) => (
          <LensFrame label={STRENGTH_COPY.bar} items={items} typing={!ghost && typing} dock={ghost ? null : dock} onClose={onClose} />
        )}
      />
    </div>
  );
}

/** Strengths for the Lounge: the first open of the day before a talk, the
 *  ask's answer, and the lens. */
export function useStrengths({ signedIn, reload }: { signedIn: boolean; reload: () => Promise<unknown> }) {
  const [open, setOpen] = useState<{ id: string; nonce: number } | null>(null);

  // The Lounge opened: one kept strength the day before a talk (N4).
  useEffect(() => {
    if (!signedIn) return;
    void strengthsToday().then((wrote) => (wrote ? reload() : undefined));
    // Once per opening of the Lounge.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signedIn]);

  const openLens = useCallback((id: string) => setOpen({ id, nonce: Date.now() }), []);

  async function answerAsk(id: string | null, choice: "look" | "not_now"): Promise<void> {
    if (!id) return;
    if (choice === "look") {
      openLens(id);
      return;
    }
    if (await answerStrengthAsk(id, choice)) await reload();
  }

  return {
    openLens,
    answerAsk: (id: string | null, choice: "look" | "not_now") => void answerAsk(id, choice),
    lens: <StrengthLens open={open} onClose={() => setOpen(null)} reload={reload} />,
  };
}

export type StrengthsLounge = ReturnType<typeof useStrengths>;

type Rows = readonly { metadata?: Record<string, unknown> | null }[];

/** The strength the newest Not now | Look is about. */
export function strengthAskOf(messages: Rows): string | null {
  for (let i = messages.length - 1; i >= 0; i -= 1) {
    const meta = messages[i].metadata;
    if (meta?.offer === "strengths" && typeof meta.strength_id === "string") return meta.strength_id;
  }
  return null;
}

/** "We spotted a strength!": the strength it opens (its ›), or null. */
export function strengthHeadOf(metadata: Record<string, unknown> | null | undefined): string | null {
  const id = metadata?.strength_id;
  return metadata?.strength_step === "head" && typeof id === "string" ? id : null;
}

/** "That's your 💪 … again.": the strength it names, or null. */
export function strengthAgainOf(metadata: Record<string, unknown> | null | undefined): string | null {
  const id = metadata?.strength_again;
  return typeof id === "string" ? id : null;
}

const BUBBLE =
  "relative rounded-[16px] bg-muted px-3 py-2 pr-8 text-left text-[15px] leading-[1.45] text-foreground";
const CHEVRON = "absolute right-2.5 top-1/2 -translate-y-1/2 text-[19px] text-muted-foreground";

/** "We spotted a strength!" with a › that opens the lens again. */
export function StrengthHeadBubble({ body, onOpen }: { body: string; onOpen: () => void }) {
  return (
    <div className="mr-auto flex max-w-[88%] items-end gap-1.5">
      <button type="button" onClick={onOpen} data-strength-head className={BUBBLE}>
        {body}
        <span aria-hidden className={CHEVRON}>
          ›
        </span>
      </button>
    </div>
  );
}

/** "That's your 💪 … again." with a › to the Life Panel's Strengths (N3). */
export function StrengthAgainBubble({ body, strengthId }: { body: string; strengthId: string }) {
  return (
    <div className="mr-auto flex max-w-[88%] items-end gap-1.5">
      <Link href={`/panel/strengths?open=${encodeURIComponent(strengthId)}`} data-strength-again className={BUBBLE}>
        {body}
        <span aria-hidden className={CHEVRON}>
          ›
        </span>
      </Link>
    </div>
  );
}
