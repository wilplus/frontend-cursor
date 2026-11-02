import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/* -------------------------------------------------------------------------- */
/*  WalkMessage — the grey bubble on the left (founder lock 2026-10-12, moment  */
/*  and feedback chat, section 1; prototype v31 `.ov.lens .lb`)                */
/*                                                                            */
/*  18.5px text, line height 1.45, 22px corners, padding 13px 17px, no bold   */
/*  anywhere in it: the step's name ("Good job", "Clearer version") is its    */
/*  first line at regular weight. No picture beside any bubble, the coach's   */
/*  included (backend N301): who wrote it shows in its words ("Your coach:"). */
/* -------------------------------------------------------------------------- */

/** The sender's picture, retired: no bubble shows one, the coach's included
 *  (backend N301; the app's went on 2026-10-14). Kept so the coach panel's
 *  places for it stay as they are; it draws nothing. */
export function WalkAvatar(_props: { coach?: boolean }): null {
  return null;
}

export default function WalkMessage({
  children,
  coach = false,
  wide = false,
  className,
}: {
  children: ReactNode;
  /** The coach's bubble, marked `data-walk-coach`. */
  coach?: boolean;
  /** The bubble takes the whole row (another speaker's clip, a video). */
  wide?: boolean;
  /** A move of the row's own (the AI bubble landing after the typing dots). */
  className?: string;
}) {
  return (
    <div
      data-walk-message
      data-row="app"
      data-walk-coach={coach ? "true" : undefined}
      className={cn("flex items-end gap-[7px] text-[18.5px] leading-[1.45] text-foreground", wide ? "max-w-full" : "max-w-[94%]", className)}
    >
      <div data-bubble="" className={cn("flex min-w-0 flex-col rounded-[22px] bg-muted px-[17px] py-[13px] font-normal", wide && "flex-1")}>
        {children}
      </div>
    </div>
  );
}

/** The new words inside a message (the clearer version): 600, and the
 *  changed words in orange — the only orange in the bubble. Mark the changed
 *  words with <em>. */
export function WalkNewWords({ children }: { children: ReactNode }) {
  return (
    <span data-walk-new-words className="block [&_em]:not-italic [&_em]:text-primary">
      {children}
    </span>
  );
}
