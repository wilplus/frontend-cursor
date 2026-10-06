"use client";

import { useEffect, useRef } from "react";
import { WALK_TOAST_MS } from "@/lib/willab/walkMotion";

/* -------------------------------------------------------------------------- */
/*  WalkToast — the small toast an answer moves on with (founder lock          */
/*  2026-10-06). It rises in, stays, and fades (walk-toast in globals.css);   */
/*  onDone fires when its time is up, so with reduce motion — where it stands */
/*  still instead of fading — it still goes.                                  */
/* -------------------------------------------------------------------------- */

export default function WalkToast({
  message,
  onDone,
  ms = WALK_TOAST_MS,
}: {
  message: string;
  onDone?: () => void;
  ms?: number;
}) {
  const done = useRef(onDone);
  done.current = onDone;
  useEffect(() => {
    const timer = window.setTimeout(() => done.current?.(), ms);
    return () => window.clearTimeout(timer);
  }, [message, ms]);
  return (
    <div
      role="status"
      data-walk-toast
      className="walk-toast pointer-events-none fixed bottom-[110px] left-1/2 z-[60] -translate-x-1/2 whitespace-nowrap rounded-full bg-foreground px-4 py-2 text-[14px] text-background shadow-[0_6px_16px_rgba(0,0,0,0.3)]"
    >
      {message}
    </div>
  );
}
