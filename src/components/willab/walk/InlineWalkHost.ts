"use client";

import { createContext, useContext } from "react";
import type { LoungeMessage } from "@/services/api/loungeMessages";

export const PROJECT_SPEAKER_BUBBLE = "bg-[#f8f1ea] text-foreground dark:bg-[#3c3028]";

/** The project thread owns scrolling and the composer when it hosts a walk. */
export const InlineWalkHost = createContext<{
  recordingDock: HTMLDivElement | null;
  savedSteps: readonly LoungeMessage[];
  conversation?: boolean;
} | null>(null);

export function useInlineWalkHost() {
  return useContext(InlineWalkHost);
}

export function scrollWithinProject(node: HTMLElement | null | undefined): void {
  const viewport = node?.closest<HTMLElement>("[data-project-scroll], [data-thread]");
  if (!node || !viewport) return;
  viewport.scrollTop += node.getBoundingClientRect().top - viewport.getBoundingClientRect().top - 12;
}
