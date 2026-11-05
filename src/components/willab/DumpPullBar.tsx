"use client";

import { useRef, useState, type ReactNode } from "react";
import { PULL_OPEN_PX, canPullDump, openDumpScreen } from "@/lib/willab/dumpScreen";

/* -------------------------------------------------------------------------- */
/*  The pull down that opens the dump screen (backend N517): it starts on the */
/*  top bar of the chat list or Will's chat. The three-dot mark follows the   */
/*  finger; let go past 90 px and the dump screen opens, short of it nothing  */
/*  happens. No words. Where no dump screen is on (another page, the ring row */
/*  off) the bar is as it was: canPullDump() is false.                        */
/* -------------------------------------------------------------------------- */

const MAX_PULL = 160;
const MENU = "#app-header-menu";

export default function DumpPullBar({ children }: { children: ReactNode }) {
  const from = useRef<{ y: number; id: number } | null>(null);
  const [pull, setPull] = useState(0);
  const moved = useRef(false);

  const end = () => {
    from.current = null;
    setPull(0);
  };

  return (
    <div
      // A vertical drag here never scrolls anything; without this iOS takes
      // the gesture for its bounce and cancels the pull.
      style={{ touchAction: "pan-x" }}
      onPointerDown={(e) => {
        if (!canPullDump() || !e.isPrimary || (e.target as HTMLElement).closest(MENU)) return;
        from.current = { y: e.clientY, id: e.pointerId };
        moved.current = false;
      }}
      onPointerMove={(e) => {
        const f = from.current;
        if (!f || e.pointerId !== f.id) return;
        const dy = Math.max(0, Math.min(e.clientY - f.y, MAX_PULL));
        if (dy > 12) moved.current = true;
        setPull(dy);
      }}
      onPointerUp={(e) => {
        const f = from.current;
        end();
        if (f && e.pointerId === f.id && e.clientY - f.y >= PULL_OPEN_PX) openDumpScreen();
      }}
      onPointerCancel={end}
      onClickCapture={(e) => {
        // A pull that ended on the logo is not a tap on it.
        if (moved.current) {
          moved.current = false;
          e.preventDefault();
          e.stopPropagation();
        }
      }}
    >
      {children}
      {pull > 12 ? <PullMark pull={pull} /> : null}
    </div>
  );
}

/** The three dots under the bar, following the finger; full once a release opens. */
function PullMark({ pull }: { pull: number }) {
  const ready = pull >= PULL_OPEN_PX;
  return (
    <div
      aria-hidden
      className="pointer-events-none fixed left-1/2 z-40 flex h-11 w-11 -translate-x-1/2 items-center justify-center rounded-full border border-border bg-background shadow-sm"
      style={{ top: 56 + pull * 0.6, opacity: Math.min(1, pull / PULL_OPEN_PX) }}
    >
      <svg width="20" height="20" viewBox="0 0 22 22" className={ready ? "text-foreground" : "text-foreground/50"}>
        <circle cx="3" cy="11" r="2.2" fill="currentColor" />
        <circle cx="11" cy="11" r="3.2" fill="currentColor" />
        <circle cx="19" cy="11" r="2.2" fill="currentColor" />
      </svg>
    </div>
  );
}
