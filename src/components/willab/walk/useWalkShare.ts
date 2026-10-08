"use client";

import { useCallback, useRef, useState } from "react";
import { WALK_COPY } from "../idealEditCopy";
import type { WalkStep } from "@/lib/willab/walkPlan";
import {
  EMPTY_SHARE_FIELDS,
  newShareMemo,
  runShare,
  shareReady,
  type ShareFields,
  type ShareIO,
  type ShareRefusal,
} from "@/lib/willab/walkShare";

/* -------------------------------------------------------------------------- */
/*  The sharing step of the walk, live (build plan D-FW-20; founder lock       */
/*  2026-10-06, flow 11; CM2 B, WQ5 A, WQ6 A, Q-B6 A, S-B6 A).                 */
/*                                                                            */
/*    tick      the ticks ("None" stands alone, WalkOptions).                 */
/*    field     a pass code or a community's name.                            */
/*    submit    Continue: the choice goes to the server (walkShare.runShare), */
/*              the walk waits for it, then moves on to the end card. A       */
/*              refusal stays on the screen with its signed message in the    */
/*              walk's toast (WQ6 A); ✕ always goes on without sharing.       */
/*                                                                            */
/*  A guest's tick or Continue opens sign-up and writes nothing (N32.5).     */
/* -------------------------------------------------------------------------- */

const REFUSAL_WORDS: Record<ShareRefusal, string> = {
  passCodeTaken: WALK_COPY.sharePassCodeTaken,
  passCodeUnknown: WALK_COPY.sharePassCodeUnknown,
  acceptTerms: WALK_COPY.shareAcceptTerms,
  failed: WALK_COPY.shareFailed,
};

export type WalkShare = {
  ticks: string[];
  fields: ShareFields;
  ready: boolean;
  busy: boolean;
  toast: { seq: number; text: string } | null;
  clearToast: () => void;
  tick: (step: WalkStep, next: string[]) => void;
  field: (step: WalkStep, name: keyof ShareFields, value: string) => void;
  submit: (step: WalkStep) => void;
  reset: () => void;
};

export function useWalkShare(args: {
  io: ShareIO | null;
  blocked: (step: WalkStep) => boolean;
  forward: () => void;
}): WalkShare {
  const live = useRef(args);
  live.current = args;
  const [ticks, setTicks] = useState<string[]>([]);
  const [fields, setFields] = useState<ShareFields>(EMPTY_SHARE_FIELDS);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<{ seq: number; text: string } | null>(null);
  const memo = useRef(newShareMemo());
  const busyRef = useRef(false);
  const generation = useRef(0);
  const state = useRef({ ticks, fields });
  state.current = { ticks, fields };

  const tick = useCallback((step: WalkStep, next: string[]) => {
    if (live.current.blocked(step)) return;
    setTicks(next);
  }, []);

  const field = useCallback((step: WalkStep, name: keyof ShareFields, value: string) => {
    if (live.current.blocked(step)) return;
    setFields((f) => ({ ...f, [name]: value }));
  }, []);

  const submit = useCallback((step: WalkStep) => {
    const { io, blocked } = live.current;
    if (busyRef.current || blocked(step)) return;
    const { ticks: chosen, fields: typed } = state.current;
    if (!shareReady(chosen, typed)) return;
    if (!io) {
      live.current.forward();
      return;
    }
    busyRef.current = true;
    setBusy(true);
    const mine = generation.current;
    void runShare(io, chosen, typed, memo.current)
      .catch(() => ({ ok: false as const, refusal: "failed" as const }))
      .then((result) => {
        if (mine !== generation.current) return;
        busyRef.current = false;
        setBusy(false);
        if (result.ok) {
          setToast(null);
          live.current.forward();
          return;
        }
        setToast((t) => ({ seq: (t?.seq ?? 0) + 1, text: REFUSAL_WORDS[result.refusal] }));
      });
  }, []);

  const reset = useCallback(() => {
    generation.current += 1;
    busyRef.current = false;
    memo.current = newShareMemo();
    setTicks([]);
    setFields(EMPTY_SHARE_FIELDS);
    setBusy(false);
    setToast(null);
  }, []);

  return {
    ticks,
    fields,
    ready: shareReady(ticks, fields),
    busy,
    toast,
    clearToast: useCallback(() => setToast(null), []),
    tick,
    field,
    submit,
    reset,
  };
}
