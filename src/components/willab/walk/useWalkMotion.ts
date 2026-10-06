"use client";

import { useEffect, useRef, useState } from "react";
import {
  WALK_LEAVE_MS,
  isOverlay,
  leavesCopy,
  moveFor,
  walkSig,
  type WalkDir,
  type WalkMove,
  type WalkScreen,
} from "@/lib/willab/walkMotion";

/* -------------------------------------------------------------------------- */
/*  useWalkMotion — which move is playing, and what is leaving                  */
/*                                                                            */
/*  Each new screen (a new signature, walkSig) gets a new layer id, so its     */
/*  layer remounts and its arrive-animation plays once; the screen it         */
/*  replaced is kept for WALK_LEAVE_MS so its copy can play the out-move,      */
/*  exactly as the prototype's ghost(). A redraw of the same screen keeps the  */
/*  id: nothing moves. Reduce motion is CSS's job (the copy is hidden and     */
/*  every move is instant), so this hook behaves the same either way.          */
/* -------------------------------------------------------------------------- */

export type WalkLeaving<S extends WalkScreen> = { screen: S; id: number; move: WalkMove };

type View<S extends WalkScreen> = {
  sig: string;
  id: number;
  move: WalkMove;
  leaving: WalkLeaving<S> | null;
};

const sigOf = (screen: WalkScreen) => `${walkSig(screen)}:${isOverlay(screen) ? "ov" : "page"}`;

export function useWalkMotion<S extends WalkScreen>(screen: S, dir?: WalkDir) {
  const sig = sigOf(screen);
  const last = useRef<S>(screen);
  const [view, setView] = useState<View<S>>(() => ({ sig, id: 0, move: "none", leaving: null }));

  let current = view;
  if (view.sig !== sig) {
    // A new screen: decide the move now, during render, so the very first
    // paint of the new layer already carries its class (no blink).
    const prev = last.current;
    const move = moveFor(prev, screen, dir);
    const leaving = leavesCopy(move) && isOverlay(prev) ? { screen: prev, id: view.id, move } : null;
    current = { sig, id: view.id + 1, move, leaving };
    setView(current);
  }

  useEffect(() => {
    last.current = screen;
  });

  const leavingId = current.leaving ? current.id : null;
  useEffect(() => {
    if (leavingId === null) return;
    const timer = window.setTimeout(
      () => setView((v) => (v.id === leavingId ? { ...v, leaving: null } : v)),
      WALK_LEAVE_MS,
    );
    return () => window.clearTimeout(timer);
  }, [leavingId]);

  return { screen, id: current.id, move: current.move, leaving: current.leaving };
}
