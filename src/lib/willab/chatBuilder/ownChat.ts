/* The host's own chat on this device. Starting it, its name and its icon
   stay here. Nothing in this file calls the network. */

export const OWN_CHAT_KEY = "wlp-own-chat";
export const OWN_CHAT_EVENT = "wlp-own-chat";

export const FACE_EMOJI = ["🙂", "🎤", "⭐", "🌿"] as const;
export const FACE_COLORS = [
  { name: "Blue", color: "#244FC5" },
  { name: "Orange", color: "#FF6A14" },
  { name: "Gold", color: "#E8A317" },
  { name: "Green", color: "#1D6B3A" },
] as const;

export type ChatFace =
  | { kind: "initial" }
  | { kind: "emoji"; emoji: string }
  | { kind: "color"; color: string }
  | { kind: "photo"; url: string };

export type OwnChatRecord = {
  started: boolean;
  id: string;
  name: string;
  face: ChatFace;
};

const EMPTY: OwnChatRecord = { started: false, id: "", name: "", face: { kind: "initial" } };

function freshId(): string {
  return `own-${Math.random().toString(36).slice(2, 10)}`;
}

function emit(): void {
  if (typeof window !== "undefined") window.dispatchEvent(new Event(OWN_CHAT_EVENT));
}

export function readOwnChat(): OwnChatRecord {
  if (typeof window === "undefined") return EMPTY;
  try {
    const raw = window.localStorage.getItem(OWN_CHAT_KEY);
    if (!raw) return EMPTY;
    const got = JSON.parse(raw) as Partial<OwnChatRecord>;
    return {
      started: got.started === true,
      id: typeof got.id === "string" ? got.id : "",
      name: typeof got.name === "string" ? got.name : "",
      face: got.face?.kind ? got.face : { kind: "initial" },
    };
  } catch {
    return EMPTY;
  }
}

function write(next: OwnChatRecord): void {
  try {
    window.localStorage.setItem(OWN_CHAT_KEY, JSON.stringify(next));
  } catch {
    /* a private window keeps the last value this function returns */
  }
  emit();
}

/** The row moves to the top. A face picked earlier stays. */
export function startOwnChat(): OwnChatRecord {
  const cur = readOwnChat();
  const next = { ...cur, started: true, id: cur.id || freshId() };
  write(next);
  return next;
}

export function saveOwnFace(face: ChatFace): void {
  const cur = readOwnChat();
  write({ ...cur, id: cur.id || freshId(), face });
}

export function rememberOwnName(name: string): void {
  const cur = readOwnChat();
  const trimmed = name.trim();
  if (!cur.started || !trimmed || cur.name === trimmed) return;
  write({ ...cur, name: trimmed });
}

/** The list title: the name they gave the chat, or "Your chat". */
export function ownChatTitle(fallback = "Your chat"): string {
  const name = readOwnChat().name.trim();
  return name || fallback;
}

/** `/c/<token>` when the host already has a join link. Otherwise the same
 *  route built from this device's chat id. No request is made. */
export function publicChatHref(origin: string, id: string, serverPath?: string | null): string {
  if (serverPath && serverPath.startsWith("/c/")) return `${origin}${serverPath}`;
  return `${origin}/c/${encodeURIComponent(id || "your-chat")}`;
}

/** Copy even when the clipboard API refuses. A click has to leave the link
 *  on the clipboard without a server token. */
export async function copyText(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch { /* the page may not be allowed to use the clipboard API */ }
  try {
    const area = document.createElement("textarea");
    area.value = text;
    area.setAttribute("readonly", "");
    area.style.position = "fixed";
    area.style.opacity = "0";
    document.body.appendChild(area);
    area.select();
    const ok = document.execCommand("copy");
    area.remove();
    return ok;
  } catch {
    return false;
  }
}
