"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Quote } from "lucide-react";
import type { LoungeMessage } from "@/services/api/loungeMessages";
import { chatArtifactContent } from "@/lib/willab/chatArtifact";
import { WILLAB_CONTENT_RAIL } from "@/lib/willab/layout";
import { takeSessionOf } from "@/lib/willab/takeExchange";
import { coachMomentFromMetadata } from "@/services/api/coachMoment";
import { humanCoachOffer } from "@/services/api/humanCoach";
import { chatVoicePath } from "@/services/api/willQuestion";
import { readChatReplyAudio } from "@/lib/willab/voiceNoteOutbox";
import { withoutCoachTranscriptFooter } from "../willabHelpers";
import CoachMoment from "../CoachMoment";
import CoachVideo from "../CoachVideo";
import Linkified from "../Linkified";
import LoungeAiVoiceBubble, { aiVoiceOfMeta } from "../LoungeAiVoiceBubble";
import { RichText } from "../RichText";
import { isSavedPracticeAttempt, PastAttempt } from "../TakeReviewPracticeHistory";
import WalkPlayer from "../walk/WalkPlayer";
import { useUserId } from "../useUserId";
import { ArtifactText, artifactDocument } from "./ReplyArtifact";
import { ConversationBubble, ConversationDocument } from "./TakeConversation";
import HumanCoachHandoff from "./HumanCoachHandoff";

export default function TakeConversationMessage({
  message, project, recordingDock, footer, replayOnly, onRefer, standalone = false, children,
}: {
  message: LoungeMessage;
  project?: string;
  recordingDock?: HTMLDivElement | null;
  footer?: ReactNode;
  replayOnly?: boolean;
  onRefer?: (snippet: string, words: string) => void;
  /** This reply is outside a Take recap and owns its own practice playback. */
  standalone?: boolean;
  children?: ReactNode;
}) {
  const { own, clip, audio, video, ai, text, artifact, document, reference, snippet, handoff } = useMemo(() => takeMessageParts(message), [message]);
  const marker = { "data-project-message": project ? message.client_id : undefined };
  if (isSavedPracticeAttempt(message)) return <div {...marker} className={WILLAB_CONTENT_RAIL}><PastAttempt row={message} /></div>;
  if (ai && message.kind === "walk_step" && !audio && !video && !reference && !artifact) return <div {...marker} className={WILLAB_CONTENT_RAIL}>
    <LoungeAiVoiceBubble body={text} practiceId={ai.practiceId} then={ai.then} fallback={ai.fallback}
      seed={message.client_id} avatar={null} />
  </div>;
  const voice = own && message.metadata?.voice_clip === true;
  const showBubble = [text.trim(), audio, voice, video, ai, reference, artifact?.moment,
    artifact?.intervention, artifact?.output, handoff, children].some(Boolean);
  if (!showBubble && !document && !footer) return null;
  const example = video || ai ? <>
    {video ? <CoachVideo compact src={video} /> : null}
    {ai ? <LoungeAiVoiceBubble inline body="" practiceId={ai.practiceId} then={ai.then} fallback={ai.fallback}
      seed={message.client_id} avatar={null} /> : null}
  </> : null;
  const refer = reference && reference.take_session_id !== takeSessionOf(message) ? undefined : onRefer;
  return <>
    <div {...marker} className="contents">
      {showBubble ? <ConversationBubble speaker={own}>
        <TakeMessageCaption text={text} snippet={snippet} onRefer={refer} linkify={standalone} />
        {voice ? <SpokenReply message={message} /> : null}
        {audio ? <WalkPlayer look="bare" seed={message.client_id} src={audio} label="Recording"
          startOffsetMs={typeof clip?.start_ms === "number" ? clip.start_ms : null}
          durationMs={typeof clip?.duration_ms === "number" ? clip.duration_ms : null} /> : null}
        <CoachMoment replayOnly={replayOnly} reference={reference} example={example} artifact={artifact}
          project={project} recordingDock={recordingDock} includeHistory={standalone} />
        {handoff ? <HumanCoachHandoff offer={handoff} insideProject={Boolean(project)} /> : null}
        {children}
      </ConversationBubble> : null}
      {document ? <ConversationDocument title={document.title}><ArtifactText text={document.text} /></ConversationDocument> : null}
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
  const ai = message.role === "bot" ? aiVoiceOfMeta(meta) : null;
  const text = own ? message.body : withoutCoachTranscriptFooter(message.body);
  const content = own ? null : chatArtifactContent(meta.chat_artifact);
  const document = content && artifactDocument(content.output) ? { title: content.title, text: content.output } : null;
  const artifact = document && content ? { ...content, output: undefined } : content;
  const reference = message.role === "bot" ? coachMomentFromMetadata(meta.coach_moment) : null;
  const snippet = [meta.snippet_id, clip?.snippet_id, reference?.snippet_id]
    .find((id): id is string => typeof id === "string");
  const handoff = message.role === "bot" ? humanCoachOffer(meta.human_coach_handoff) : null;
  return { own, clip, audio, video, ai, text, artifact, document, reference, snippet, handoff };
}

export function hasTakeReplyContent(message: LoungeMessage): boolean {
  if (message.role === "user") return message.metadata?.voice_clip === true;
  if (message.role !== "bot") return false;
  const { artifact, reference, audio, video, ai, handoff } = takeMessageParts(message);
  return Boolean(artifact || reference || audio || video || ai || handoff);
}

function SpokenReply({ message }: { message: LoungeMessage }) {
  const user = useUserId();
  const [local, setLocal] = useState<string | null>(null);
  useEffect(() => {
    if (!user) return;
    let alive = true;
    let src: string | null = null;
    void readChatReplyAudio(message.client_id, user).then((audio) => {
      if (!alive || !audio || typeof URL.createObjectURL !== "function") return;
      src = URL.createObjectURL(audio);
      setLocal(src);
    });
    return () => { alive = false; if (src) URL.revokeObjectURL(src); };
  }, [message.client_id, user]);
  return <div className="mt-2">
    <WalkPlayer look="bare" seed={message.client_id} src={local ?? chatVoicePath(message.client_id)}
      label="Your recording" durationMs={typeof message.metadata?.duration_ms === "number" ? message.metadata.duration_ms : null} />
  </div>;
}

function TakeMessageCaption({ text, snippet, onRefer, linkify }: {
  text: string;
  snippet?: string;
  onRefer?: (snippet: string, words: string) => void;
  linkify: boolean;
}) {
  if (!text.trim()) return null;
  if (!snippet || !onRefer) return <p className="whitespace-pre-wrap">{linkify ? <Linkified text={text} /> : <RichText text={text} />}</p>;
  return <button type="button" onClick={() => onRefer(snippet, text)}
    title="Refer to this moment" className="flex min-h-11 items-start gap-2 whitespace-pre-wrap text-left hover:underline">
    <Quote className="mt-1 size-3.5 shrink-0 text-muted-foreground" aria-hidden />
    <span><RichText text={text} /></span>
  </button>;
}
