"use client";

import { useSyncExternalStore } from "react";

/* -------------------------------------------------------------------------- */
/*  Whether Will's chat is on screen, or the list (or a person's chat, or the  */
/*  loader before the list) covers it (useChatsDoor). The Lounge stays laid   */
/*  out under the list, so to the browser its last cards are on screen; their */
/*  slide previews (IdealTextCard) wait for this instead, so pdf.js and the   */
/*  decks are not fetched while the person looks at the list. Where nothing   */
/*  covers it (signed out, any other page), it is on screen.                  */
/* -------------------------------------------------------------------------- */

let covered = false;
const listeners = new Set<() => void>();

/** useChatsDoor, whenever what is in front of the Lounge changes. */
export function setWillChatCovered(next: boolean): void {
  if (covered === next) return;
  covered = next;
  for (const listener of [...listeners]) listener();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

const coveredNow = () => covered;
const coveredOnServer = () => false;

/** False while the list, a person's chat or the loader covers Will's chat. */
export function useWillChatInView(): boolean {
  return !useSyncExternalStore(subscribe, coveredNow, coveredOnServer);
}
