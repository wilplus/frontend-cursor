"use client";

import type { ReactNode } from "react";
import { Quote } from "lucide-react";
import type { LoungeMessage } from "@/services/api/loungeMessages";
import { chatArtifactContent } from "@/lib/willab/chatArtifact";
import { WILLAB_CONTENT_RAIL } from "@/lib/willab/layout";
import { coachMomentFromMetadata } from "@/services/api/coachMoment";
import { withoutCoachTranscriptFooter } from "../willabHelpers";
import CoachMoment from "../CoachMoment";
import CoachVideo from "../CoachVideo";
import LoungeAiVoiceBubble, { aiVoiceOfMeta } from "../LoungeAiVoiceBubble";
import { RichText } from "../RichText";
import { isSavedPracticeAttempt, PastAttempt } from "../TakeReviewPracticeHistory";
import WalkPlayer from "../walk/WalkPlayer";
import { ArtifactText, artifactDocument } from "./ReplyArtifact";
import { ConversationBubble, ConversationDocument } from "./TakeConversation";

export default function TakeConversationMessage({ message, project, recordingDock, footer, replayOnly, onRefer }: {
  message: LoungeMessage;
  project?: string;
  recordingDock?: HTMLDivElement | null;
  footer?: ReactNode;
  replayOnly?: boolean;
  onRefer?: (snippet: string, words: string) => void;
}) {
  const { meta, own, clip, audio, video, ai, text, artifact, document, attachment, snippet, showBubble } = takeMessageParts(message);
  const marker = { "data-project-message": project ? message.client_id : undefined };
  if (isSavedPracticeAttempt(message)) return <div {...marker} className={WILLAB_CONTENT_RAIL}><PastAttempt row={message} /></div>;
  if (ai) return <div {...marker} className={WILLAB_CONTENT_RAIL}>
    <LoungeAiVoiceBubble body={text} practiceId={ai.practiceId} then={ai.then} fallback={ai.fallback}
      seed={message.client_id} avatar={null} />
  </div>;
  if (!showBubble && !document && !footer) return null;
  return <>
    <div {...marker} className="contents">
    {showBubble ? <ConversationBubble speaker={own}>
      <TakeMessageCaption text={text} snippet={snippet} onRefer={onRefer} />
      {audio ? <WalkPlayer look="bare" seed={message.client_id} src={audio} label="Recording"
        startOffsetMs={typeof clip?.start_ms === "number" ? clip.start_ms : null}
        durationMs={typeof clip?.duration_ms === "number" ? clip.duration_ms : null} /> : null}
      {video ? <CoachVideo compact src={video} /> : null}
      {attachment ? <CoachMoment inline replayOnly={replayOnly} raw={meta.coach_moment}
        artifact={document ? { ...artifact, output: undefined } : artifact}
        project={project} recordingDock={recordingDock} /> : null}
    </ConversationBubble> : null}
    {document && artifact ? <ConversationDocument title={artifact.title}><ArtifactText text={document} /></ConversationDocument> : null}
    </div>
    {footer ? <div data-take-message-actions={message.client_id} className={WILLAB_CONTENT_RAIL}>{footer}</div> : null}
  </>;
}

function takeMessageParts(message: LoungeMessage) {
  const meta = message.metadata ?? {};
  const own = message.role === "user";
  const clip = meta.clip && typeof meta.clip === "object" ? meta.clip as Record<string, unknown> : null;
  const audio = typeof clip?.src === "string" ? clip.src : null;
  const video = typeof meta.video === "string" ? meta.video : null;
  const ai = message.kind === "walk_step" && !own && !audio ? aiVoiceOfMeta(meta) : null;
  const text = own ? message.body : withoutCoachTranscriptFooter(message.body);
  const artifact = own ? null : chatArtifactContent(meta.chat_artifact);
  const document = artifactDocument(artifact?.output) ? artifact?.output : undefined;
  const attachment = !own && (meta.coach_moment || artifact);
  const snippet = [meta.snippet_id, clip?.snippet_id, coachMomentFromMetadata(meta.coach_moment)?.snippet_id]
    .find((id): id is string => typeof id === "string");
  const showBubble = Boolean(text.trim() || audio || video || meta.coach_moment || artifact?.moment ||
    artifact?.intervention || (artifact?.output && !document));
  return { meta, own, clip, audio, video, ai, text, artifact, document, attachment, snippet, showBubble };
}

function TakeMessageCaption({ text, snippet, onRefer }: {
  text: string;
  snippet?: string;
  onRefer?: (snippet: string, words: string) => void;
}) {
  if (!text.trim()) return null;
  if (!snippet || !onRefer) return <p className="whitespace-pre-wrap"><RichText text={text} /></p>;
  return <button type="button" onClick={() => onRefer(snippet, text)}
    title="Refer to this moment" className="flex min-h-11 items-start gap-2 whitespace-pre-wrap text-left hover:underline">
    <Quote className="mt-1 size-3.5 shrink-0 text-muted-foreground" aria-hidden />
    <span><RichText text={text} /></span>
  </button>;
}
