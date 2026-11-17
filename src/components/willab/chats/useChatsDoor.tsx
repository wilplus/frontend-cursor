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
};

const WAITING: ChatsDoor = {
  back: null,
  navbar: true,
  front: (
    <div data-chats-front data-chats-waiting className="absolute inset-0 z-20 flex flex-col bg-background">
      <LoadingState placement="surface" />
    </div>
  ),
};

const CLOSED: ChatsDoor = { back: null, front: null, navbar: true };

export function useChatsDoor(
  willFirst: boolean,
  _onRecordAnswer?: (answer: AnswerFor) => void,
  options?: {
    onOpenProject?: (project: TrainingArc) => void;
    onStartNewProject?: () => void;
  },
): ChatsDoor {
  const decided = useChatsDecided();
  const on = decided === true;
  const barCovered = useSiteBarCovered();

  // This read is deliberately retained even though its old rows no longer
  // define the IA. It owns people-chat caches, invitation state and recurring
  // refreshes that still feed delivery and related side effects.
  useChatList(on);
  useForgetChatsSignedOut(decided);

  const [speakingOpen, setSpeakingOpen] = useState(willFirst);
  const [ownOpen, setOwnOpen] = useState(false);
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
    back: speakingOpen ? <WillTopBar onBack={() => setSpeakingOpen(false)} place="speaking" /> : null,
    navbar: !speakingOpen && !ownOpen && !barCovered,
    front: speakingOpen ? null : (
      <div data-chats-front className="absolute inset-0 z-20 overflow-hidden bg-background">
        <ProductHome
          onOpenSpeaking={() => setSpeakingOpen(true)}
          onOpenProject={(project) => options?.onOpenProject?.(project)}
          onStartNewProject={() => options?.onStartNewProject?.()}
          onOpenOwnChat={() => setOwnOpen(true)}
        />
        {ownOpen ? <WillBuild onBack={() => setOwnOpen(false)} /> : null}
      </div>
    ),
  };
}
