"use client";

import { useEffect, useState } from "react";
import WalkOverlay from "../walk/WalkOverlay";
import WalkFooter from "../walk/WalkFooter";
import WalkMessage from "../walk/WalkMessage";
import {
  getDoor,
  getModelCard,
  getModelCode,
  getModelDownload,
  getModelEarnings,
  getModelPrice,
  getModelUsage,
  getModelInvites,
  getModelList,
  getModelPage,
  getQueue,
  getWhatDoIGet,
  MODEL_FILTERS,
  pauseModel,
  type Door,
  type ListedInvite,
  type ModelFilter,
  type ModelList,
  type ModelPage,
  type ModelRow,
  type Queue,
  type WhatDoIGet,
} from "@/services/api/models";
import { cn } from "@/lib/utils";
import { Badge, Bar, Card, Crown, Empty, Mini } from "./ModelBits";
import { NeedsYou, OwnerRest } from "./ModelOwner";
import { MODEL_API_WORDS as API, MODELS_WORDS as W, TO_SIGN } from "./modelsCopy";

/* -------------------------------------------------------------------------- */
/*  The AI models' screens (backend N528, N563, N566; the locked prototype    */
/*  docs/design/model-launchpad-2026-11-09/, steps d:2 to d:8, q:2, q:7,      */
/*  q:9). Each is the Feedback walk's overlay, as the prototype draws it:     */
/*  the small bar with ‹ and ✕, the title, the body, one black pill with     */
/*  grey links under it. Every word arrives from the backend's rules except   */
/*  the few modelsCopy.ts holds.                                              */
/*                                                                            */
/*  What is not built yet stays drawn as the prototype draws it and does      */
/*  nothing: "Start your own" and a draft's "Continue" (the setup, MOD-24).   */
/*  The ways into a model's API and money ("Use it", "Try it", "Set your     */
/*  price", "Your usage", "Download its data", "Your earnings";              */
/*  ModelApiScreens.tsx) each show only once their own route answers, so     */
/*  none shows before the backend has it, or below the ring.                 */
/* -------------------------------------------------------------------------- */

type Nav = { onBack?: () => void; onClose: () => void };

/** Read once, again when `key` changes; null until it answers or on failure. */
export function useRead<T>(read: () => Promise<T | null>, key: string): T | null | undefined {
  const [value, setValue] = useState<T | null | undefined>(undefined);
  useEffect(() => {
    let alive = true;
    void read().then((got) => {
      if (alive) setValue(got);
    });
    return () => {
      alive = false;
    };
    // `read` is a new closure each render; `key` says when it reads anew.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  return value;
}

/* ── The list (d:2, d:8; MOD-05, MOD-13) ─────────────────────────────────── */

function ModelCard({ model, onOpen, onTeach, onUse }: { model: ModelRow; onOpen: () => void; onTeach: () => void; onUse: () => void }) {
  const sold = model.actions.includes(W.use_it);
  /** "Use it" opens the model's card, and shows only once the card answers. */
  const card = useRead(() => (sold ? getModelCard(model.id) : Promise.resolve(null)), `${model.id}${sold}`);
  const act = (label: string) => (label === W.teach_it ? onTeach : label === W.open ? onOpen : label === W.use_it ? onUse : undefined);
  const actions = model.actions.filter((label) => label !== W.use_it || card);
  return (
    <Card onOpen={onOpen} testId="model-card">
      <div className="flex items-center justify-between gap-2">
        <b className="text-[16px]">{model.name}</b>
        <Badge text={model.badge} />
      </div>
      <span className="inline-flex items-center gap-1.5 text-[13px] text-muted-foreground">
        <Crown />
        {model.started_by}
      </span>
      <Bar line={model.line} />
      <small className="text-[13px] text-muted-foreground">{model.line}</small>
      <div className="flex gap-2 pt-1">
        {actions.map((label, i) => (
          <Mini key={label} label={label} quiet={i > 0} onClick={act(label)} />
        ))}
      </div>
    </Card>
  );
}

function Filters({ labels, on, onPick }: { labels: string[]; on: ModelFilter | null; onPick: (f: ModelFilter | null) => void }) {
  return (
    <div className="flex flex-wrap gap-2">
      {labels.map((label, i) => {
        const key = MODEL_FILTERS[i];
        const active = key === on;
        return (
          <button
            key={label}
            type="button"
            aria-pressed={active}
            onClick={() => onPick(active ? null : key)}
            className={cn(
              "min-h-[40px] max-w-full rounded-[22px] border-[1.5px] border-primary px-4 py-2 text-left text-[15px] font-semibold leading-snug",
              active ? "bg-primary text-primary-foreground" : "bg-background text-primary",
            )}
          >
            {label}
          </button>
        );
      })}
    </div>
  );
}

/** "Your earnings", for a teacher whose model earns (MOD-47); nothing until
 *  the route answers with something earned. */
function EarningsRow({ onEarnings }: { onEarnings: () => void }) {
  const earnings = useRead(getModelEarnings, "earnings");
  if (!earnings?.rows.length) return null;
  return (
    <button type="button" data-models-earnings onClick={onEarnings} className="flex flex-col gap-0.5 rounded-2xl border-[1.5px] border-border px-3.5 py-3 text-left">
      <b>{earnings.title}</b>
      <span className="text-[13.5px] text-muted-foreground">{earnings.line}</span>
    </button>
  );
}

type ListWays = {
  onWhat: () => void;
  onOpen: (id: string) => void;
  onTeach: (id: string) => void;
  onUse: (id: string) => void;
  onEarnings: () => void;
  /** "Start your own" and "Start the first one" (MOD-24); null hides them
   *  (the setup's routes answered 404). */
  onStart: (() => void) | null;
  /** A draft's "Continue" (MOD-25). */
  onContinue: (id: string) => void;
  /** An invite's "Open" (MOD-49). */
  onInvite: (invite: ListedInvite) => void;
};

/** The invites to teach, open or put off, each as it stays in the chat
 *  (MOD-49): nothing until GET /v2/models/invites answers with one. */
function InviteRows({ onInvite }: { onInvite: (invite: ListedInvite) => void }) {
  const invites = useRead(getModelInvites, "invites");
  return (
    <>
      {(invites ?? []).map((invite) => (
        <div key={invite.id} data-model-invite className="flex flex-col gap-1.5 rounded-[18px] border-[1.5px] border-border px-3.5 py-[13px]">
          <p className="m-0 text-[16px] leading-snug text-foreground">{invite.lines[0]}</p>
          {invite.lines.slice(1).map((line) => (
            <p key={line} className="m-0 text-[14px] leading-snug text-muted-foreground">{line}</p>
          ))}
          <div className="flex gap-2 pt-1">
            <Mini label={invite.action} onClick={() => onInvite(invite)} />
          </div>
        </div>
      ))}
    </>
  );
}

function ListBody({ list, onWhat, onOpen, onTeach, onUse, onEarnings, onClear, onStart, onContinue, onInvite }: ListWays & { list: ModelList; onClear: () => void }) {
  if (list.empty) {
    return (
      <>
        <Empty title={list.empty.title} line={list.empty.line} />
        <WalkFooter pill={onStart ? { label: list.empty.actions[0], onClick: onStart } : null} links={[{ label: list.empty.actions[1], onClick: onClear }]} />
      </>
    );
  }
  return (
    <>
      <button type="button" onClick={onWhat} className="flex flex-col gap-0.5 rounded-2xl bg-[#E2F4EB] px-3.5 py-3 text-left">
        <b>{list.what_do_i_get}</b>
        <span className="text-[13.5px] text-muted-foreground">{TO_SIGN.whatDoIGetLine}</span>
      </button>
      <EarningsRow onEarnings={onEarnings} />
      <InviteRows onInvite={onInvite} />
      {list.drafts.map((d) => (
        <Card key={d.id} draft testId="model-draft">
          <div className="flex items-center justify-between gap-2">
            <b className="text-[16px]">{d.name}</b>
            <Badge text={d.badge} />
          </div>
          <small className="text-[13px] text-muted-foreground">{d.line}</small>
          <div className="flex gap-2 pt-1">
            {d.actions.map((label) => (
              <Mini key={label} label={label} onClick={label === W.continue ? () => onContinue(d.id) : undefined} />
            ))}
          </div>
        </Card>
      ))}
      {list.models.map((m) => (
        <ModelCard key={m.id} model={m} onOpen={() => onOpen(m.id)} onTeach={() => onTeach(m.id)} onUse={() => onUse(m.id)} />
      ))}
    </>
  );
}

type Optional = "onUse" | "onEarnings" | "onStart" | "onContinue" | "onInvite";

export function ModelListScreen({
  onBack,
  onClose,
  onUse = () => undefined,
  onEarnings = () => undefined,
  onStart = null,
  onContinue = () => undefined,
  onInvite = () => undefined,
  ...ways
}: Nav & Omit<ListWays, Optional> & Partial<Pick<ListWays, Optional>>) {
  const [typed, setTyped] = useState("");
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<ModelFilter | null>(null);
  useEffect(() => {
    const t = window.setTimeout(() => setQuery(typed), 300);
    return () => window.clearTimeout(t);
  }, [typed]);
  const list = useRead(() => getModelList(query, filter), `${query}|${filter ?? ""}`);
  const clear = () => {
    setTyped("");
    setQuery("");
    setFilter(null);
  };
  const footer = list && !list.empty && onStart ? <WalkFooter pill={{ label: list.start, onClick: onStart }} /> : null;
  return (
    <WalkOverlay caption={W.row_models} onBack={onBack} backLabel={W.row_models} title={W.row_models} onClose={onClose} footer={footer} testId="models-list">
      {list ? (
        <>
          <p className="m-0 text-[15px] text-muted-foreground">{list.intro}</p>
          <input
            type="search"
            aria-label={TO_SIGN.searchPlaceholder}
            placeholder={TO_SIGN.searchPlaceholder}
            value={typed}
            onChange={(e) => setTyped(e.target.value)}
            className="block min-h-[40px] w-full rounded-3xl border border-border bg-background py-2 pl-3.5 pr-4 text-[15px] leading-snug outline-none focus:border-primary"
          />
          <Filters labels={list.filters} on={filter} onPick={setFilter} />
          <ListBody list={list} {...ways} onUse={onUse} onEarnings={onEarnings} onStart={onStart} onContinue={onContinue} onInvite={onInvite} onClear={clear} />
        </>
      ) : null}
    </WalkOverlay>
  );
}

/* ── What do I get? (d:7; MOD-12) ────────────────────────────────────────── */

const GET_ICONS = [
  "bg-[#E2F4EB] [--mark:#2F9E6E] rounded-[4px]",
  "bg-[#FFF4D6] [--mark:#E8A317] rounded-full",
  "bg-[#E3EEFB] [--mark:#1E4C99] rounded-[2px_10px_2px_10px]",
];

export function WhatDoIGetScreen({ onBack, onClose }: Nav) {
  const what = useRead<WhatDoIGet>(getWhatDoIGet, "what");
  const footer = what ? <WalkFooter pill={{ label: what.back, onClick: onBack ?? onClose }} /> : null;
  return (
    <WalkOverlay onBack={onBack} backLabel={what?.title} onClose={onClose} footer={footer} testId="models-what">
      {what?.cards.map((card, i) => (
        <div key={card.title} className="grid grid-cols-[44px_minmax(0,1fr)] items-start gap-3 rounded-[18px] border-[1.5px] border-border p-3.5">
          <span aria-hidden className={cn("flex h-11 w-11 items-center justify-center rounded-full", GET_ICONS[i]?.split(" ")[0])}>
            <span className={cn("h-[18px] w-[18px] border-[2.5px] border-[color:var(--mark)]", GET_ICONS[i]?.split(" ").slice(1).join(" "))} />
          </span>
          <span>
            <b className="block text-[17px]">{card.title}</b>
            <span className="block text-[15px] leading-[1.45] text-muted-foreground">{card.line}</span>
          </span>
        </div>
      ))}
    </WalkOverlay>
  );
}

/* ── A model's page (d:3; MOD-03, MOD-06) ────────────────────────────────── */

export function Ring({ percent }: { percent: number }) {
  return (
    <div
      aria-hidden
      className="flex h-[78px] w-[78px] shrink-0 items-center justify-center rounded-full"
      style={{ background: `conic-gradient(#2F9E6E ${percent}%, hsl(var(--muted)) 0)` }}
    >
      <span className="flex h-[60px] w-[60px] items-center justify-center rounded-full bg-background text-[17px] font-extrabold">{percent}%</span>
    </div>
  );
}

/** Totals only for the public (N526 item 3): the backend sends no jar, no
 *  stage, no agreement and nothing about a person on a public page, and this
 *  draws none of what a teacher's page adds. */
export type ApiWay = "card" | "try" | "price" | "usage" | "download";

/** The ways into a model's API and money from its page, each probed on its
 *  own route: "Try it" once the code answers (the API's routes are there),
 *  the card once a version is released, the price for its founder, usage
 *  once the caller has a key, the download for its owner and teachers. */
function useApiWays(page: ModelPage | null | undefined): Set<ApiWay> {
  const [ways, setWays] = useState<Set<ApiWay>>(new Set());
  const key = page ? `${page.id}|${page.role}|${page.status}` : "";
  useEffect(() => {
    if (!page) return;
    let alive = true;
    const probes: [ApiWay, Promise<boolean>][] = [
      ["try", page.status === "learning" || page.status === "ready" ? getModelCode(page.id).then(Boolean) : Promise.resolve(false)],
      ["card", getModelCard(page.id).then(Boolean)],
      ["price", page.role === "owner" ? getModelPrice(page.id).then(Boolean) : Promise.resolve(false)],
      ["usage", getModelUsage(page.id).then((u) => Boolean(u?.keys.length))],
      ["download", page.role === "public" ? Promise.resolve(false) : getModelDownload(page.id).then((d) => Boolean(d && !d.refused))],
    ];
    void Promise.all(probes.map(([way, ok]) => ok.then((yes) => (yes ? way : null)))).then((open) => {
      if (alive) setWays(new Set(open.filter((w): w is ApiWay => w !== null)));
    });
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  return ways;
}

const API_LABEL: Record<Exclude<ApiWay, "try">, string> = {
  card: API.use_it,
  price: API.price_title,
  usage: API.usage_title,
  download: API.download_title,
};

export function ModelPageScreen({ modelId, onBack, onClose, onTeach, onApi = () => undefined, onFix = () => undefined }: Nav & {
  modelId: string;
  onTeach: (page: ModelPage) => void;
  onApi?: (way: ApiWay, page: ModelPage) => void;
  /** Its owner's way back into one setup step ("Make those two clearer", a
   *  checklist item; MOD-36, MOD-37). */
  onFix?: (step: string) => void;
}) {
  const page = useRead(() => getModelPage(modelId), modelId);
  const ways = useApiWays(page);
  const footer = page ? (
    <WalkFooter
      pill={{ label: page.actions[0] ?? W.teach_it, onClick: () => onTeach(page) }}
      links={page.actions
        .slice(1)
        .filter((label) => label !== W.try_it || ways.has("try"))
        .map((label) => (label === W.try_it ? { label, onClick: () => onApi("try", page) } : { label, onClick: () => undefined, disabled: true }))}
    />
  ) : null;
  const more = (["card", "price", "usage", "download"] as const).filter((w) => ways.has(w));
  return (
    <WalkOverlay onBack={onBack} backLabel={page?.name} title={page?.name} onClose={onClose} footer={footer} testId="model-page">
      {page ? (
        <>
          {page.owner ? <NeedsYou panel={page.owner} onFix={onFix} /> : null}
          <div className="flex items-center gap-3.5">
            <Ring percent={page.percent} />
            <p data-model-summary className="m-0 text-[15px] leading-snug">{page.owner?.head ?? page.summary}</p>
          </div>
          {page.owner ? <OwnerRest panel={page.owner} onFix={onFix} /> : null}
          {page.description ? <p className="m-0">{page.description}</p> : null}
          {page.status === "learning" ? <p className="m-0 text-[15px] text-muted-foreground">{TO_SIGN.pageTryNow}</p> : null}
          {more.length ? (
            <div data-model-api-ways className="flex flex-wrap gap-2">
              {more.map((w) => (
                <Mini key={w} label={API_LABEL[w]} quiet onClick={() => onApi(w, page)} />
              ))}
            </div>
          ) : null}
        </>
      ) : null}
    </WalkOverlay>
  );
}

/* ── The door (d:4; MOD-07) ──────────────────────────────────────────────── */

export function DoorScreen({ onBack, onClose, onYes, onNo }: Nav & {
  onYes: () => void;
  /** "Not now"; by default back (an invite's keeps it, MOD-49). */
  onNo?: () => void;
}) {
  const door = useRead<Door>(getDoor, "door");
  const footer = door ? (
    <WalkFooter pill={{ label: door.actions[0], onClick: onYes }} links={[{ label: door.actions[1], onClick: onNo ?? onBack ?? onClose }]} />
  ) : null;
  return (
    <WalkOverlay onBack={onBack} backLabel={door?.title} onClose={onClose} footer={footer} testId="models-door">
      {door?.lines.map((line) => <WalkMessage key={line}>{line}</WalkMessage>)}
    </WalkOverlay>
  );
}

/* ── The one queue (q:2, q:9; MOD-15, MOD-23) ────────────────────────────── */

function QueueRow({ row, onPause, onTeach }: { row: Queue["models"][number]; onPause: () => void; onTeach: () => void }) {
  return (
    <div
      data-testid="queue-model"
      role="button"
      tabIndex={0}
      onClick={onTeach}
      onKeyDown={(e) => {
        if (e.key === "Enter") onTeach();
      }}
      className={cn("grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-2.5 gap-y-1.5 rounded-2xl border-[1.5px] border-border px-3 py-[11px]", row.paused && "opacity-50")}
    >
      <span className="col-start-1 flex min-w-0 flex-col">
        <b className="text-[15.5px] font-semibold">{row.name}</b>
        <small className="text-[12.5px] text-muted-foreground">{row.line}</small>
      </span>
      <span className="col-start-2 row-start-1 justify-self-end">
        <Badge text={row.badge} />
      </span>
      <span className="col-start-1 text-[13px] font-bold text-[#C2410C]">
        {row.waiting} <span className="font-medium text-muted-foreground">{TO_SIGN.waiting}</span>
      </span>
      <span className="col-start-2 justify-self-end" aria-pressed={row.paused}>
        <Mini label={row.action} quiet onClick={onPause} />
      </span>
    </div>
  );
}

export function QueueScreen({ title, onBack, onClose, onStart, onAdd, onDone }: Nav & {
  /** The row's own name, "Your queue" (backend WORDS row_queue). */
  title: string;
  onStart: (only: string | null) => void;
  onAdd: () => void;
  /** "Back to your chats". */
  onDone: () => void;
}) {
  const [version, setVersion] = useState(0);
  const queue = useRead(() => getQueue(), `queue${version}`);
  const pause = async (id: string, paused: boolean) => {
    if ((await pauseModel(id, !paused)) !== null) setVersion((v) => v + 1);
  };
  const footer = !queue ? null : queue.empty ? (
    <WalkFooter pill={{ label: queue.empty.action, onClick: onDone }} />
  ) : (
    <WalkFooter pill={{ label: queue.actions?.[0] ?? W.queue_start, onClick: () => onStart(null) }} links={[{ label: queue.actions?.[1] ?? W.queue_add, onClick: onAdd }]} />
  );
  return (
    <WalkOverlay onBack={onBack} backLabel={title} title={title} onClose={onClose} footer={footer} testId="models-queue">
      {queue?.empty ? <Empty title={queue.empty.title} line={queue.empty.line} /> : null}
      {queue && !queue.empty ? (
        <>
          <p data-queue-header className="m-0 px-[17px] text-[18.5px] leading-[1.45]">{queue.header}</p>
          {queue.models.map((row) => (
            <QueueRow key={row.id} row={row} onPause={() => void pause(row.id, row.paused)} onTeach={() => onStart(row.id)} />
          ))}
          <p className="m-0 text-[14px] text-muted-foreground">{queue.hint}</p>
        </>
      ) : null}
    </WalkOverlay>
  );
}
