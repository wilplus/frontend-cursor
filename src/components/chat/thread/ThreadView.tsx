"use client";

import { useEffect, useRef } from "react";
import { cn } from "@/lib/utils";
import {
  AcousticMetricsBubble,
  DashboardBubble,
  SnippetLabelBubble,
  SnippetPlayerBubble,
  StressContrastBubble,
  TextBubble,
  TypingBubble,
} from "@/components/chat/RichBubbles";
import ChatBubble from "@/components/funnel/ChatBubble";
import type { Bubble } from "@/components/chat/thread/types";

/* -------------------------------------------------------------------------- */
/*  ThreadView — presentation-only renderer for the unified bubble array     */
/*                                                                            */
/*  Mounted once in ChatPageClient. Owns NO business logic, NO fetches, NO   */
/*  phase logic. Variant → component mapping lives in a single switch.       */
/*  Auto-scroll-to-bottom moves with the renderer (previously inside         */
/*  ChatInterview's thread block).                                            */
/* -------------------------------------------------------------------------- */

interface ThreadViewProps {
  bubbles: Bubble[];
}

export default function ThreadView({ bubbles }: ThreadViewProps) {
  const threadEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to the latest bubble. Fires on every bubble-array
  // mutation including in-place updates (e.g. pending → committed)
  // — that's the desired UX since a state change may extend the
  // visible content vertically.
  useEffect(() => {
    threadEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [bubbles]);

  return (
    <div className="flex flex-1 flex-col gap-3 overflow-y-auto py-4">
      {bubbles.map((b) => (
        <BubbleRow key={b.id} bubble={b} />
      ))}
      <div ref={threadEndRef} />
    </div>
  );
}

function BubbleRow({ bubble }: { bubble: Bubble }) {
  switch (bubble.kind) {
    case "bot_text":
      return (
        <div
          className={cn(
            "transition-opacity",
            bubble.pending && "opacity-60"
          )}
        >
          {/* `tone` lives on the bubble for buildPreviousTurns context
              reconstruction but isn't a visual prop today — ChatBubble
              doesn't render tone-specific styling, so it's omitted here. */}
          <ChatBubble type="bot" content={bubble.text} />
        </div>
      );

    case "user_text":
      return (
        <div className={cn("flex justify-end animate-fade-in-up", bubble.pending && "opacity-60")}>
          <div className="max-w-[85%] rounded-2xl rounded-tr-sm bg-chat-bubble-user px-4 py-2.5 text-sm leading-relaxed text-chat-bubble-user-foreground shadow-sm">
            {bubble.text}
          </div>
        </div>
      );

    case "user_audio":
      return (
        <ChatBubble
          type="user"
          audioUrl={bubble.audioUrl}
          duration={bubble.duration}
        />
      );

    case "typing":
      return <TypingBubble />;

    case "metrics":
      return <AcousticMetricsBubble metrics={bubble.data} />;

    case "dashboard":
      return <DashboardBubble data={bubble.data} />;

    case "contrast":
      return <StressContrastBubble data={bubble.data} />;

    case "snippet":
      return <SnippetPlayerBubble snippet={bubble.data} />;

    case "action_pending": {
      // Contextual prompt only — the actual Charisma/Stress buttons
      // live in the toolbar's `label_buttons` panel mode now (matrix
      // C-LI-4). Inline buttons are deliberately omitted to avoid
      // double click targets; the panel below this thread is where
      // the user picks.
      return <SnippetLabelBubble selected={null} submitting={bubble.submitting} />;
    }
  }
}
