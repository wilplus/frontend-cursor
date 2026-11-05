"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Check } from "lucide-react";
import { CHUNK_SHEET_COPY as COPY } from "./idealEditCopy";
import WalkOverlay from "./walk/WalkOverlay";
import WalkFooter from "./walk/WalkFooter";
import WalkMessage from "./walk/WalkMessage";
import { LetterCircle } from "./chats/ChatList";
import { NOT_NOW } from "@/lib/willab/leaveWords";
import { closeTakeMatch, getTakeMatch, sendTakeMatch, type MatchOffer } from "@/services/api/takeMatches";

/* -------------------------------------------------------------------------- */
/*  After a Take, once, when someone new fits it (backend N476 item 2, N477,  */
/*  N478 item 1, N512; #1712): the page that picks who a Take goes to, once   */
/*  more, with that one person, by pseudonym and role, never a name.          */
/*                                                                            */
/*    It waits for the walk to end and never stands between a Take and its   */
/*    Ideal Text (Never 3): it opens only while no walk screen is up.         */
/*    Send: the Take reaches them as an asking chat (N485); they show in my   */
/*    chats only once they answer (N486 item 1). Not now closes it; nobody is */
/*    told. ✕ changes nothing. Asked once per Take on this device.            */
/*                                                                            */
/*  Off until the backend's `take_match` ring is on: no suggestion comes.     */
/* -------------------------------------------------------------------------- */

/** Signed with N512 item 3 (Never 4). */
export const MATCH_COPY = {
  lead: "Someone new might be a good match for this Take.",
  why: (pseudonym: string) => `${pseudonym} works on what you're practising. You could learn from each other. Send it to them too?`,
  notInChats: "Not in your chats yet",
  send: "Send",
} as const;

const SEEN = "willab.takeMatchSeen";
const WAIT_MS = 1500;

function seen(take: string): boolean {
  try {
    return (JSON.parse(localStorage.getItem(SEEN) ?? "[]") as string[]).includes(take);
  } catch {
    return false;
  }
}

function markSeen(take: string): void {
  try {
    const list = (JSON.parse(localStorage.getItem(SEEN) ?? "[]") as string[]).filter((t) => t !== take);
    localStorage.setItem(SEEN, JSON.stringify([...list, take].slice(-50)));
  } catch {
    // Asked again next time, no harm.
  }
}

/** No walk screen is up: the suggestion may open. */
const walkIsUp = () => typeof document !== "undefined" && !!document.querySelector("[data-walk-column]");

export default function TakeMatchSuggestion({ takeSessionId, takeCount = null }: { takeSessionId: string; takeCount?: number | null }) {
  const [offer, setOffer] = useState<MatchOffer | null>(null);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (seen(takeSessionId)) return;
    let live = true;
    let timer: number | null = null;
    void getTakeMatch(takeSessionId).then((found) => {
      if (!live || !found) return;
      setOffer(found);
      const tryOpen = () => {
        if (!live) return;
        if (walkIsUp()) timer = window.setTimeout(tryOpen, WAIT_MS);
        else setOpen(true);
      };
      tryOpen();
    });
    return () => {
      live = false;
      if (timer !== null) window.clearTimeout(timer);
    };
  }, [takeSessionId]);

  if (!offer || !open || typeof document === "undefined") return null;

  const done = () => {
    markSeen(takeSessionId);
    setOpen(false);
  };
  const send = async () => {
    if (busy) return;
    setBusy(true);
    await sendTakeMatch(offer.id);
    setBusy(false);
    done();
  };
  const notNow = async () => {
    if (busy) return;
    setBusy(true);
    await closeTakeMatch(offer.id);
    setBusy(false);
    done();
  };

  return createPortal(
    <div data-take-match="" data-walk-column className="fixed inset-0 z-[90] flex flex-col bg-background" onClick={(e) => e.stopPropagation()}>
      <WalkOverlay
        testId="take-match"
        caption={typeof takeCount === "number" && takeCount >= 1 ? `${COPY.historyTake} ${takeCount}` : null}
        onClose={done}
        footer={
          <WalkFooter
            pill={{ label: MATCH_COPY.send, onClick: () => void send(), disabled: busy, testId: "take-match-send" }}
            links={[{ label: NOT_NOW, onClick: () => void notNow(), disabled: busy, testId: "take-match-not-now" }]}
          />
        }
      >
        <WalkMessage>{MATCH_COPY.lead}</WalkMessage>
        <WalkMessage>{MATCH_COPY.why(offer.pseudonym)}</WalkMessage>
        <div data-walk-option={offer.id} className="walk-fill flex w-full items-center gap-3 rounded-2xl border-[1.5px] border-foreground px-3.5 py-3">
          <span aria-hidden className="flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-md bg-foreground text-background">
            <Check className="h-3.5 w-3.5" strokeWidth={3} />
          </span>
          <LetterCircle id={offer.id} name={offer.pseudonym} size={36} />
          <span className="min-w-0">
            <b className="block truncate text-[16px] font-semibold">{offer.pseudonym}</b>
            {offer.role ? <small className="mt-px block truncate text-[13.5px] text-muted-foreground">{offer.role}</small> : null}
            <small className="mt-px block text-[12.5px] text-muted-foreground">{MATCH_COPY.notInChats}</small>
          </span>
        </div>
      </WalkOverlay>
    </div>,
    document.body,
  );
}
