"use client";

import { createContext, useContext } from "react";
import {
  useLoungeThread,
  type UseLoungeThreadReturn,
} from "./useLoungeThread";
import LoadingState from "./LoadingState";
import { useSignedIn } from "./useSignedIn";

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

export function LoungeThreadProvider({ children }: { children: React.ReactNode }) {
  const signedIn = useSignedIn();
  if (signedIn === null) {
    return <LoadingState />;
  }
  return <LoungeThreadInner signedIn={signedIn}>{children}</LoungeThreadInner>;
}

function LoungeThreadInner({
  signedIn,
  children,
}: {
  signedIn: boolean;
  children: React.ReactNode;
}) {
  const thread = useLoungeThread(signedIn);
  return (
    <LoungeThreadCtx.Provider value={thread}>{children}</LoungeThreadCtx.Provider>
  );
}
