import { Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { WalkLink, WalkPill, type WalkAction } from "./WalkFooter";

/* -------------------------------------------------------------------------- */
/*  WalkEndSheet — the end of the walk (founder lock 2026-10-06): the page     */
/*  dims and the card rises with "Record Take N" and "Back to the text";      */
/*  leaving, the card sinks and the dim fades (`leaving` plays that, then the  */
/*  host removes it).                                                          */
/* -------------------------------------------------------------------------- */

export default function WalkEndSheet({
  pill,
  link,
  leaving = false,
}: {
  pill: WalkAction;
  link: WalkAction;
  leaving?: boolean;
}) {
  return (
    <>
      <div aria-hidden="true" className={cn("walk-dim fixed inset-0 z-[51] bg-foreground/30", leaving && "walk-ghost")} />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={pill.label}
        data-walk-endsheet
        className={cn(
          "walk-endsheet fixed inset-x-0 bottom-0 z-[52] flex flex-col items-center gap-3.5 rounded-t-[26px] bg-background px-5 pb-[max(30px,env(safe-area-inset-bottom))] pt-[26px] shadow-[0_-10px_30px_rgba(0,0,0,0.18)]",
          leaving && "walk-ghost",
        )}
      >
        <div aria-hidden="true" className="flex h-14 w-14 items-center justify-center rounded-full bg-affirm/10 text-affirm">
          <Check className="h-7 w-7" />
        </div>
        <WalkPill action={pill} dot />
        <WalkLink action={link} />
      </div>
    </>
  );
}
