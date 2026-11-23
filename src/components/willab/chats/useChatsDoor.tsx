"use client";

import { useEffect, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import dynamic from "next/dynamic";
import { Archive, Trash2 } from "lucide-react";
import type { AnswerFor } from "@/lib/willab/chatAnswer";
import type { Chat } from "@/services/api/chats";
import type { TrainingArc } from "@/services/api/trainings";
import { fetchCoachDeletionProjects, type CoachProject, type Subchat } from "@/services/api/chatStructure";
import { useUiLocale } from "@/components/ui/UiLocaleProvider";
import { uiText } from "@/lib/uiLocale";
import { refreshProjectTrainings } from "@/lib/willab/projectTrainings";
import LoadingState from "../LoadingState";
import ProjectRowMenu from "../ProjectRowMenu";
import { useBackStop } from "../useBackDismiss";
import ProductHome from "./ProductHome";
import WillBuild from "./WillBuild";
import BuiltChatSection from "./BuiltChatSection";
import { onAskedChatThread, setOpenChat, setOpenPlace } from "./loungePlace";
import { TakesChatBar, TopBar } from "./TopBar";
import { WillMark } from "./ChatList";
import { useChatList, useChatsDecided, useForgetChatsSignedOut } from "./useChats";
import { useChatStructure } from "./useChatStructure";

const loading = () => <LoadingState placement="surface" />;
const ChatThread = dynamic(() => import("./ChatThread"), { ssr: false, loading });
const InquiryThread = dynamic(() => import("./InquiryThread"), { ssr: false, loading });

type Destination =
  | { kind: "coach" }
  | { kind: "builder" }
  | { kind: "built"; name: string; section: Subchat | "main" }
  | { kind: "person"; chat: Chat; thread?: boolean };

type Options = {
  activeProject?: TrainingArc | null;
  navigate?: (action: () => void) => void;
  onLeaveProject?: () => void;
  onOpenProject?: (project: TrainingArc) => void;
  onStartNewProject?: () => void;
  onRemoveProject?: (arcId: string) => void;
};

type ChatsDoor = {
  enabled: boolean;
  waiting: boolean;
  activeChat: string;
  sidebar: ReactNode;
  heading: ReactNode;
  pane: ReactNode;
  loungeCovered: boolean;
  projects: TrainingArc[];
  speakingActive: boolean;
};

function chatKey(destination: Destination): string {
  if (destination.kind === "person") return `person:${destination.chat.id}`;
  if (destination.kind === "built") return `built:${destination.section === "main" ? "main" : destination.section.id}`;
  return destination.kind;
}

function conversationStatus(destination: Destination, project: TrainingArc | null | undefined,
  enabled: boolean, coachAvailable: boolean) {
  const takesChat = destination.kind === "person" && destination.chat.takes && !destination.thread ? destination.chat : null;
  const speakingActive = enabled && destination.kind === "coach" && coachAvailable;
  const takesChatId = !project && enabled ? takesChat?.id ?? null : null;
  return {
    takesChat, takesChatId, speakingActive,
    place: speakingActive || project || takesChatId ? "speaking" as const : null,
    loungeCovered: Boolean(project) || (enabled && !speakingActive && !takesChat),
    coachHeading: enabled && !project && destination.kind === "coach",
  };
}

function availableDestination(destination: Destination, layout: NonNullable<ReturnType<typeof useChatStructure>["layout"]>) {
  if (destination.kind === "builder") return layout.builder === "active";
  if (destination.kind !== "built") return true;
  if (layout.builder !== "active") return false;
  const { section } = destination;
  return section === "main" || layout.subchats.some((chat) => chat.id === section.id && !chat.archived);
}

export function useChatsDoor(onRecordAnswer?: (answer: AnswerFor) => void, options?: Options): ChatsDoor {
  const decided = useChatsDecided();
  const enabled = decided === true;
  const locale = useUiLocale();
  const { chats: people, reload: reloadPeople } = useChatList(enabled);
  useForgetChatsSignedOut(decided);

  const [destination, setDestination] = useState<Destination>({ kind: "coach" });
  const [projects, setProjects] = useState<TrainingArc[]>([]);
  const structure = useChatStructure();
  const { layout, change } = structure;
  const project = options?.activeProject;
  const { takesChat, takesChatId, speakingActive, place, loungeCovered, coachHeading } =
    conversationStatus(destination, project, enabled, layout?.coach !== "archived" && layout?.coach !== "deleted");
  const takesChatName = takesChat?.title;

  useEffect(() => {
    setOpenChat(takesChatId, takesChatName);
    setOpenPlace(place);
    return () => { setOpenPlace(null); setOpenChat(null); };
  }, [takesChatId, takesChatName, place]);
  useBackStop(enabled);

  useEffect(() => {
    if (layout && !availableDestination(destination, layout)) setDestination({ kind: "coach" });
  }, [destination, layout]);

  const navigate = options?.navigate ?? ((action: () => void) => action());
  function open(next: Destination) {
    navigate(() => {
      options?.onLeaveProject?.();
      setDestination(next);
    });
  }
  const openCoach = () => open({ kind: "coach" });
  function openProject(arc: TrainingArc) {
    if (arc.archived || arc.deletion || project?.arcId === arc.arcId) return;
    navigate(() => {
      setDestination({ kind: "coach" });
      options?.onOpenProject?.(arc);
    });
  }
  function startProject() {
    navigate(() => {
      options?.onLeaveProject?.();
      setDestination({ kind: "coach" });
      options?.onStartNewProject?.();
    });
  }
  const openedPerson = (chat: Chat) => open({ kind: "person", chat });
  const activeChat = project ? `project:${project.arcId}` : chatKey(destination);
  const heading = coachHeading ?
    <TopBar title={uiText(locale, "speakingCoach")} circle={<WillMark size={32} />} /> : null;

  return {
    enabled,
    waiting: decided === null,
    activeChat,
    loungeCovered,
    speakingActive,
    projects: projects.filter((arc) => !arc.archived && !arc.deletion),
    heading,
    sidebar: enabled ? <ProductHome
      activeChat={activeChat}
      structure={structure}
      people={people ?? []}
      onProjects={setProjects}
      onOpenPerson={openedPerson}
      onOpenSpeaking={openCoach}
      coachActions={layout?.coach === "active" ? <CoachMenu change={change} onDelete={() => {
        options?.onLeaveProject?.();
        setProjects([]);
      }} onArchive={() => { options?.onLeaveProject?.(); }} /> : null}
      onOpenProject={openProject}
      onRemoveProject={options?.onRemoveProject}
      onStartNewProject={startProject}
      onOpenOwnChat={() => open({ kind: "builder" })}
      onOpenOwnSection={(name, section) => open({ kind: "built", name, section })}
    /> : null,
    pane: enabled && !project ? <ConversationPane
      destination={destination}
      takesChat={takesChat}
      layout={layout}
      change={change}
      onBack={destination.kind === "person" && destination.thread ? () => openedPerson(destination.chat) : openCoach}
      onOpenThread={(chat) => open({ kind: "person", chat, thread: true })}
      onOpenPerson={(id) => {
        const next = people?.find((chat) => chat.id === id);
        if (next) openedPerson(next);
      }}
      onPersonGone={() => { reloadPeople(); openCoach(); }}
      onRecordAnswer={onRecordAnswer}
    /> : null,
  };
}

function ConversationPane({ destination, takesChat, layout, change, onBack, onOpenThread, onOpenPerson, onPersonGone, onRecordAnswer }: {
  destination: Destination;
  takesChat: Chat | null;
  layout: ReturnType<typeof useChatStructure>["layout"];
  change: ReturnType<typeof useChatStructure>["change"];
  onBack: () => void;
  onOpenThread: (chat: Chat) => void;
  onOpenPerson: (id: string) => void;
  onPersonGone: () => void;
  onRecordAnswer?: (answer: AnswerFor) => void;
}) {
  useEffect(() => {
    if (takesChat) return onAskedChatThread(() => onOpenThread(takesChat));
  }, [takesChat, onOpenThread]);
  if (destination.kind === "builder") return (
    <WillBuild onBack={onBack} onSaveChat={(doc) => {
      const { spec, line, hello, questions, taps, send, who } = doc.chat;
      return change({ action: "publish", chat: { name: doc.chat.name || doc.name,
        spec, line, hello, questions: questions.map(({ q }) => q), taps, send, who } });
    }} />
  );
  if (destination.kind === "built") return (
    <BuiltChatSection key={chatKey(destination)} {...destination} mainId={layout?.main_chat_id}
      published={layout?.published_chat} onBack={onBack} />
  );
  if (destination.kind !== "person") return null;
  const { chat } = destination;
  if (takesChat) return <TakesChatBar chat={chat} onBack={onBack} onOpen={() => onOpenThread(chat)} />;
  if (chat.inquiry) return <InquiryThread key={chat.id} chat={chat} inquiry={chat.inquiry}
    onBack={onBack} onGone={onPersonGone} onRecordAnswer={onRecordAnswer} />;
  return <ChatThread key={chat.id} chat={chat} onBack={onBack}
    onOpenChat={onOpenPerson} onRecordAnswer={onRecordAnswer} />;
}

function CoachMenu({ change, onArchive, onDelete }: {
  change: ReturnType<typeof useChatStructure>["change"];
  onArchive: () => void;
  onDelete: () => void;
}) {
  const locale = useUiLocale();
  const [projects, setProjects] = useState<CoachProject[] | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [failed, setFailed] = useState(false);
  async function confirm() {
    if (!projects || deleting) return;
    setDeleting(true);
    const ok = await change({ action: "delete", section: "coach", projects: projects.map((project) => project.id) });
    if (ok) {
      setProjects(null);
      onDelete();
      void refreshProjectTrainings();
      window.dispatchEvent(new Event("willab:speaking-chat-deleted"));
    } else {
      const affected = await fetchCoachDeletionProjects().catch(() => null);
      if (affected) setProjects(affected);
      setFailed(true);
    }
    setDeleting(false);
  }
  return <>
    <ProjectRowMenu label={uiText(locale, "speakingCoach")} actions={[
      { label: "Archive", icon: Archive, onRun: async () => {
        const ok = await change({ action: "archive", section: "coach" });
        if (ok) onArchive();
        return ok;
      } },
      { label: "Delete", icon: Trash2, destructive: true, onRun: async () => {
        const affected = await fetchCoachDeletionProjects().catch(() => null);
        if (!affected) return false;
        setProjects(affected);
        setFailed(false);
        return true;
      } },
    ]} />
    {projects ? createPortal(<div className="fixed inset-0 z-50 grid place-items-center bg-black/35 p-4">
      <section role="alertdialog" aria-label="Delete Speaking coach?" aria-modal="true"
        className="max-h-[85vh] w-full max-w-md space-y-3 overflow-y-auto rounded-2xl border border-border bg-background p-4">
        <h3 className="font-semibold">Delete Speaking coach?</h3>
        <p className="text-sm">This deletes the Speaking coach conversation and requests deletion of these projects, including their chats and Takes.</p>
        {projects.length ? <ul className="list-disc pl-5 text-sm">
          {projects.map((project) => <li key={project.id}>{project.display_name}</li>)}
        </ul> : null}
        {failed ? <p role="alert" className="text-sm">The chat or project list changed. Review the list and try again.</p> : null}
        <div className="flex justify-end gap-2">
          <button type="button" className="min-h-11 px-3" disabled={deleting} onClick={() => setProjects(null)}>Cancel</button>
          <button type="button" className="min-h-11 rounded-lg border border-border px-3 text-destructive"
            disabled={deleting} onClick={() => void confirm()}>Delete</button>
        </div>
      </section>
    </div>, document.body) : null}
  </>;
}
