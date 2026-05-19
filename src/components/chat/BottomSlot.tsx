"use client";

import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

/* -------------------------------------------------------------------------- */
/*  BottomSlot — pinned single-slot container for the chat's bottom region    */
/*                                                                            */
/*  Wrap exactly ONE actionable component (from src/components/chat/slots/)  */
/*  in this. The container handles:                                          */
/*    - shrink-0 + safe-area-inset-bottom (won't get eaten by mobile         */
/*      home indicators)                                                     */
/*    - top border + subtle top shadow so the slot reads as anchored        */
/*    - max-w-md mx-auto for consistent column width across the chat        */
/*                                                                            */
/*  The single-slot rule is enforced by convention: the `children` slot     */
/*  takes ONE actionable component. Don't drop two side-by-side here —    */
/*  if the surface needs two answer modes, that's a separate spec       */
/*  decision (the spec rejects it: pick one mode per question).            */
/* -------------------------------------------------------------------------- */

export interface BottomSlotProps {
  children: ReactNode;
  /** Disable the slot visually (greyed) without unmounting. Useful when
   *  another bubble (e.g. TrialRecordingBubble) is the active prompt and
   *  the bottom slot should defer. */
  inert?: boolean;
  className?: string;
}

export function BottomSlot({ children, inert = false, className }: BottomSlotProps) {
  return (
    <div
      className={cn(
        "shrink-0 border-t border-border bg-background",
        "shadow-[0_-4px_12px_rgb(0_0_0_/_0.04)]",
        "pb-[env(safe-area-inset-bottom)]",
        inert && "pointer-events-none opacity-60",
        className
      )}
    >
      <div className="mx-auto max-w-md px-4 py-4">{children}</div>
    </div>
  );
}
