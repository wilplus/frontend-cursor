import { useSyncExternalStore, type ReactNode } from "react";
import type { LoungeMessage } from "@/services/api/loungeMessages";

/* -------------------------------------------------------------------------- */
/*  Three chats over the one Lounge thread (backend N635, N636 items 1 to 5), */
/*  for whoever has the ring row `chat_builder`: Will (the model, the chat's  */
/*  setup, what needs you), the speaking chat ("Speaking coach": the Takes    */
/*  and the record button) and "Principles". Nothing is stored differently:   */
/*  each row carries the place the backend gives it, and each chat draws only */
/*  its own. The door says which one is open; the Lounge reads it here.       */
/*  Without the ring there is no place: one chat, as it was.                  */
/* -------------------------------------------------------------------------- */

export type LoungePlace = "will" | "speaking" | "principles";
export const PLACES: readonly LoungePlace[] = ["will", "speaking", "principles"];

/** The rows' titles: Will's own, and the founder's two (N636 item 1). */
export const PLACE_TITLES: Record<LoungePlace, string> = { will: "Will", speaking: "Speaking coach", principles: "Principles" };

type Placed = Pick<LoungeMessage, "metadata"> & { place?: unknown; client_id?: string };

/** Rows this app has just written, until the backend's copy (with its
 *  place) is read: the chat they were written in. */
const written = new Map<string, LoungePlace>();

/** A row written in the open chat keeps to it until the backend says. */
export function rememberPlace(clientId: string, place: LoungePlace | null): void {
  if (place) written.set(clientId, place);
}

/** The place the backend gives a row (top-level `place`, every message of
 *  GET /v2/user/lounge/messages, backend #1926); else where it was just
 *  written; null when neither. */
export function placeOf(message: Placed): LoungePlace | null {
  const raw = message.place ?? (message.metadata as Record<string, unknown> | null | undefined)?.place;
  if (typeof raw === "string" && (PLACES as readonly string[]).includes(raw)) return raw as LoungePlace;
  return (message.client_id && written.get(message.client_id)) || null;
}

/** Is this row one of this chat's? A row with no place is the speaking
 *  chat's: everything there was before the three chats was the speaking
 *  loop's, and a Take is never hidden (N635 item 3). */
export function inPlace(message: Placed, place: LoungePlace): boolean {
  return (placeOf(message) ?? "speaking") === place;
}

/** Drawn in the chat open now: every row without the ring (no place). */
export function shownIn(message: Placed, place: LoungePlace | null): boolean {
  return !place || inPlace(message, place);
}

/** Children only in these chats; without the ring (no place), always. */
export function PlaceOnly({ place, in: places, children }: { place: LoungePlace | null; in: readonly LoungePlace[]; children: ReactNode }) {
  return !place || places.includes(place) ? <>{children}</> : null;
}

/** Will's chat and Principles are chats in words: their bar is the text
 *  field, always (N635 item 2, N636 item 1). */
export function wordsAlways(place: LoungePlace | null): boolean {
  return place === "will" || place === "principles";
}

/** The bar's typing is off where the chat asks for none, never in a chat
 *  in words. */
export function typingOffIn(place: LoungePlace | null, off: boolean): boolean {
  return !wordsAlways(place) && off;
}

/** The text field shows when the chat asks for words, and always in a chat
 *  in words. */
export function wordsShow(place: LoungePlace | null, show: boolean): boolean {
  return show || wordsAlways(place);
}

/** The way in's links about one's own chat show on its row everywhere but
 *  the ring's speaking chat, where Will's chat has them (N636 item 3). */
export function ownChatLinksIn(place: LoungePlace | null): boolean {
  return place !== "speaking";
}

/** A row with its chat's mark added to its metadata, when there is one. */
export function withHint<T extends { metadata?: Record<string, unknown> | null }>(draft: T, hint: Record<string, unknown> | null): T {
  return hint ? { ...draft, metadata: { ...(draft.metadata ?? {}), ...hint } } : draft;
}

/** What a row typed in this chat carries, so the backend files it here:
 *  the speaking chat's Take, or a note of Principles (the "#" notebook). */
export function typedHint(place: LoungePlace | null, arcId: string | null | undefined): Record<string, unknown> | null {
  if (place === "speaking" && arcId) return { arc_id: arcId };
  if (place === "principles") return { offer: "voice_notebook" };
  return null;
}

let open: LoungePlace | null = null;
const listeners = new Set<() => void>();

/** The door: which of the three chats is open (null: none, or no ring). */
export function setOpenPlace(place: LoungePlace | null): void {
  if (open === place) return;
  open = place;
  listeners.forEach((listen) => listen());
}

function subscribe(listen: () => void): () => void {
  listeners.add(listen);
  return () => listeners.delete(listen);
}

/** The chat the Lounge is drawn as now; null: as it was. */
export function useOpenPlace(): LoungePlace | null {
  return useSyncExternalStore(subscribe, () => open, () => null);
}
