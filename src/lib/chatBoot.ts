/* -------------------------------------------------------------------------- */
/*  chatBoot — "the Lounge thread has painted", for reads that can follow it   */
/*                                                                            */
/*  A signed-in /chat open fires its boot reads together (bootPrefetch.ts):   */
/*  session state, processing authorization, the thread. Beside them the      */
/*  header's wallet, the Life panel gate, the product discoveries and the     */
/*  guest-project claim used to fire in the SAME burst, and the backend has   */
/*  two sync workers — so the chip's balance read could queue ahead of the    */
/*  thread the speaker is waiting for.                                        */
/*                                                                            */
/*  Founder 2026-10-16: the token chip and top-up card may appear after the   */
/*  thread paints; profile, discoveries and Life state may arrive after first */
/*  paint; a stale guest token may be claimed in the background. This module  */
/*  is that signal and nothing else: useWillabFlow marks a boot started where */
/*  it starts the prefetch, useLoungeThread marks it settled when the thread  */
/*  has loaded, and `afterChatBoot` runs a callback then. Outside a chat boot */
/*  (any other page, or a thread that never mounts because the Phase-1 gate   */
/*  holds) the callback runs on idle, or by SETTLE_LIMIT_MS at the latest, so */
/*  nothing waits on a thread that is not coming.                             */
/* -------------------------------------------------------------------------- */

import { useEffect, useState } from "react";

/** A boot that has not settled by then is treated as settled: a gate that
 *  blocks the thread (Phase-1 acceptance) must not hide the chip forever. */
const SETTLE_LIMIT_MS = 8_000;
/** Off a chat boot, "idle" may not come on a busy page; cap the wait. */
const IDLE_LIMIT_MS = 500;

let pending = false;
const waiters = new Set<() => void>();

/** useWillabFlow, where the chat's boot reads start. */
export function markChatBootStarted(): void {
  pending = true;
}

/** useLoungeThread, once the thread's first page is in. */
export function markChatBootSettled(): void {
  pending = false;
  const run = [...waiters];
  waiters.clear();
  for (const cb of run) cb();
}

function runOnIdle(cb: () => void): () => void {
  if (typeof window !== "undefined" && typeof window.requestIdleCallback === "function") {
    const id = window.requestIdleCallback(cb, { timeout: IDLE_LIMIT_MS });
    return () => window.cancelIdleCallback(id);
  }
  const id = setTimeout(cb, 0);
  return () => clearTimeout(id);
}

/** Run `cb` once the chat boot has settled — or on idle when no chat boot is
 *  in progress. Returns a cancel for an unmount; a cancelled callback never
 *  runs. */
export function afterChatBoot(cb: () => void): () => void {
  if (!pending) return runOnIdle(cb);
  let done = false;
  const once = () => {
    if (done) return;
    done = true;
    clearTimeout(limit);
    waiters.delete(once);
    cb();
  };
  const limit = setTimeout(once, SETTLE_LIMIT_MS);
  waiters.add(once);
  return () => {
    done = true;
    clearTimeout(limit);
    waiters.delete(once);
  };
}

/** False until the chat boot has settled (see `afterChatBoot`). */
export function useAfterChatBoot(): boolean {
  const [settled, setSettled] = useState(false);
  useEffect(() => afterChatBoot(() => setSettled(true)), []);
  return settled;
}

/** Test-only reset. */
export function __resetChatBootForTests(): void {
  pending = false;
  waiters.clear();
}
