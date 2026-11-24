"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Quote } from "lucide-react";
import type { LoungeMessage } from "@/services/api/loungeMessages";
import { chatArtifactContent } from "@/lib/willab/chatArtifact";
import { WILLAB_CONTENT_RAIL } from "@/lib/willab/layout";
import { takeSessionOf } from "@/lib/willab/takeExchange";
import { coachMomentFromMetadata } from "@/services/api/coachMoment";
import { coachWording } from "@/services/api/coachWording";
import { humanCoachOffer } from "@/services/api/humanCoach";
import { chatVoicePath } from "@/services/api/willQuestion";
import { readChatReplyAudio } from "@/lib/willab/voiceNoteOutbox";
import { withoutCoachTranscriptFooter } from "../willabHelpers";
import CoachMoment from "../CoachMoment";
import CoachWordingCard from "../CoachWordingCard";
import CoachVideo from "../CoachVideo";
import Linkified from "../Linkified";
import LoungeAiVoiceBubble, { aiVoiceOfMeta } from "../LoungeAiVoiceBubble";
import { RichText } from "../RichText";
import { isSavedPracticeAttempt, PastAttempt } from "../TakeReviewPracticeHistory";
import WalkPlayer from "../walk/WalkPlayer";
import { useUserId } from "../useUserId";
import { noteMomentReached, shownInChat } from "@/lib/willab/momentReached";
import { ArtifactText, artifactDocument } from "./ReplyArtifact";
import { ConversationBubble, ConversationDocument } from "./TakeConversation";
import HumanCoachHandoff from "./HumanCoachHandoff";

export default function TakeConversationMessage({
  message, project, recordingDock, footer, replayOnly, onRefer, standalone = false, wordingSaved = false, onWordingSaved, children,
}: {
  message: LoungeMessage;
  project?: string;
  recordingDock?: HTMLDivElement | null;
  footer?: ReactNode;
  replayOnly?: boolean;
  onRefer?: (snippet: string, words: string) => void;
  /** This reply is outside a Take recap and owns its own practice playback. */
  standalone?: boolean;
  wordingSaved?: boolean;
  onWordingSaved?: () => void;
  children?: ReactNode;
}) {
  const { own, clip, audio, video, ai, text, artifact, document, reference, snippet, handoff, wording } = useMemo(() => takeMessageParts(message), [message]);
  useMomentReached({ own, reference, clip, video });
  const marker = { "data-project-message": project ? message.client_id : undefined };
  if (isSavedPracticeAttempt(message)) return <div {...marker} className={WILLAB_CONTENT_RAIL}><PastAttempt row={message} /></div>;
  if (ai && message.kind === "walk_step" && !audio && !video && !reference && !artifact) return <div {...marker} className={WILLAB_CONTENT_RAIL}>
    <LoungeAiVoiceBubble body={text} practiceId={ai.practiceId} then={ai.then} fallback={ai.fallback}
      seed={message.client_id} avatar={null} />
  </div>;
  const voice = own && message.metadata?.will_voice === true;
  const showBubble = [text.trim(), audio, voice, video, ai, reference, artifact?.moment,
    artifact?.intervention, artifact?.output, handoff, wording, children].some(Boolean);
  if (!showBubble && !document && !footer) return null;
  const example = takeMessageExample(message.client_id, video, ai);
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
        {wording ? <CoachWordingCard message={message} project={project} recordingDock={recordingDock}
          savedReply={wordingSaved} onSaved={onWordingSaved} /> : null}
        {handoff ? <HumanCoachHandoff offer={handoff} insideProject={Boolean(project)} /> : null}
        {children}
      </ConversationBubble> : null}
      {document ? <ConversationDocument title={document.title}><ArtifactText text={document.text} /></ConversationDocument> : null}
    </div>
    {footer ? <div data-take-message-actions={message.client_id} className={WILLAB_CONTENT_RAIL}>{footer}</div> : null}
  </>;
}

function takeMessageExample(id: string, video: string | null, ai: ReturnType<typeof aiVoiceOfMeta>) {
  if (!video && !ai) return null;
  return <>
    {video ? <CoachVideo compact src={video} /> : null}
    {ai ? <LoungeAiVoiceBubble inline body="" practiceId={ai.practiceId} then={ai.then} fallback={ai.fallback}
      seed={id} avatar={null} /> : null}
  </>;
}

/** The coach's queue hears every moment the chat shows (backend N691 item 1). */
function useMomentReached({ own, reference, clip, video }: {
  own: boolean;
  reference: ReturnType<typeof coachMomentFromMetadata>;
  clip: Record<string, unknown> | null;
  video: string | null;
}): void {
  const cited = reference?.snippet_id ?? (typeof clip?.snippet_id === "string" ? clip.snippet_id : null);
  const reached = own ? null : cited;
  const exercise = Boolean(reference?.practise || reference?.intervention);
  useEffect(() => {
    noteMomentReached(reached, shownInChat({ exercise, coachVideo: Boolean(video) }));
  }, [reached, exercise, video]);
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
  const wording = message.role === "bot" ? coachWording(meta.coach_wording) : null;
  return { own, clip, audio, video, ai, text, artifact, document, reference, snippet, handoff, wording };
}

export function hasTakeReplyContent(message: LoungeMessage, allowUnscopedWording = true): boolean {
  if (message.role === "user") return message.metadata?.will_voice === true;
  if (message.role !== "bot") return false;
  const { artifact, reference, audio, video, ai, handoff, wording } = takeMessageParts(message);
  return Boolean(artifact || reference || audio || video || ai || handoff || (wording && (allowUnscopedWording || wording.take_session_id)));
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
  const src = local ?? (message.metadata?.voice_clip === true ? chatVoicePath(message.client_id) : null);
  if (!src) return null;
  return <div className="mt-2">
    <WalkPlayer look="bare" seed={message.client_id} src={src}
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
