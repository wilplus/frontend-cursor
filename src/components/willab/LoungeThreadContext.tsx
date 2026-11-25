"use client";

import { createContext, useContext } from "react";
import {
  useLoungeThread,
  type UseLoungeThreadReturn,
} from "./useLoungeThread";
import LoadingState from "./LoadingState";
import { useSignedIn } from "./useSignedIn";
import { useUserId } from "./useUserId";

/* -------------------------------------------------------------------------- */
/*  LoungeThreadContext — one thread, shared by the Lounge AND the Lab          */
/*                                                                            */
/*  The Lounge owns the persistent chat history (§3), but the Lab needs to     */
/*  write into that same history too — so a completed recording's Readout       */
/*  (and the coach's later Insights) persist as durable, scrollable entries     */
/*  the user can return to (§3.x reports-in-history). Hoisting the thread into  */
/*  a context lets both surfaces share the one store (and its optimistic        */
/*  append) instead of each mounting its own. Gates on auth resolution so the   */
/*  underlying useLoungeThread sees a stable `signedIn`.                        */
/* -------------------------------------------------------------------------- */

const LoungeThreadCtx = createContext<UseLoungeThreadReturn | null>(null);

export function useLoungeThreadCtx(): UseLoungeThreadReturn {
  const ctx = useContext(LoungeThreadCtx);
  if (!ctx) {
    throw new Error("useLoungeThreadCtx must be used within <LoungeThreadProvider>");
  }
  return ctx;
}

/** The thread when there is one; null outside the provider (a page that
 *  shows the walk without the Lounge). */
export function useLoungeThreadMaybe(): UseLoungeThreadReturn | null {
  return useContext(LoungeThreadCtx);
}

/** `signedIn`: the parent's answer when it already has one, so the thread
 *  mounts at once instead of waiting a tick behind a full-screen loader. */
export function LoungeThreadProvider({
  children,
  signedIn: known = null,
  room = null,
}: {
  children: React.ReactNode;
  signedIn?: boolean | null;
  room?: string | null;
}) {
  const own = useSignedIn();
  const signedIn = known ?? own;
  const userId = useUserId();
  if (signedIn === null) {
    return <LoadingState placement="surface" />;
  }
  const owner = signedIn ? userId : "guest";
  return <LoungeThreadInner key={owner} owner={owner} signedIn={signedIn} room={room}>{children}</LoungeThreadInner>;
}

function LoungeThreadInner({
  signedIn,
  owner,
  room,
  children,
}: {
  signedIn: boolean;
  owner: string | null;
  room: string | null;
  children: React.ReactNode;
}) {
  // A host's chat that takes Takes reads its own rows (N648 item 8).
  const thread = useLoungeThread(signedIn, room, owner);
  return (
    <LoungeThreadCtx.Provider value={thread}>{children}</LoungeThreadCtx.Provider>
  );
}
