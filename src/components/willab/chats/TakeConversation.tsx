"use client";

import { useCallback, useContext, useEffect, useId, useRef, useState, type ReactNode } from "react";
import { ChevronRight, MessagesSquare } from "lucide-react";
import { WILLAB_CONTENT_RAIL } from "@/lib/willab/layout";
import { cn } from "@/lib/utils";
import { PROJECT_SPEAKER_BUBBLE } from "../walk/InlineWalkHost";
import { ChatArtifactScope } from "./ChatArtifact";

/** The preview occupies the Take's position in the same scroll as its messages. */
export function TakeConversation({ title, preview, expanded, showPreview = true, onExpandedChange, children }: {
  title: string;
  preview?: string | null;
  expanded?: boolean;
  showPreview?: boolean;
  onExpandedChange?: (open: boolean) => void;
  children: ReactNode;
}) {
  const scope = useContext(ChatArtifactScope);
  const [openedIn, setOpenedIn] = useState<string | null>(null);
  useEffect(() => { setOpenedIn(null); }, [scope]);
  const open = expanded ?? openedIn === scope;
  const id = useId();
  const body = useRef<HTMLDivElement | null>(null);
  const stopMedia = useCallback(() => {
    body.current?.querySelectorAll<HTMLMediaElement>("audio, video").forEach((player) => {
      if (!player.paused) player.pause();
    });
  }, []);
  const setBody = useCallback((element: HTMLDivElement | null) => {
    if (!element) stopMedia();
    body.current = element;
  }, [stopMedia]);

  function change() {
    if (open) stopMedia();
    if (expanded === undefined) setOpenedIn(open ? null : scope);
    onExpandedChange?.(!open);
  }

  return <section data-take-conversation className="flex w-full min-w-0 flex-col gap-2" aria-label={title}>
    {!open || showPreview ? <div className={WILLAB_CONTENT_RAIL}>
      <button type="button" data-take-review-message aria-expanded={open} aria-controls={id} onClick={change}
        className={cn("grid min-h-11 w-fit max-w-full grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2.5",
          "rounded-xl border border-border px-3 py-2 text-left hover:brightness-[.98] dark:hover:brightness-110", PROJECT_SPEAKER_BUBBLE)}>
        <MessagesSquare className="size-4 text-muted-foreground" aria-hidden />
        <span className="min-w-0">
          <span className="block text-sm font-semibold leading-snug">{title}</span>
          {preview ? <span className="line-clamp-2 break-words text-[13px] leading-snug text-muted-foreground">{preview}</span> : null}
        </span>
        <ChevronRight className={cn("size-4 text-muted-foreground", open && "rotate-90")} aria-hidden />
      </button>
    </div> : null}
    <div id={id} ref={setBody} hidden={!open} className={open ? "flex min-w-0 flex-col gap-2" : undefined}>
      {open ? children : null}
    </div>
  </section>;
}

export function ConversationBubble({ speaker = false, children, className }: {
  speaker?: boolean;
  children: ReactNode;
  className?: string;
}) {
  return <div className={cn(WILLAB_CONTENT_RAIL, "flex min-w-0", speaker && "justify-end")}>
    <div data-bubble="" data-row={speaker ? "me" : "them"} className={cn(
      "min-w-0 max-w-[86%] space-y-2 rounded-[18px] break-words px-4 py-2.5 text-[15px] leading-relaxed",
      speaker ? PROJECT_SPEAKER_BUBBLE : "bg-muted text-foreground", className,
    )}>{children}</div>
  </div>;
}

/** Long content breaks out of the message rail, within the chat viewport. */
export function ConversationDocument({ title, actions, children, stickyHeader }: {
  title: string;
  actions?: ReactNode;
  children: ReactNode;
  stickyHeader?: boolean;
}) {
  return <article data-chat-document="" aria-label={title}
    className="my-3 w-full min-w-0 border-y border-border bg-background px-1 py-5 sm:px-4 sm:py-6">
    <header className={cn("mb-4 flex items-center justify-between gap-3", stickyHeader && "sticky top-0 z-10 bg-background py-2")}>
      <h3 className="min-w-0 break-words text-lg font-semibold tracking-tight">{title}</h3>
      {actions ? <div className="shrink-0">{actions}</div> : null}
    </header>
    {children}
  </article>;
}
