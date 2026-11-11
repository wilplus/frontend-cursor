import { useSyncExternalStore, type ReactNode } from "react";
import type { LoungeMessage } from "@/services/api/loungeMessages";
import { TYPE_YOUR_ANSWER } from "../WillQuestion";

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

/** The host's chat a row belongs to: place "chat" with its `chat_id`
 *  (backend N648 item 8, a Take made in a host's chat that takes Takes);
 *  null for every other row. */
export function chatOfRow(message: Placed): string | null {
  const row = message as Placed & { chat_id?: unknown };
  const meta = (message.metadata ?? {}) as Record<string, unknown>;
  const place = row.place ?? meta.place;
  if (place !== "chat") return null;
  const id = row.chat_id ?? meta.chat_id;
  return typeof id === "string" ? id : "";
}

/** Is this row one of this chat's? A row with no place is the speaking
 *  chat's: everything there was before the three chats was the speaking
 *  loop's, and a Take is never hidden (N635 item 3). A host's chat's row
 *  is never Will's, the speaking chat's or Principles'. */
export function inPlace(message: Placed, place: LoungePlace): boolean {
  if (chatOfRow(message) !== null) return false;
  return (placeOf(message) ?? "speaking") === place;
}

/** Drawn in the chat open now: every row without the ring (no place); in
 *  a host's chat that takes Takes (`chat`), every row read for it, since
 *  the read itself is that chat's (?chat=, N648 item 8). */
export function shownIn(message: Placed, place: LoungePlace | null, chat: string | null = null): boolean {
  const own = chatOfRow(message);
  if (chat) return own === null || own === chat;
  if (own !== null) return false;
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

/** What a row typed in this chat carries, so the backend files it here
 *  (it reads metadata.place before anything else, backend #1933); in the
 *  speaking chat, the Take it is about. Never an `offer`: a row with one is
 *  drawn as Will's offer, never as one's own words. */
export function typedHint(place: LoungePlace | null, arcId: string | null | undefined, chat: string | null = null): Record<string, unknown> | null {
  if (!place) return null;
  const here = chat ? { chat } : {};
  if (place === "speaking" && arcId) return { place, arc_id: arcId, ...here };
  return { place, ...here };
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

/* A host's chat that takes Takes (backend N648 item 8): the Lounge is drawn
 * as the speaking chat, its rows read for that chat alone (?chat=). */
let openChat: string | null = null;
let openChatName = "";
const chatListeners = new Set<() => void>();

/** The door: the host's chat the Lounge is drawn for (null: none), and its
 *  name, for the chat's own messages drawn there. */
export function setOpenChat(chat: string | null, name = ""): void {
  if (openChat === chat && openChatName === name) return;
  openChat = chat;
  openChatName = chat ? name : "";
  chatListeners.forEach((listen) => listen());
}

/** The open host's chat's name ("" with none). */
export function useOpenChatName(): string {
  return useSyncExternalStore(subscribeChat, () => openChatName, () => "");
}

function subscribeChat(listen: () => void): () => void {
  chatListeners.add(listen);
  return () => chatListeners.delete(listen);
}

/** The host's chat whose Takes the Lounge draws now; null: none. */
export function useOpenChat(): string | null {
  return useSyncExternalStore(subscribeChat, () => openChat, () => null);
}

const askedThread = new Set<() => void>();

/** From a host's chat that takes Takes: open the chat as it is today, with
 *  its bar, its answers and its "+" (N648 item 8); Back comes back here. */
export function askForChatThread(): void {
  askedThread.forEach((open) => open());
}

/** The door's ear for askForChatThread; returns the unsubscribe. */
export function onAskedChatThread(open: () => void): () => void {
  askedThread.add(open);
  return () => askedThread.delete(open);
}

/** The same, read once (a recording just made, N648 item 8). */
export function openChatNow(): string | null {
  return openChat;
}

/** Principles' opening line, above everything in that chat, and its line
 *  in the list until something else is written there (backend N640). */
export const PRINCIPLES_OPENING = "This is where your principles live. Write what's on your mind, and I'll keep it.";

/** Will's line at the top of Principles; nothing in any other chat. */
export function PlaceOpening({ place }: { place: LoungePlace | null }) {
  if (place !== "principles") return null;
  return (
    <div data-row="app" data-place-opening="" className="mr-auto max-w-[88%] whitespace-pre-wrap break-words rounded-[16px] bg-muted px-3 py-2 text-left text-[15px] leading-[1.45] text-foreground">
      {PRINCIPLES_OPENING}
    </div>
  );
}

/** The empty Lounge's hello is the speaking loop's: Principles opens with
 *  its own line instead (backend N640). */
export function emptyHelloIn(place: LoungePlace | null, threadEmpty: boolean): boolean {
  return threadEmpty && place !== "principles";
}

/** The text field's words (backend N640): "Message Will" in Will's chat,
 *  "Write here" in Principles; else the field's own, "Type your answer"
 *  (the speaking chat's, and everyone's without the ring). */
export function placeholderIn(place: LoungePlace | null): string {
  if (place === "will") return "Message Will";
  if (place === "principles") return "Write here";
  return TYPE_YOUR_ANSWER;
}

const asked = new Set<(place: LoungePlace) => void>();

/** Open this chat now: the door listens (useChatsDoor). */
export function askForPlace(place: LoungePlace): void {
  asked.forEach((open) => open(place));
}

/** The door's ear for askForPlace; returns the unsubscribe. */
export function onAskedPlace(open: (place: LoungePlace) => void): () => void {
  asked.add(open);
  return () => asked.delete(open);
}

/** The plan rows' taps whose sheets are the speaking chat's (plan.sheets,
 *  the booking dock): from Will's chat or Principles they open the speaking
 *  chat first, so the tap never looks dead (N636 item 2). */
export function speakingFirst<T extends { onSeePlan: () => void; onChangePlan: () => void; onBook: (...a: never[]) => void }>(
  rows: T | undefined,
  place: LoungePlace | null,
): T | undefined {
  if (!rows || !place || place === "speaking") return rows;
  const first = <A extends unknown[]>(tap: (...a: A) => void) => (...a: A) => {
    askForPlace("speaking");
    tap(...a);
  };
  return { ...rows, onSeePlan: first(rows.onSeePlan), onChangePlan: first(rows.onChangePlan), onBook: first(rows.onBook) };
}
