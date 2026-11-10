"use client";

import { useEffect, useSyncExternalStore } from "react";
import { getCheck, getDrafts, keepPart, readSetup, type PriceChange, type RecipeModel } from "@/services/api/hostSetup";
import { getQueue } from "@/services/api/models";
import { fetchMomentsQueue } from "@/services/api/coachWalk";

/* -------------------------------------------------------------------------- */
/*  What needs the person, for Will's lines and his row (backend N629 items  */
/*  1, 2, 4): read from what the app already holds, never copied. Only for   */
/*  whoever has the ring row `chat_builder` (the setup's read answers); for  */
/*  everyone else `ring` stays false and nothing more is read.               */
/*                                                                            */
/*    answers   GET /v2/chats/setup/drafts, one per draft                     */
/*    moments   the coach's queue (GET /v2/coach/queue/moments), the moments  */
/*              waiting across their speakers; a coach only                   */
/*    examples  the AI models' teaching queue (GET /v2/models/queue)          */
/*    check     the chat's own models with a model_id, each with something to */
/*              check (GET /v2/models/<id>/check: items, not done)            */
/*                                                                            */
/*  Each number counts the person's own work, never a person (Never 1).      */
/* -------------------------------------------------------------------------- */

export type WorkKind = "answers" | "moments" | "examples" | "check";
export type HostWork = {
  ring: boolean;
  /** Each kind with something waiting, in Will's order. */
  lines: { kind: WorkKind; n: number }[];
  /** The first model with something to check (the line opens it). */
  checkModel: string | null;
  /** The host has a set-up chat ("Your chat"). */
  ownChat: boolean;
  /** Whose models were left out today, the host being out of tokens (N630
   *  item 1): a line each to read, each one of the things that need them. */
  skipped: string[];
  /** Someone's model whose price changed, to keep at the new price or drop
   *  (N633 item 4), with the chat's models as kept now. */
  priceChanges: PriceChange[];
  models: RecipeModel[];
};

const NONE: HostWork = { ring: false, lines: [], checkModel: null, ownChat: false, skipped: [], priceChanges: [], models: [] };

/** Today, as the backend's "on" writes a day (YYYY-MM-DD), on this device. */
function today(): string {
  const d = new Date();
  const two = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${two(d.getMonth() + 1)}-${two(d.getDate())}`;
}

/** How many things need the person: each line, each model left out, and
 *  each changed price. */
export function thingsNeedingYou(work: HostWork): number {
  return work.lines.length + work.skipped.length + work.priceChanges.length;
}

/** Keep someone's model at its new price, or drop it (N633 item 4): the
 *  chat's models saved with that card's price set, or without that card
 *  (PUT /v2/chats/setup/models). Then what needs the person is read again,
 *  and the line goes. False when the backend did not keep it. */
export async function answerPriceChange(change: PriceChange, keep: boolean, coach: boolean): Promise<boolean> {
  const theirs = (m: RecipeModel) => !m.own && m.model_id === change.model_id;
  const models = keep
    ? work.models.map((m) => (theirs(m) ? { ...m, price: change.now, learning: undefined } : m))
    : work.models.filter((m) => !theirs(m));
  const kept = await keepPart("models", models);
  if (!kept || "refused" in kept) return false;
  await refreshHostWork(coach);
  return true;
}
let work: HostWork = NONE;
let loading: Promise<void> | null = null;
let readOnce = false;
/** The last read counted the coach's moments (the profile says "coach" late). */
let readAsCoach = false;
const listeners = new Set<() => void>();

function publish(next: HostWork): void {
  work = next;
  listeners.forEach((listen) => listen());
}

async function momentsWaiting(): Promise<number> {
  const queue = await fetchMomentsQueue().catch(() => null);
  return queue?.ok ? queue.speakers.reduce((sum, s) => sum + Math.max(0, s.waiting || 0), 0) : 0;
}

async function read(coach: boolean): Promise<void> {
  readOnce = true;
  readAsCoach = coach;
  const setup = await readSetup();
  if (!setup) return publish(NONE);
  const own = (setup.recipe?.models ?? []).filter((m) => m.own && m.model_id).map((m) => m.model_id as string);
  const [drafts, moments, queue, checks] = await Promise.all([
    getDrafts(),
    coach ? momentsWaiting() : Promise.resolve(0),
    getQueue(),
    Promise.all(own.map((id) => getCheck(id).then((c) => (c && c.items.length && !c.done ? id : null)))),
  ]);
  const toCheck = checks.filter((id): id is string => Boolean(id));
  const counts: [WorkKind, number][] = [
    ["answers", drafts?.length ?? 0],
    ["moments", moments],
    ["examples", queue?.examples.length ?? 0],
    ["check", toCheck.length],
  ];
  publish({
    ring: true,
    lines: counts.filter(([, n]) => n > 0).map(([kind, n]) => ({ kind, n })),
    checkModel: toCheck[0] ?? null,
    ownChat: Boolean(setup.own_chat),
    skipped: setup.skipped_models.filter((m) => m.on.slice(0, 10) === today()).map((m) => m.by),
    priceChanges: setup.price_changes,
    models: setup.recipe?.models ?? [],
  });
}

/** Read what needs the person again (after work is done, or on mount). */
export function refreshHostWork(coach: boolean): Promise<void> {
  loading = read(coach).catch(() => undefined).finally(() => {
    loading = null;
  });
  return loading;
}

function subscribe(listen: () => void): () => void {
  listeners.add(listen);
  return () => listeners.delete(listen);
}

/** What needs the person; read once per mount of the first reader. */
export function useHostWork(coach: boolean): HostWork {
  useEffect(() => {
    if (!loading && (!readOnce || (coach && !readAsCoach))) void refreshHostWork(coach);
  }, [coach]);
  return useSyncExternalStore(subscribe, () => work, () => NONE);
}

/** For tests: forget what was read. */
export function forgetHostWork(): void {
  work = NONE;
  loading = null;
  readOnce = false;
  readAsCoach = false;
}
