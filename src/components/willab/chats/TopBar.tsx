"use client";

import type { ReactNode } from "react";
import { ChevronLeft } from "lucide-react";
import { CHUNK_SHEET_COPY } from "@/components/willab/idealEditCopy";
import { useBackDismiss } from "@/components/willab/useBackDismiss";
import { WILL_ROW_TITLE, WillMark } from "./ChatList";
import { PLACE_TITLES, type LoungePlace } from "./loungePlace";

/* -------------------------------------------------------------------------- */
/*  The chats' top bars, apart from the chat itself (ChatThread.tsx): Will's   */
/*  is drawn on first paint when a link opens on his chat, while a person's   */
/*  chat loads only once one is opened (useChatsDoor).                        */
/* -------------------------------------------------------------------------- */

/** Will's chat, under the WillpowerLab bar: back, then his name (N322 item 4). */
/** Every chat's own top bar, full width, where the WillpowerLab bar was
 *  (backend N321 item 1, N334): back, the circle, the name, and who they are.
 *  The coach's queue wears it too, opened from its row in the list (N525). */
export function TopBar({
  circle,
  title,
  subtitle = null,
  onBack,
  onOpen = null,
  right = null,
}: {
  circle: ReactNode;
  title: string;
  subtitle?: string | null;
  onBack: () => void;
  /** On the right: one's own chat's Live · Build switch (backend N642 item 3). */
  right?: ReactNode;
  /** A person's chat: their circle and name open their profile (N366). */
  onOpen?: (() => void) | null;
}) {
  const who = (
    <>
      {circle}
      <span className="flex min-w-0 flex-col text-left">
        <span data-chat-name className="truncate text-[16px] font-semibold leading-tight text-foreground">
          {title}
        </span>
        {subtitle ? <span className="truncate text-[12.5px] leading-tight text-muted-foreground">{subtitle}</span> : null}
      </span>
    </>
  );
  return (
    <div
      data-chat-header
      className="box-content flex h-[60px] shrink-0 items-center gap-1 border-b border-border pl-1 pr-4 pt-[env(safe-area-inset-top)]"
    >
      <button
        type="button"
        onClick={onBack}
        aria-label={CHUNK_SHEET_COPY.pagerBack}
        className="walk-press-sm flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-foreground"
      >
        <ChevronLeft className="h-6 w-6" aria-hidden />
      </button>
      {onOpen ? (
        <button type="button" data-chat-who="" onClick={onOpen} className="flex min-w-0 items-center gap-2.5">
          {who}
        </button>
      ) : (
        <span className="flex min-w-0 items-center gap-2.5">{who}</span>
      )}
      {right ? <span className="ml-auto shrink-0 pl-2">{right}</span> : null}
    </div>
  );
}

/** Will's chat's top bar, over the Lounge: his mark and his name; the
 *  WillpowerLab bar is on the list only (backend N334 item 1). It spans the
 *  Lounge's column, across its side padding. */
export function WillTopBar({ onBack, place = "will", build = null }: {
  onBack: () => void;
  place?: LoungePlace;
  /** The ring's own chat: Build and Live in this bar's place (backend N642
   *  item 3). The phone's Back stays this bar's across the three chats. */
  build?: ReactNode;
}) {
  // The device's Back (the iPhone's swipe) is this bar's back: one step, to
  // the list, as in a person's chat (N378).
  useBackDismiss(onBack);
  if (build) return <>{build}</>;
  return (
    <div className="-mx-4">
      <TopBar circle={<WillMark size={36} />} title={place === "will" ? WILL_ROW_TITLE : PLACE_TITLES[place]} onBack={onBack} />
    </div>
  );
}
