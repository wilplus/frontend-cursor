"use client";

import { Mic } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * ChatBubble — Willab Chat funnel bubble.
 *
 * - "bot": left-aligned text bubble with the Willab "W" avatar.
 * - "user": right-aligned voice bubble with mic icon, an inline audio player
 *   (when `audioUrl` is provided), or a duration label (when not).
 *
 * Visual tokens come from the `--chat-bubble-*` CSS variables; ensure the
 * component is rendered under the `.willab-chat` scope (or wherever those
 * tokens evaluate to the warm palette).
 */
export interface ChatBubbleProps {
  type: "bot" | "user";
  /** Bot copy. Required when `type === "bot"`. */
  content?: string;
  /** Pre-formatted duration label (e.g. "0:18"). Used when no `audioUrl`. */
  duration?: string;
  /** Object URL for the recorded blob; renders an inline `<audio>` player. */
  audioUrl?: string;
  className?: string;
}

export default function ChatBubble({
  type,
  content,
  duration,
  audioUrl,
  className,
}: ChatBubbleProps) {
  if (type === "bot") {
    return (
      <div className={cn("flex justify-start animate-fade-in-up", className)}>
        <div className="flex max-w-[85%] items-start gap-2.5">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary">
            <span className="text-xs font-bold text-primary-foreground">W</span>
          </div>
          <div className="rounded-2xl rounded-tl-sm border border-border bg-chat-bot px-4 py-3 shadow-sm">
            {/* Body size matches WhatsApp's default chat message (~15–16px). */}
            <p className="text-base leading-relaxed text-foreground">{content}</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={cn("flex justify-end animate-fade-in-up", className)}>
      <div className="flex max-w-[75%] items-center gap-2 rounded-2xl rounded-tr-sm bg-chat-user px-4 py-3 shadow-sm">
        <Mic className="h-4 w-4 shrink-0 text-chat-user-foreground" aria-hidden />
        {audioUrl ? (
          <audio controls className="h-8 max-w-[180px]">
            <source src={audioUrl} />
          </audio>
        ) : duration ? (
          <span className="text-base font-medium text-chat-user-foreground">
            {duration}
          </span>
        ) : null}
      </div>
    </div>
  );
}
