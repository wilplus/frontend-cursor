import { cn } from "@/lib/utils";

/* -------------------------------------------------------------------------- */
/*  BetaChip — "this feature is still being tested" (founder 2026-08-05).      */
/*                                                                            */
/*  Founder: "a small thing is that you should add the beta sign to the        */
/*  principles so that users know that this feature is in the testing phase."  */
/*  Asked which scope, they answered: the WHOLE life panel.                    */
/*                                                                            */
/*  A component rather than an inline span so widening or narrowing the scope  */
/*  later is a placement decision, not a rewrite — and so every beta marker in */
/*  the app looks like every other one.                                        */
/*                                                                            */
/*  Deliberately quiet. A badge that shouts undermines the thing it labels;    */
/*  this one has to be believed rather than noticed, so it reads at the same   */
/*  weight as the nav around it.                                              */
/*                                                                            */
/*  ⚠️  "Beta" is user-facing copy — held for founder sign-off (LIVE LOOP).    */
/* -------------------------------------------------------------------------- */

export default function BetaChip({ className }: { className?: string }) {
  return (
    <span
      // Not aria-hidden: "this is unfinished" is information a screen-reader
      // user needs as much as anyone. The title carries the meaning the four
      // letters compress.
      title="This feature is in testing."
      className={cn(
        "shrink-0 rounded-full border border-border px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-muted-foreground",
        className
      )}
    >
      Beta
    </span>
  );
}
