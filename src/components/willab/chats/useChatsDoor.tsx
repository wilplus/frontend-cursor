"use client";

import { useEffect, useState, type ReactNode } from "react";
import type { AnswerFor } from "@/lib/willab/chatAnswer";
import type { TrainingArc } from "@/services/api/trainings";
import LoadingState from "../LoadingState";
import { useBackStop } from "../useBackDismiss";
import { useSiteBarCovered } from "./siteBarCover";
import { useChatList, useChatsDecided, useForgetChatsSignedOut } from "./useChats";
import ProductHome from "./ProductHome";
import WillBuild from "./WillBuild";
import { setOpenChat, setOpenPlace } from "./loungePlace";
import { WillTopBar } from "./TopBar";
import { useUiLocale } from "@/components/ui/UiLocaleProvider";
import { uiText } from "@/lib/uiLocale";
import type { Subchat } from "@/services/api/chatStructure";
import BuiltChatSection from "./BuiltChatSection";
import ProjectRowMenu from "../ProjectRowMenu";
import { Archive, Trash2 } from "lucide-react";
import { fetchCoachDeletionProjects, type CoachProject } from "@/services/api/chatStructure";
import { useChatStructure } from "./useChatStructure";
import { refreshProjectTrainings } from "@/lib/willab/projectTrainings";
import type { TakeReviewTarget } from "../TakeReview";

/* -------------------------------------------------------------------------- */
/*  The speaking-coach door.                                                  */
/*                                                                            */
/*  People-chat reads remain mounted through useChatList: they continue to    */
/*  support delivery, invitations, retries and other backend side effects.    */
/*  They are intentionally not rendered as the speaking-coach home. The      */
/*  product home has one coach destination, the active project conversations, */
/*  and the new-project action.                                               */
/* -------------------------------------------------------------------------- */

export type ChatsDoor = {
  back: ReactNode;
  front: ReactNode;
  navbar: boolean;
  loungeCovered: boolean;
  coachProjects?: TrainingArc[];
};

const WAITING: ChatsDoor = {
  back: null,
  navbar: true,
  loungeCovered: true,
  front: (
    <div data-chats-front data-chats-waiting className="absolute inset-0 z-20 flex flex-col bg-background">
      <LoadingState placement="surface" />
    </div>
  ),
};

const CLOSED: ChatsDoor = { back: null, front: null, navbar: true, loungeCovered: false };

export function useChatsDoor(
  willFirst: boolean,
  _onRecordAnswer?: (answer: AnswerFor) => void,
  options?: {
    onOpenProject?: (project: TrainingArc, source?: "coach", target?: TakeReviewTarget) => void;
    onStartNewProject?: () => void;
  },
): ChatsDoor {
  const decided = useChatsDecided();
  const on = decided === true;
  const barCovered = useSiteBarCovered();
  const locale = useUiLocale();

  // This read is deliberately retained even though its old rows no longer
  // define the IA. It owns people-chat caches, invitation state and recurring
  // refreshes that still feed delivery and related side effects.
  useChatList(on);
  useForgetChatsSignedOut(decided);

  const [speakingOpen, setSpeakingOpen] = useState(willFirst);
  const [ownOpen, setOwnOpen] = useState(false);
  const [ownSection, setOwnSection] = useState<{ name: string; section: Subchat | "main" } | null>(null);
  const [projects, setProjects] = useState<TrainingArc[]>([]);
  const { layout, change } = useChatStructure();
  const [deletionProjects, setDeletionProjects] = useState<CoachProject[] | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteFailed, setDeleteFailed] = useState(false);
  const availableProjects = projects.filter((project) => !project.archived && !project.deletion);
  useEffect(() => {
    setOpenPlace(speakingOpen ? "speaking" : null);
  }, [speakingOpen]);
  useEffect(() => {
    setOpenChat(null);
    return () => {
      setOpenPlace(null);
      setOpenChat(null);
    };
  }, []);
  useBackStop(speakingOpen);

  if (decided === null) return WAITING;
  if (!on) return CLOSED;

  return {
    coachProjects: speakingOpen ? availableProjects : undefined,
    back: speakingOpen ? <>
      <WillTopBar onBack={() => setSpeakingOpen(false)} place="speaking" right={<div className="flex items-center gap-1">{
      availableProjects.length ? (
        <select aria-label={uiText(locale, "chooseProject")} value="" className="min-h-10 max-w-[100px] truncate rounded-lg border border-border bg-background px-2 text-sm sm:max-w-[200px]"
          onChange={(event) => {
            const project = availableProjects.find((item) => item.arcId === event.target.value);
            if (project) options?.onOpenProject?.(project, "coach");
          }}>
          <option value="">{uiText(locale, "chooseProject")}</option>
          {availableProjects.map((project) => <option key={project.arcId} value={project.arcId}>{project.topic}</option>)}
        </select>
      ) : null}
      {layout?.coach === "active" ? <ProjectRowMenu label={uiText(locale, "speakingCoach")} actions={[
        { label: "Archive", icon: Archive, onRun: async () => {
          const ok = await change({ action: "archive", section: "coach" });
          if (ok) setSpeakingOpen(false);
          return ok;
        } },
        { label: "Delete", icon: Trash2, destructive: true, onRun: async () => {
          const affected = await fetchCoachDeletionProjects().catch(() => null);
          if (!affected) return false;
          setDeletionProjects(affected);
          setDeleteFailed(false);
          return true;
        } },
      ]} /> : null}
      </div>} />
      {deletionProjects ? <div className="fixed inset-0 z-50 grid place-items-center bg-black/35 p-4">
        <section role="alertdialog" aria-label="Delete Speaking coach?" aria-modal="true" className="max-h-[85vh] w-full max-w-md space-y-3 overflow-y-auto rounded-2xl bg-background p-4">
          <h3 className="font-semibold">Delete Speaking coach?</h3>
          <p className="text-sm">This deletes the Speaking coach conversation and requests deletion of these projects, including their chats and Takes.</p>
          {deletionProjects.length ? <ul className="list-disc pl-5 text-sm">
            {deletionProjects.map((project) => <li key={project.id}>{project.display_name}</li>)}
          </ul> : null}
          {deleteFailed ? <p role="alert" className="text-sm">The chat or project list changed. Review the list and try again.</p> : null}
          <div className="flex justify-end gap-2">
            <button type="button" className="min-h-11 px-3" disabled={deleting} onClick={() => setDeletionProjects(null)}>Cancel</button>
            <button type="button" className="min-h-11 rounded-lg border border-border px-3 text-destructive" disabled={deleting} onClick={async () => {
              setDeleting(true);
              const ok = await change({ action: "delete", section: "coach", projects: deletionProjects.map((project) => project.id) });
              if (ok) {
                setDeletionProjects(null);
                setSpeakingOpen(false);
                setProjects([]);
                void refreshProjectTrainings();
                window.dispatchEvent(new Event("willab:speaking-chat-deleted"));
              } else {
                const affected = await fetchCoachDeletionProjects().catch(() => null);
                if (affected) setDeletionProjects(affected);
                setDeleteFailed(true);
              }
              setDeleting(false);
            }}>Delete</button>
          </div>
        </section>
      </div> : null}
    </> : null,
    navbar: !speakingOpen && !ownOpen && !ownSection && !barCovered,
    loungeCovered: !speakingOpen,
    // Keep the project index mounted behind Speaking coach. Returning is a
    // local reveal, not a second network-backed boot of the same list.
    // The host's own chat stays in this same front, so it is not hidden then.
    front: (
      <div
        data-chats-front
        aria-hidden={speakingOpen || undefined}
        className={`${speakingOpen ? "hidden" : ""} absolute inset-0 z-20 overflow-hidden bg-background`}
      >
        <div className="contents" aria-hidden={Boolean(ownOpen || ownSection)}
          ref={(element) => { if (element) element.inert = Boolean(ownOpen || ownSection); }}>
          <ProductHome
            onProjects={setProjects}
            onOpenSpeaking={() => setSpeakingOpen(true)}
            onOpenProject={(project) => options?.onOpenProject?.(project)}
            onStartNewProject={() => options?.onStartNewProject?.()}
            onOpenOwnChat={() => setOwnOpen(true)}
            onOpenOwnSection={(name, section) => setOwnSection({ name, section })}
          />
        </div>
        {ownOpen ? <WillBuild onBack={() => setOwnOpen(false)} onSaveChat={(doc) => {
          const { spec, line, hello, questions, taps, send, who } = doc.chat;
          return change({ action: "publish", chat: { name: doc.chat.name || doc.name,
            spec, line, hello, questions: questions.map(({ q }) => q), taps, send, who } });
        }} /> : null}
        {ownSection ? <BuiltChatSection {...ownSection} mainId={layout?.main_chat_id} published={layout?.published_chat}
          onBack={() => setOwnSection(null)} /> : null}
      </div>
    ),
  };
}
