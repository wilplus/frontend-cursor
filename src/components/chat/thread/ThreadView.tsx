"use client";

import { useEffect, useRef } from "react";
import { cn } from "@/lib/utils";
import {
  AcousticMetricsBubble,
  DashboardBubble,
  SnippetPlayerBubble,
  TextBubble,
  TypingBubble,
  ActionBubble,
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
  /**
   * Optional handler for inline action_pending button clicks. When the
   * user taps YES/NO inside the bubble itself, this fires with the
   * snippetId + clicked value. ChatPageClient owns the routing into
   * the label POST + per-snippet state machine; this prop is just the
   * event hand-off. Pass `undefined` to disable inline buttons (e.g.
   * if the toolbar takes ownership of the same action in FE Prompt 2).
   */
  onActionSelect?: (snippetId: string, value: "charisma" | "stress") => void;
}

export default function ThreadView({ bubbles, onActionSelect }: ThreadViewProps) {
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
        <BubbleRow key={b.id} bubble={b} onActionSelect={onActionSelect} />
      ))}
      <div ref={threadEndRef} />
    </div>
  );
}

function BubbleRow({
  bubble,
  onActionSelect,
}: {
  bubble: Bubble;
  onActionSelect?: (snippetId: string, value: "charisma" | "stress") => void;
}) {
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

    case "snippet":
      return <SnippetPlayerBubble snippet={bubble.data} />;

    case "action_pending": {
      const isCharismaAgreement = bubble.snippetType === "charisma";
      return (
        <ActionBubble
          prompt="Do you agree with this insight?"
          options={[
            {
              value: bubble.snippetType,
              label: isCharismaAgreement
                ? "YES, this is Charisma"
                : "YES, this is Stress",
            },
            {
              value: isCharismaAgreement ? "stress" : "charisma",
              label: isCharismaAgreement
                ? "NO, this is Stress"
                : "NO, this is Charisma",
              variant: "outline",
            },
          ]}
          selected={null}
          submitting={bubble.submitting}
          onSelect={(value) => {
            if (!onActionSelect) return;
            onActionSelect(
              bubble.snippetId,
              value as "charisma" | "stress"
            );
          }}
        />
      );
    }
  }
}
