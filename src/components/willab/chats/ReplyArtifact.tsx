"use client";

import type { ReactNode } from "react";
import { useUiLocale } from "@/components/ui/UiLocaleProvider";
import { chatArtifactContent } from "@/lib/willab/chatArtifact";
import type { ChatMessage } from "@/services/api/chats";
import ChatArtifact from "./ChatArtifact";
import { ConversationDocument } from "./TakeConversation";

export function ArtifactText({ text }: { text?: string }) {
  return text ? <p className="whitespace-pre-wrap break-words">{text}</p> : null;
}

export function artifactDocument(output?: string): boolean {
  return Boolean(output && (output.length >= 420 || output.includes("\n\n")));
}

export function StructuredReplyArtifact({ content, momentControl, inline = false }: {
  content: unknown; momentControl?: ReactNode; inline?: boolean;
}) {
  const artifact = chatArtifactContent(content);
  if (!artifact) return null;
  const { title, preview, moment, intervention, output } = artifact;
  if (inline) return <div className="space-y-2">
    {momentControl}
    <ArtifactText text={moment} />
    <ArtifactText text={intervention} />
    <ArtifactText text={output} />
  </div>;
  if (artifactDocument(output)) return <>
    {moment || intervention ? <StructuredReplyArtifact content={{ ...artifact, output: undefined }} momentControl={momentControl} /> : momentControl}
    <ConversationDocument title={title}><ArtifactText text={output} /></ConversationDocument>
  </>;
  return <ChatArtifact title={title} preview={preview ?? intervention ?? output ?? moment}
    moment={moment || momentControl ? <div className="space-y-1.5">
      <ArtifactText text={moment} />{momentControl}
    </div> : null}
    intervention={intervention && <ArtifactText text={intervention} />}
    output={output && <ArtifactText text={output} />} />;
}

export function isRecordedReply(message: ChatMessage): boolean {
  return !message.mine && message.kind === "voice" && message.meta?.question !== true &&
    (message.meta?.answer === true || typeof message.meta?.answer_to === "string");
}

/** The same stored reply is served in a member thread and in the website
 *  chat. The supplied player keeps that surface's own audio access check. */
export function ChatMessageWithArtifact({ message, quote, recordedReply = isRecordedReply(message), children, inlineTake }: {
  message: ChatMessage; quote?: ReactNode; recordedReply?: boolean; children: ReactNode; inlineTake?: boolean;
}) {
  const locale = useUiLocale();
  const attachment = !message.mine ? chatArtifactContent(message.meta?.chat_artifact) : null;
  if (inlineTake) {
    const document = artifactDocument(attachment?.output) ? attachment?.output : undefined;
    return <div className="flex min-w-0 flex-col gap-2">
      {quote}
      {children}
      {attachment ? <StructuredReplyArtifact inline content={document ? { ...attachment, output: undefined } : attachment} /> : null}
      {document && attachment ? <ConversationDocument title={attachment.title}><ArtifactText text={document} /></ConversationDocument> : null}
    </div>;
  }
  if (recordedReply) {
    const source = message.meta?.quote as { words?: unknown } | undefined;
    const words = typeof source?.words === "string" ? source.words.trim() : "";
    const title = locale === "pl" ? "Nagrana odpowiedź" : "Recorded reply";
    const preview = attachment?.preview || words || (locale === "pl" ? "Posłuchaj odpowiedzi" : "Listen to the reply");
    return <ChatArtifact title={attachment?.title ?? title} preview={preview}
      moment={words ? quote ?? <ArtifactText text={words} /> : attachment?.moment && <ArtifactText text={attachment.moment} />}
      intervention={attachment?.intervention && <ArtifactText text={attachment.intervention} />}
      output={<div className="flex flex-col gap-2">{children}<ArtifactText text={attachment?.output} /></div>} />;
  }
  if (attachment) return <div className="flex w-full min-w-0 flex-col gap-2">
    {children}
    <StructuredReplyArtifact content={attachment} />
  </div>;
  return <>{children}</>;
}
