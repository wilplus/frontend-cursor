"use client";

import { useState, type ReactNode } from "react";
import WalkOverlay from "../walk/WalkOverlay";
import WalkFooter from "../walk/WalkFooter";
import type { SetupChoice, SetupScreen, SetupStep } from "@/services/api/modelSetup";
import { Badge, Bar, Crown } from "./ModelBits";
import { SETUP_WORDS } from "./modelsCopy";
import { Chapters, Checklist, Choice, Field, FileRow, Hist, Input, Locked, Muted, Rows, Said } from "./SetupParts";

/* -------------------------------------------------------------------------- */
/*  The setup's steps, one screen each (backend N528 item 4, N566 items 2 to  */
/*  6, N570, N571, N582, N585; App Model MOD-24 to MOD-38, MOD-54, MOD-55;    */
/*  the locked prototype's s:1 to s:17). Each draws what its `screen` says    */
/*  and hands the owner's answer to `send`, in the shape the backend's        */
/*  handler reads (services/model_setup_store.py).                            */
/* -------------------------------------------------------------------------- */

export type Answer = Record<string, unknown>;
export type StepNav = {
  /** ‹: the step before, or out of the setup on its first. */
  onBack?: () => void;
  /** ✕: the draft is kept (each step is saved as it is answered), back to the list. */
  onClose: () => void;
};
export type StepProps = StepNav & {
  screen: SetupScreen;
  busy: boolean;
  /** The backend's refusal of the last answer, in its words. */
  refused: string | null;
  send: (answer: Answer) => void;
  /** Opens one step (a checklist item, "Fix the file first"). */
  open: (step: SetupStep) => void;
};

const SETUP_SCREEN_ID = "model-setup";

/** The frame every step shares: ‹ with the caption, ✕, the chapters and
 *  the thin bar, the body, the backend's refusal, the footer. */
export function SetupFrame({ screen, onBack, onClose, refused, footer, children }: StepNav & {
  screen: SetupScreen;
  refused: string | null;
  footer: ReactNode;
  children: ReactNode;
}) {
  return (
    <WalkOverlay
      onBack={onBack}
      backLabel={screen.caption}
      caption={screen.caption}
      onClose={onClose}
      footer={footer}
      bare
      testId={SETUP_SCREEN_ID}
    >
      <div data-setup-step={screen.step} className="flex min-h-0 flex-1 flex-col">
        {screen.step === "ready" ? null : <Chapters screen={screen} />}
        <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-5 py-3.5">
          {children}
          {refused ? (
            <p role="alert" data-setup-refused className="m-0 text-[14px] font-semibold text-[#C2410C]">
              {refused}
            </p>
          ) : null}
        </div>
      </div>
    </WalkOverlay>
  );
}

function Lines({ screen }: { screen: SetupScreen }) {
  return (
    <>
      {screen.lines.map((line) => (
        <Said key={line}>{line}</Said>
      ))}
    </>
  );
}

function Notes({ notes }: { notes: string[] }) {
  return (
    <>
      {notes.map((n) => (
        <Muted key={n}>{n}</Muted>
      ))}
    </>
  );
}

const text = (v: unknown) => (typeof v === "string" ? v : "");

/* ── Describe: three answers, one per screen (MOD-24, MOD-26, MOD-54) ────── */

function SimilarSheet({ sheet, onTeach, onAnyway }: { sheet: NonNullable<SetupScreen["sheet"]>; onTeach: () => void; onAnyway: () => void }) {
  const card = sheet.card;
  return (
    <div data-setup-sheet className="absolute inset-0 z-10 flex flex-col justify-end bg-black/40">
      <div className="flex flex-col gap-3 rounded-t-[22px] bg-background px-[18px] pb-4 pt-2.5">
        <span aria-hidden className="mx-auto h-1 w-10 rounded-full bg-muted" />
        <h3 className="m-0 text-[22px] font-bold leading-[1.2]">{sheet.title}</h3>
        <div data-testid="model-card" className="flex flex-col gap-1.5 rounded-[18px] border-[1.5px] border-border px-3.5 py-[13px]">
          <div className="flex items-center justify-between gap-2">
            <b className="text-[16px]">{card.name}</b>
            <Badge text={card.badge} />
          </div>
          <span className="inline-flex items-center gap-1.5 text-[13px] text-muted-foreground">
            <Crown />
            {card.started_by}
          </span>
          <Bar line={card.line} />
          <small className="text-[13px] text-muted-foreground">{card.line}</small>
        </div>
        <p className="m-0 text-[15px] text-muted-foreground">{sheet.line}</p>
        <WalkFooter pill={{ label: sheet.actions[0], onClick: onTeach }} links={[{ label: sheet.actions[1], onClick: onAnyway }]} />
      </div>
    </div>
  );
}

export function DescribeStep(p: StepProps & { onTeachOther: (modelId: string) => void }) {
  const { screen } = p;
  const [value, setValue] = useState(() => text(screen.fields[screen.step]));
  const footer = <WalkFooter pill={{ label: screen.actions[0], onClick: () => p.send({ value }), disabled: p.busy || !value.trim() }} />;
  return (
    <>
      <SetupFrame {...p} footer={footer}>
        <Lines screen={screen} />
        <Field value={value} label={screen.lines[0] ?? ""} onChange={setValue} />
        <Notes notes={screen.notes} />
      </SetupFrame>
      {screen.sheet ? (
        <SimilarSheet
          sheet={screen.sheet}
          onTeach={() => p.onTeachOther(screen.sheet!.card.id)}
          onAnyway={() => p.send({ value, anyway: true })}
        />
      ) : null}
    </>
  );
}

/* ── What it will do, and its name (MOD-27) ──────────────────────────────── */

export function KindStep(p: StepProps) {
  const { screen } = p;
  const [parts, setParts] = useState<Record<string, boolean>>(() => Object.fromEntries(screen.choices.map((c) => [c.key, Boolean(c.check)])));
  const [name, setName] = useState(() => text(screen.fields.name));
  const some = Object.values(parts).some(Boolean);
  const footer = <WalkFooter pill={{ label: screen.actions[0], onClick: () => p.send({ parts, name }), disabled: p.busy || !some || !name.trim() }} />;
  return (
    <SetupFrame {...p} footer={footer}>
      <Lines screen={screen} />
      {screen.choices.map((c) => (
        <Choice key={c.key} choice={c} check={parts[c.key]} onClick={() => setParts((was) => ({ ...was, [c.key]: !was[c.key] }))} />
      ))}
      <label className="-mb-2 text-[14px] font-semibold text-muted-foreground">{text(screen.fields.name_label)}</label>
      <Input value={name} label={text(screen.fields.name_label)} onChange={setName} />
    </SetupFrame>
  );
}

/* ── One example and a scale with a word for every point (MOD-28) ─────────── */

type Point = { point: number; t: string; d: string };

export function ScaleStep(p: StepProps & { onStartNow: (scale: { t: string; d: string }[]) => void }) {
  const { screen } = p;
  const [scale, setScale] = useState<Point[]>(() => (Array.isArray(screen.fields.scale) ? (screen.fields.scale as Point[]) : []));
  const every = scale.length > 0 && scale.every((s) => s.t.trim());
  const plain = () => scale.map(({ t, d }) => ({ t, d }));
  const edit = (i: number, key: "t" | "d", v: string) => setScale((was) => was.map((s, j) => (j === i ? { ...s, [key]: v } : s)));
  const footer = (
    <WalkFooter
      pill={{ label: screen.actions[0], onClick: () => p.send({ scale: plain() }), disabled: p.busy || !every }}
      links={screen.actions[1] ? [{ label: screen.actions[1], onClick: () => p.onStartNow(plain()), disabled: p.busy || !every }] : []}
    />
  );
  return (
    <SetupFrame {...p} footer={footer}>
      <Lines screen={screen} />
      <ol data-setup-scale className="m-0 flex list-none flex-col gap-1.5 p-0">
        {scale.map((s, i) => (
          <li key={s.point} className="grid grid-cols-[32px_minmax(0,1fr)] items-center gap-2.5 rounded-[14px] border-[1.5px] border-border px-3 py-2">
            <b className="flex h-7 w-7 items-center justify-center rounded-full bg-foreground text-[14px] text-background">{s.point}</b>
            <span className="flex min-w-0 flex-col gap-0.5">
              <input
                aria-label={`${s.point}`}
                value={s.t}
                onChange={(e) => edit(i, "t", e.target.value)}
                className="w-full border-0 border-b border-dashed border-transparent bg-transparent py-px text-[15.5px] font-semibold text-foreground outline-none focus:border-foreground"
              />
              <input
                aria-label={`${s.point} ·`}
                value={s.d}
                onChange={(e) => edit(i, "d", e.target.value)}
                className="w-full border-0 border-b border-dashed border-transparent bg-transparent py-px text-[14px] text-muted-foreground outline-none focus:border-foreground"
              />
            </span>
          </li>
        ))}
      </ol>
      <Notes notes={screen.notes} />
    </SetupFrame>
  );
}

/* ── The teachers' question and the list (MOD-38; N570) ──────────────────── */

export function QuestionStep(p: StepProps) {
  const { screen } = p;
  const [question, setQuestion] = useState(() => text(screen.fields.question));
  const listed = Array.isArray(screen.fields.options);
  const [options, setOptions] = useState<string[]>(() => (listed ? (screen.fields.options as string[]) : []));
  const filled = options.filter((o) => o.trim()).length;
  const ok = question.trim() && (!listed || filled >= 2);
  const answer = listed ? { question, pick_question: screen.fields.pick_question, options } : { question };
  const footer = <WalkFooter pill={{ label: screen.actions[0], onClick: () => p.send(answer), disabled: p.busy || !ok }} />;
  return (
    <SetupFrame {...p} footer={footer}>
      <Said>{screen.lines[0]}</Said>
      <Input value={question} label={screen.lines[0] ?? ""} onChange={setQuestion} />
      {listed ? (
        <>
          <Said>{screen.lines[1]}</Said>
          {options.map((o, i) => (
            <Input key={i} value={o} label={`${i + 1}`} onChange={(v) => setOptions((was) => was.map((x, j) => (j === i ? v : x)))} />
          ))}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setOptions((was) => [...was, ""])}
              className="rounded-full border-[1.5px] border-border bg-background px-3.5 py-[7px] text-[14px] font-semibold"
            >
              {text(screen.fields.add_option)}
            </button>
          </div>
        </>
      ) : null}
      <Notes notes={screen.notes} />
    </SetupFrame>
  );
}

/* ── The AI for each part (MOD-29) ───────────────────────────────────────── */

export function AiStep(p: StepProps) {
  const { screen } = p;
  const footer = <WalkFooter pill={{ label: screen.actions[0], onClick: () => p.send({}), disabled: p.busy }} />;
  return (
    <SetupFrame {...p} footer={footer}>
      <Lines screen={screen} />
      {screen.choices.map((c) => (
        <Choice key={c.key} choice={c} />
      ))}
      {screen.others ? (
        <>
          <p className="m-0 pt-1 text-[14px] text-muted-foreground">{screen.others.title}</p>
          {screen.others.choices.map((c) => (
            <Choice key={c.key} choice={c} />
          ))}
        </>
      ) : null}
    </SetupFrame>
  );
}

/* ── Starting rules from research (MOD-30; N585) ─────────────────────────── */

export function RulesStep(p: StepProps & { onStudy: (file: File) => void }) {
  const { screen } = p;
  const [ticks, setTicks] = useState<boolean[]>(() => screen.choices.map((c) => Boolean(c.check)));
  const [strict, setStrict] = useState<string | null>(() => screen.strictness?.choices.find((c) => c.on)?.key ?? null);
  const footer = (
    <WalkFooter
      pill={{ label: screen.actions[0], onClick: () => p.send({ use: true, on: ticks, ...(strict ? { strictness: strict } : {}) }), disabled: p.busy }}
      links={[{ label: screen.actions[1], onClick: () => p.send({}), disabled: p.busy }]}
    />
  );
  return (
    <SetupFrame {...p} footer={footer}>
      <Lines screen={screen} />
      <FileRow name={text(screen.fields.study) || null} accept=".pdf,.txt,.md,application/pdf,text/plain" onFile={p.onStudy} />
      {screen.choices.map((c, i) => (
        <Choice key={c.key} choice={c} check={ticks[i]} onClick={() => setTicks((was) => was.map((t, j) => (j === i ? !t : t)))} />
      ))}
      {screen.strictness ? (
        <>
          <p className="m-0 pt-1 text-[14px] text-muted-foreground">{screen.strictness.title}</p>
          {screen.strictness.choices.map((c) => (
            <Choice key={c.key} choice={c} on={strict === c.key} onClick={() => setStrict(c.key)} />
          ))}
        </>
      ) : null}
      <Notes notes={screen.notes} />
    </SetupFrame>
  );
}

/* ── Existing data: the file, its columns, its check (MOD-31) ─────────────── */

export function DataStep(p: StepProps & { onData: (file: File) => void }) {
  const { screen } = p;
  const file = text(screen.fields.file) || null;
  const footer = (
    <WalkFooter
      pill={{ label: screen.actions[0], onClick: () => p.send({ use: true }), disabled: p.busy || !file }}
      links={[{ label: screen.actions[1], onClick: () => p.send({}), disabled: p.busy }]}
    />
  );
  return (
    <SetupFrame {...p} footer={footer}>
      <Lines screen={screen} />
      <FileRow name={file} accept=".csv,.json,text/csv,application/json" onFile={p.onData} />
      <Notes notes={screen.notes} />
    </SetupFrame>
  );
}

/** A tap moves a column to the next role this screen names a line for, so
 *  no role is drawn without the backend's own words for it. */
function nextRole(roles: { role: string; line: string }[], role: string): string {
  const i = roles.findIndex((r) => r.role === role);
  return roles[(i + 1) % roles.length].role;
}

export function ColumnsStep(p: StepProps) {
  const { screen } = p;
  const roles = [...new Map(screen.choices.map((c) => [c.role ?? "", { role: c.role ?? "", line: c.line }])).values()];
  const [map, setMap] = useState(() => screen.choices.map((c) => ({ col: c.key, role: c.role ?? "unused" })));
  const lineOf = (role: string) => roles.find((r) => r.role === role)?.line ?? "";
  const footer = <WalkFooter pill={{ label: screen.actions[0], onClick: () => p.send({ map }), disabled: p.busy }} />;
  return (
    <SetupFrame {...p} footer={footer}>
      <Lines screen={screen} />
      {map.map((m, i) => {
        const off = m.role === "out" || m.role === "unused";
        const shown: SetupChoice = { key: m.col, title: m.col, line: lineOf(m.role), on: !off, role: m.role };
        return (
          <div key={m.col} data-setup-role={m.role} className={off ? "opacity-45" : undefined}>
            <Choice choice={shown} onClick={() => setMap((was) => was.map((x, j) => (j === i ? { ...x, role: nextRole(roles, x.role) } : x)))} />
          </div>
        );
      })}
    </SetupFrame>
  );
}

export function CheckStep(p: StepProps) {
  const { screen } = p;
  const consent = screen.choices[0];
  const [ticked, setTicked] = useState(Boolean(consent?.check));
  const footer = (
    <WalkFooter
      pill={{ label: screen.actions[0], onClick: () => p.send({ consent: true }), disabled: p.busy || !ticked }}
      links={[{ label: screen.actions[1], onClick: () => p.open("data"), disabled: p.busy }]}
    />
  );
  return (
    <SetupFrame {...p} footer={footer}>
      <Lines screen={screen} />
      {screen.table ? <Rows rows={screen.table} /> : null}
      {screen.hist?.length ? <Hist hist={screen.hist} /> : null}
      <Notes notes={screen.notes} />
      {(screen.after ?? []).map((line) => (
        <Said key={line}>{line}</Said>
      ))}
      {consent ? <Choice choice={consent} check={ticked} onClick={() => setTicked((t) => !t)} /> : null}
    </SetupFrame>
  );
}

/* ── The final exam, set aside by two experts (MOD-32) ───────────────────── */

export function ExamStep(p: StepProps) {
  const { screen } = p;
  const [me, ...people] = screen.choices;
  const [expert, setExpert] = useState<string | null>(() => people.find((c) => c.check)?.key ?? null);
  const pick = people.find((c) => c.key === expert);
  const label = pick ? SETUP_WORDS.ask.replace("{name}", pick.title.split(" ")[0]) : screen.actions[0];
  const footer = <WalkFooter pill={{ label, onClick: () => p.send({ expert }), disabled: p.busy || !pick }} />;
  return (
    <SetupFrame {...p} footer={footer}>
      <Lines screen={screen} />
      {me ? <Choice choice={me} /> : null}
      {people.map((c) => (
        <Choice key={c.key} choice={c} check={c.key === expert} onClick={() => setExpert(c.key)} />
      ))}
    </SetupFrame>
  );
}

/* ── The teachers' journey, shorter or longer (MOD-33) ───────────────────── */

export function JourneyStep(p: StepProps) {
  const { screen } = p;
  const steps = Array.isArray(screen.fields.steps) ? (screen.fields.steps as string[]) : [];
  const footer = <WalkFooter pill={{ label: screen.actions[0], onClick: () => p.send({}), disabled: p.busy }} />;
  return (
    <SetupFrame {...p} footer={footer}>
      <Lines screen={screen} />
      <ol data-setup-journey className="m-0 flex flex-col gap-2 pl-[22px] text-[16px]">
        {steps.map((s) => (
          <li key={s}>{s}</li>
        ))}
      </ol>
      <div className="flex gap-2">
        {screen.choices.map((c) => (
          <button
            key={c.key}
            type="button"
            disabled={p.busy}
            onClick={() => p.send({ change: c.key })}
            className="rounded-full border-[1.5px] border-border bg-background px-3.5 py-[7px] text-[14px] font-semibold"
          >
            {c.title}
          </button>
        ))}
      </div>
    </SetupFrame>
  );
}

/* ── Who can see it, and the disclaimer before Public (MOD-34) ───────────── */

export function ShareStep(p: StepProps) {
  const { screen } = p;
  const [vis, setVis] = useState(() => screen.choices.find((c) => c.on)?.key ?? "private");
  const footer = <WalkFooter pill={{ label: screen.actions[0], onClick: () => p.send({ visibility: vis }), disabled: p.busy }} />;
  return (
    <SetupFrame {...p} footer={footer}>
      <Lines screen={screen} />
      {screen.choices.map((c) => (
        <Choice key={c.key} choice={c} on={vis === c.key} onClick={() => setVis(c.key)} />
      ))}
    </SetupFrame>
  );
}

export function PublicStep(p: StepProps) {
  const { screen } = p;
  const footer = (
    <WalkFooter
      pill={{ label: screen.actions[0], onClick: () => p.send({ confirm: true }), disabled: p.busy }}
      links={[{ label: screen.actions[1], onClick: () => p.send({ confirm: false }), disabled: p.busy }]}
    />
  );
  return (
    <SetupFrame {...p} footer={footer}>
      <Lines screen={screen} />
    </SetupFrame>
  );
}

/* ── Inviting teachers (MOD-35) ──────────────────────────────────────────── */

export function InviteStep(p: StepProps & { onCopyLink: () => void }) {
  const { screen } = p;
  const [chosen, setChosen] = useState<Record<string, boolean>>(() => Object.fromEntries(screen.choices.map((c) => [c.key, Boolean(c.check)])));
  const people = Object.keys(chosen).filter((k) => chosen[k] && k !== "team");
  const footer = (
    <WalkFooter
      pill={{ label: screen.actions[0], onClick: () => p.send({ people }), disabled: p.busy }}
      links={[{ label: screen.actions[1], onClick: p.onCopyLink }]}
    />
  );
  return (
    <SetupFrame {...p} footer={footer}>
      <Lines screen={screen} />
      {screen.choices.map((c) => (
        <Choice key={c.key} choice={c} check={chosen[c.key]} onClick={() => setChosen((was) => ({ ...was, [c.key]: !was[c.key] }))} />
      ))}
    </SetupFrame>
  );
}

/* ── Ready to learn, with what is left (MOD-36) ──────────────────────────── */

export function ReadyStep(p: StepProps & { onTry: (() => void) | null; onList: () => void }) {
  const { screen } = p;
  const footer = (
    <WalkFooter
      pill={p.onTry ? { label: screen.actions[0], onClick: p.onTry } : null}
      links={[{ label: screen.actions[1], onClick: p.onList }]}
    />
  );
  return (
    <SetupFrame {...p} onBack={undefined} footer={footer}>
      {screen.lines.map((line) => (
        <p key={line} data-setup-ready className="m-0 text-[15px] leading-snug">
          {line}
        </p>
      ))}
      {screen.checklist ? <Checklist list={screen.checklist} onOpen={(s) => p.open(s as SetupStep)} /> : null}
      {screen.locked ? <Locked locked={screen.locked} /> : null}
    </SetupFrame>
  );
}
