"use client";

import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { isOverlay, type WalkDir, type WalkMove, type WalkScreen } from "@/lib/willab/walkMotion";
import { useWalkMotion } from "./useWalkMotion";

/* -------------------------------------------------------------------------- */
/*  WalkStage — the Feedback walk's screens, moving (founder lock 2026-10-06)  */
/*                                                                            */
/*  Renders the current screen in its own layer and, for a moment, a copy of   */
/*  the screen that is leaving above it, each with the move's class from       */
/*  globals.css ("feedback walk motion"). The screen itself comes from         */
/*  `render`, normally a WalkOverlay; a screen with `overlay: false` is the    */
/*  page, so the stage draws nothing for it and the overlay sinks away.        */
/*                                                                            */
/*  The stage covers the viewport but takes no pointer events of its own: only */
/*  a live layer does, never the leaving copy.                                 */
/* -------------------------------------------------------------------------- */

function arriveClass(move: WalkMove): string {
  if (move === "open") return "walk-m-open";
  if (move === "next" || move === "back" || move === "fade") return `walk-m-${move}`;
  return "";
}

function leaveClass(move: WalkMove): string {
  if (move === "close") return "walk-m-close";
  return `walk-m-swap walk-m-${move}`;
}

export default function WalkStage<S extends WalkScreen>({
  screen,
  dir,
  render,
  className,
}: {
  screen: S;
  /** The direction of the step that produced `screen`. */
  dir?: WalkDir;
  render: (screen: S) => ReactNode;
  className?: string;
}) {
  const { id, move, leaving } = useWalkMotion(screen, dir);
  return (
    <div
      data-walk-stage
      className={cn("walk-stage pointer-events-none fixed inset-0 z-50 overflow-hidden", className)}
    >
      {isOverlay(screen) ? (
        <div key={`layer-${id}`} data-walk-move={move} className={cn("walk-layer", arriveClass(move))}>
          {render(screen)}
        </div>
      ) : null}
      {leaving ? (
        <div
          key={`ghost-${leaving.id}`}
          aria-hidden="true"
          data-walk-ghost
          className={cn("walk-layer walk-ghost", leaveClass(leaving.move))}
        >
          {render(leaving.screen)}
        </div>
      ) : null}
    </div>
  );
}
