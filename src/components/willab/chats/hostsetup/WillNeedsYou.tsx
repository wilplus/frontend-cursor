"use client";

import { useState, type ComponentType } from "react";
import {
  Briefcase,
  ChevronRight,
  CircleHelp,
  Hand,
  Heart,
  Inbox,
  Mic,
  Paperclip,
  Reply,
  Sparkles,
  Tag,
  UserRound,
  Users,
  type LucideProps,
} from "lucide-react";
import type { HostRecipe, PriceChange, SetupPart, SetupRead } from "@/services/api/hostSetup";
import { TapRow } from "../../WillQuestion";
import { useUserProfile } from "../../useUserProfile";
import { W } from "./hostSetupCopy";
import { openOverList, useKnownSetup, type OpenDetail } from "./hostSetupDoor";
import { answerPriceChange, useHostWork } from "./hostWork";

/* -------------------------------------------------------------------------- */
/*  Build's "Your chat", in Will's chat (backend N642 item 3, N643 item 4;     */
/*  was N629 item 1's "This needs you:" with every kind, and "And yours to   */
/*  open any time:" with the AI models and your chat, which are Build's tabs */
/*  now). Only for whoever has the ring row `chat_builder`; for everyone     */
/*  else nothing is drawn.                                                    */
/* -------------------------------------------------------------------------- */

export function Row({ title, line, kind, onOpen }: { title: string; line: string; kind: string; onOpen: () => void }) {
  return (
    <button
      type="button"
      data-needs-you={kind}
      onClick={onOpen}
      className="flex w-full items-center justify-between gap-3 rounded-2xl border border-border bg-background px-3.5 py-2.5 text-left"
    >
      <span className="flex flex-col gap-0.5">
        <b className="text-[15.5px] font-semibold text-foreground">{title}</b>
        <small className="text-[13.5px] leading-snug text-muted-foreground">{line}</small>
      </span>
      <span aria-hidden className="text-[20px] leading-none text-muted-foreground">›</span>
    </button>
  );
}

export function Said({ children }: { children: string }) {
  return <p className="m-0 text-[15.5px] font-medium text-foreground">{children}</p>;
}

/** "{name} changed the price of their model. Keep it at the new price, or
 *  drop it?" with Keep and Drop (N633 item 4); a tap at a time. */
function PriceLine({ change, coach }: { change: PriceChange; coach: boolean }) {
  const [busy, setBusy] = useState(false);
  const answer = (label: string) => {
    if (busy) return;
    setBusy(true);
    void answerPriceChange(change, label === W.keep, coach).finally(() => setBusy(false));
  };
  return (
    <div data-price-changed={change.model_id} className="flex flex-col gap-2">
      <p className="m-0 rounded-2xl bg-muted px-3.5 py-2.5 text-[15px] leading-snug text-foreground">{W.priceChanged(change.by)}</p>
      <TapRow even labels={[W.keep, W.drop]} disabled={busy} onTap={answer} dataAttr={{ "data-price-taps": "" }} />
    </div>
  );
}

/** The parts in four groups, under headings (backend N651); a part the map
 *  does not know goes last, with no heading. */
export const PART_GROUPS: { heading: string; parts: string[] }[] = [
  { heading: "About your chat", parts: ["what", "name", "line", "hello"] },
  { heading: "What comes in", parts: ["send", "questions", "taps"] },
  { heading: "What goes back", parts: ["out", "walk", "practice", "who"] },
  { heading: "What makes it smart", parts: ["models"] },
];
const EMPTY = new Set(["Off", "None yet"]);

export function groupParts(parts: SetupPart[]): { heading: string | null; parts: SetupPart[] }[] {
  const known = new Set(PART_GROUPS.flatMap((g) => g.parts));
  const groups = PART_GROUPS.map((g) => ({
    heading: g.heading as string | null,
    parts: g.parts.flatMap((id) => parts.filter((p) => p.part === id)),
  }));
  groups.push({ heading: null, parts: parts.filter((p) => !known.has(p.part)) });
  return groups.filter((g) => g.parts.length > 0);
}

/** The overview's order: top to bottom, group by group. Next follows this. */
export function orderedParts(parts: SetupPart[]): SetupPart[] {
  return groupParts(parts).flatMap((g) => g.parts);
}

type Icon = ComponentType<LucideProps>;

/** A small picture for each part, from the app's icon set. */
const PART_ICON: Record<string, Icon> = {
  what: Briefcase,
  name: Tag,
  line: Heart,
  hello: Hand,
  send: Inbox,
  questions: CircleHelp,
  taps: Mic,
  out: Reply,
  walk: Sparkles,
  practice: Paperclip,
  who: Users,
  models: Sparkles,
};

const SECTION_ICON: Record<string, Icon> = {
  "About your chat": UserRound,
  "What comes in": Inbox,
  "What goes back": Reply,
  "What makes it smart": Sparkles,
};

const MULTI = new Set(["send", "questions", "taps", "models"]);

function bitsOf(value: string): string[] {
  return value.split(" · ").map((bit) => bit.trim()).filter(Boolean);
}

/** What the row shows: chips for a list, one line of words, or "Not set". */
function PartValue({ part }: { part: SetupPart }) {
  const value = part.value?.trim() ?? "";
  if (!value || EMPTY.has(value)) {
    return <span data-not-set="" className="inline-flex rounded-full bg-muted px-2 py-0.5 text-[12px] font-medium text-muted-foreground">{W.notSet}</span>;
  }
  if (MULTI.has(part.part) && value.includes(" · ")) {
    return (
      <span className="flex flex-wrap gap-1">
        {bitsOf(value).map((bit) => (
          <span key={bit} data-part-chip="" className="inline-flex max-w-full truncate rounded-full bg-muted px-2 py-0.5 text-[13px] text-foreground">{bit}</span>
        ))}
      </span>
    );
  }
  return <span className="block truncate text-[15px] text-foreground">{value}</span>;
}

/** Question on one line, the answer under it. A tap opens that question again. */
function AnswerRow({ part, onOpen }: { part: SetupPart; onOpen: () => void }) {
  return (
    <button
      type="button"
      data-build-part={part.part}
      data-answer-row=""
      onClick={onOpen}
      className="flex min-h-[72px] w-full flex-col items-start justify-center gap-1 border-b border-[#F0F0F0] dark:border-border px-1 py-4 text-left"
    >
      <span className="text-[18px] font-semibold leading-snug text-foreground">{part.title}</span>
      <span className="max-w-full break-words text-[16px] leading-snug text-foreground">{part.value}</span>
    </button>
  );
}

/** One of the chat's parts in the settings table. A tap opens its step. */
function PartRow({ part, onOpen }: { part: SetupPart; onOpen: () => void }) {
  const Icon = PART_ICON[part.part] ?? CircleHelp;
  return (
    <button
      type="button"
      data-build-part={part.part}
      onClick={onOpen}
      className="flex min-h-12 w-full items-center gap-3 px-3.5 py-3 text-left hover:bg-muted/60 active:bg-muted"
    >
      <Icon aria-hidden className="h-5 w-5 shrink-0 text-muted-foreground" />
      <span className="flex min-w-0 flex-1 flex-col gap-0.5 sm:flex-row sm:items-center sm:gap-4">
        <span className="shrink-0 text-[15px] font-medium text-foreground sm:w-40">{part.title}</span>
        <span className="min-w-0 flex-1"><PartValue part={part} /></span>
      </span>
      <ChevronRight aria-hidden className="h-4 w-4 shrink-0 text-muted-foreground" />
    </button>
  );
}

/** The row as the first bubble of its own chat. */
export function PartBubble({ part }: { part: SetupPart }) {
  const Icon = PART_ICON[part.part] ?? CircleHelp;
  return (
    <div data-part-bubble={part.part} className="flex max-w-[86%] items-start gap-2 self-end rounded-2xl bg-primary px-3.5 py-2.5 text-[16px] leading-snug text-primary-foreground">
      <Icon aria-hidden className="mt-0.5 h-5 w-5 shrink-0" />
      <span className="min-w-0">
        <b className="block font-semibold">{part.title}</b>
        {part.value ? <span className="block">{part.value}</span> : null}
      </span>
    </div>
  );
}

/** Build's "Your chat" (backend N642 item 3, N643 item 4): the parts, then
 *  what needs you about the chat. On the stable page (`page`) it is the
 *  whole screen, with a search, and a row opens that row's own chat.
 *  Without a chat yet, "Your chat" opens the setup at "What do you do?".
 *  Only for the ring `chat_builder`. */
export default function WillNeedsYou({ page = false, onPart, source = null }: {
  page?: boolean;
  onPart?: (part: SetupPart) => void;
  /** Rows from the talk on this device, when the server has none. */
  source?: SetupRead | null;
}) {
  const { isCoach } = useUserProfile();
  const work = useHostWork(isCoach);
  const known = useKnownSetup();
  const setup = known?.recipe ? known : source;
  if (!work.ring && !page) return null;
  const over = (detail: OpenDetail) => () => openOverList(detail);
  const openPart = (part: SetupPart) => (onPart ? onPart(part) : openOverList({ part: part.part }));
  const recipe = setup?.recipe ?? null;
  const localTable = Boolean(page && source && !known?.recipe);
  const answers = work.lines.find((l) => l.kind === "answers");
  const needs = Boolean(answers) || work.skipped.length > 0 || work.priceChanges.length > 0;
  const shown = setup?.parts ?? [];
  const groups = groupParts(shown);
  return (
    <NeedsPage
      page={page}
      localTable={localTable}
      shown={shown}
      openPart={openPart}
      recipe={recipe}
      groups={groups}
      over={over}
      needs={needs}
      answers={answers}
      work={work}
      isCoach={isCoach}
    />
  );
}

function NeedsPage({
  page, localTable, shown, openPart, recipe, groups, over, needs, answers, work, isCoach,
}: {
  page: boolean;
  localTable: boolean;
  shown: SetupPart[];
  openPart: (part: SetupPart) => void;
  recipe: HostRecipe | null;
  groups: { heading: string | null; parts: SetupPart[] }[];
  over: (detail: OpenDetail) => () => void;
  needs: boolean;
  answers: { kind: string; n: number } | undefined;
  work: { skipped: string[]; priceChanges: PriceChange[] };
  isCoach: boolean;
}) {
  return (
    <div data-will-needs-you="" className={page ? "flex w-full flex-col gap-3 px-4 py-4" : "mr-auto flex w-full max-w-[90%] flex-col gap-2 py-1.5"}>
      {localTable ? (
        <div data-answer-list="" className="flex min-h-0 w-full min-w-0 flex-col overflow-x-hidden">
          {shown.map((part) => (
            <AnswerRow key={part.part} part={part} onOpen={() => openPart(part)} />
          ))}
        </div>
      ) : recipe ? (
        <>
          <div className="flex flex-wrap items-center gap-2">
            <Said>{recipe.live ? W.partsOpen : W.partsSaved}</Said>
            {recipe.live ? <span data-chat-open="" className="inline-flex rounded-full bg-[#E2F4EB] dark:bg-[#12271d] px-2 py-0.5 text-[12px] font-semibold text-[#1F7A55] dark:text-[#4cc38a]">{W.openBadge}</span> : null}
          </div>
          {groups.map((g) => {
            const SectionIcon = g.heading ? SECTION_ICON[g.heading] : null;
            return (
              <section key={g.heading ?? "more"} className="overflow-hidden rounded-2xl border border-border bg-background">
                {g.heading && SectionIcon ? (
                  <h3 className="m-0 flex items-center gap-2 border-b border-border px-3.5 py-2.5 text-[13px] font-semibold text-muted-foreground">
                    <SectionIcon aria-hidden className="h-4 w-4 text-primary" />
                    <span>{g.heading}</span>
                  </h3>
                ) : null}
                <div className="divide-y divide-border">
                  {g.parts.map((part) => (
                    <PartRow key={part.part} part={part} onOpen={() => openPart(part)} />
                  ))}
                </div>
              </section>
            );
          })}
        </>
      ) : (
        page ? <p data-settings-empty="" className="m-0 text-[16px] leading-snug">{W.finishBuild}</p> : null
      )}
      {needs ? <Said>{W.needsYou}</Said> : null}
      {work.skipped.map((by, k) => (
        <p key={`${by}-${k}`} data-left-out="" className="m-0 rounded-2xl bg-muted px-3.5 py-2.5 text-[15px] leading-snug text-foreground">
          {W.leftOut(by)}
        </p>
      ))}
      {work.priceChanges.map((change) => (
        <PriceLine key={change.model_id} change={change} coach={isCoach} />
      ))}
      {answers ? <Row kind="answers" title={W.answersToSend(answers.n)} line={W.answersLine} onOpen={over({ open: "drafts" })} /> : null}
    </div>
  );
}
