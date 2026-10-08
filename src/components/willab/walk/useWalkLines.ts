"use client";

import { useCallback, useEffect, useRef } from "react";
import { createLineTurns, type LineTurns, type SayLine, type WalkLinesIO } from "@/lib/willab/walkLines";
import type { WalkStep } from "@/lib/willab/walkPlan";

/* -------------------------------------------------------------------------- */
/*  useWalkLines — the walk's signed lines, never twice in a row across Takes  */
/*  (build plan D-FW-3; walkLines.ts).                                         */
/*                                                                            */
/*  Reads the memory as the walk mounts and again at each opening, after the  */
/*  lines already recorded have landed, so a read never hands back the line   */
/*  just said. Each line screen on screen is recorded once. Nothing waits on  */
/*  a call: a screen draws its line at once (walk lock: nothing blinks).      */
/* -------------------------------------------------------------------------- */

export type WalkLines = {
  say: SayLine;
  /** A new opening of the walk (its request's seq). */
  reopen: () => void;
  /** `step` is on screen: record the lines it took. */
  onScreen: (step: WalkStep) => void;
};

export function useWalkLines(io: WalkLinesIO | null): WalkLines {
  const turnsRef = useRef<LineTurns | null>(null);
  if (turnsRef.current === null) turnsRef.current = createLineTurns();
  const turns = turnsRef.current;
  const ioRef = useRef(io);
  ioRef.current = io;
  const pending = useRef(new Set<Promise<void>>());

  const read = useCallback(() => {
    const calls = ioRef.current;
    if (!calls) return;
    const landed = Promise.allSettled([...pending.current]);
    void landed
      .then(() => calls.next())
      .then((next) => {
        if (next) turns.adopt(next);
      })
      .catch(() => undefined);
  }, [turns]);

  const hasIO = io !== null;
  useEffect(() => {
    if (hasIO) read();
  }, [hasIO, read]);

  const reopen = useCallback(() => {
    turns.reopen();
    read();
  }, [turns, read]);

  const onScreen = useCallback(
    (step: WalkStep) => {
      const calls = ioRef.current;
      for (const bank of turns.takeUnrecorded(step)) {
        if (!calls) continue;
        const call = calls.shown(bank).catch(() => undefined);
        pending.current.add(call);
        void call.finally(() => pending.current.delete(call));
      }
    },
    [turns],
  );

  return { say: turns.say, reopen, onScreen };
}
