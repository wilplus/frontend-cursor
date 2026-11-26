import { createElement, type ComponentPropsWithoutRef } from "react";
import { cn } from "@/lib/utils";

/** A plain line from the app: the panel has no chat around it (backend N704). */
export function Bubble({ className, ...props }: ComponentPropsWithoutRef<"div">) {
  return createElement("div", {
    ...props,
    "data-bubble": "",
    className: cn("min-w-0 self-start whitespace-pre-wrap break-words rounded-2xl bg-muted px-4 py-3 text-[16px] leading-relaxed text-foreground", className),
  });
}

export function choiceBubble(selected: boolean) {
  return cn(
    "min-h-11 max-w-full break-words rounded-full border-[1.5px] border-primary px-4 py-2 text-[15px] font-semibold leading-snug disabled:opacity-50",
    selected ? "bg-primary text-primary-foreground" : "bg-background text-primary",
  );
}
