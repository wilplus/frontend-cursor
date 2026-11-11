"use client";

import { useCallback, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useCoverSiteBar } from "../chats/siteBarCover";
import { answerModelInvite, enterModel, getModelPage, type ModelPage } from "@/services/api/models";
import type { SetupState, SetupStep } from "@/services/api/modelSetup";
import { useBackDismiss } from "../useBackDismiss";
import { DoorScreen, ModelListScreen, ModelPageScreen, QueueScreen, WhatDoIGetScreen } from "./ModelScreens";
import ModelTeach from "./ModelTeach";
import ModelApiStack, { type ApiScreen } from "./ModelApiStack";
import ModelSetup, { openSetup } from "./ModelSetup";
import { AddExampleScreen, AnswerAdded, type Added } from "./ModelAdd";
import ModelBlocks from "../chats/hostsetup/ModelBlocks";

/* -------------------------------------------------------------------------- */
/*  The AI models over the list of chats: one stack of screens, ‹ back one,   */
/*  ✕ out to the chats (and the phone's Back the same, useBackDismiss).      */
/*                                                                            */
/*    list   → What do I get? · a model's page · Teach it                     */
/*    Teach it → the door for a model the person does not teach yet           */
/*               ("This is my field" joins it, MOD-07), else teaching at once  */
/*    list   → Start your own (the setup, MOD-24) · a draft's Continue        */
/*               (MOD-25) · an invite's Open → the door: "This is my field"   */
/*               accepts it and opens the inviter's chat when it has one      */
/*               (N598), "Not now" keeps it (MOD-49)                          */
/*    the setup: ✕ keeps the draft and goes back to the list; "Teach this     */
/*               one" goes to that model's door; a model's own page opens one  */
/*               step again ("Make those two clearer", a checklist item)      */
/*    queue  → Start (the one queue) · a model alone · Add an example, then   */
/*               answer it (MOD-21)                                           */
/*    teaching, when nothing more waits → the queue, which says so (MOD-23)   */
/*    a model's API and money (ModelApiStack): its card → Use it in your      */
/*      business → the key, once → the code → Your usage; Try it; Set your    */
/*      price; Download its data; Your earnings from the list                 */
/* -------------------------------------------------------------------------- */

export type ModelsScreen =
  | { at: "list" }
  | { at: "what" }
  | { at: "page"; id: string }
  | { at: "door"; id: string; invite?: string }
  | { at: "teach"; only: string | null }
  | { at: "queue" }
  | { at: "add" }
  | { at: "added"; added: Added }
  | { at: "setup"; first: SetupState }
  /** A model started in blocks (N636 item 7). */
  | { at: "blocks" }
  | ApiScreen;

type Stack = {
  top: ModelsScreen;
  push: (s: ModelsScreen) => void;
  back: () => void;
  swap: (s: ModelsScreen) => void;
  toList: () => void;
  toQueue: () => void;
  onClose: () => void;
  nav: { onBack?: () => void; onClose: () => void };
};

function useStack(start: ModelsScreen, onClose: () => void) {
  const [stack, setStack] = useState<ModelsScreen[]>([start]);
  const push = useCallback((s: ModelsScreen) => setStack((was) => [...was, s]), []);
  const back = useCallback(() => setStack((was) => (was.length > 1 ? was.slice(0, -1) : was)), []);
  /** Swap the top screen for another (the door for teaching, once joined). */
  const swap = useCallback((s: ModelsScreen) => setStack((was) => [...was.slice(0, -1), s]), []);
  const depth = stack.length;
  useBackDismiss(onClose, () => {
    if (depth <= 1) return false;
    back();
    return true;
  });
  const toList = () => setStack([{ at: "list" }]);
  const toQueue = () => setStack((was) => [...was.filter((s) => s.at === "list" || s.at === "queue").slice(0, 1), { at: "queue" }]);
  // Back on the left of every screen, as a chat's header has; on the first
  // it closes the stack to where it was opened from (N632 item 6).
  const nav = { onBack: depth > 1 ? back : onClose, onClose };
  return { top: stack[stack.length - 1], push, back, swap, toList, toQueue, onClose, nav };
}

/** The setup's ways in: each reads its first screen before it opens, and
 *  "Start your own" hides once the setup's routes answer 404. With `blocks`
 *  (the ring chat_builder), "Start your own" and "Start the first one" open
 *  the blocks instead; a draft's "Continue" still opens the three chapters
 *  (N636 item 7). */
function useSetupWays(st: Stack, blocks: boolean) {
  const [noSetup, setNoSetup] = useState(false);
  const open = (modelId: string | null, step: SetupStep | null = null) => {
    void openSetup(modelId, step).then((first) => {
      if (first) st.push({ at: "setup", first });
      else if (!modelId) setNoSetup(true);
    });
  };
  return { open, start: noSetup ? null : blocks ? () => st.push({ at: "blocks" }) : () => open(null) };
}

function teachWay(st: Stack, how: "push" | "swap" = "push") {
  return (page: Pick<ModelPage, "id" | "role">) =>
    st[how](page.role === "public" ? { at: "door", id: page.id } : { at: "teach", only: page.id });
}

function ListTop({ st, setup }: { st: Stack; setup: ReturnType<typeof useSetupWays> }) {
  const teach = teachWay(st);
  return (
    <ModelListScreen
      {...st.nav}
      onWhat={() => st.push({ at: "what" })}
      onOpen={(id) => st.push({ at: "page", id })}
      onUse={(id) => st.push({ at: "card", id })}
      onEarnings={() => st.push({ at: "earnings" })}
      onTeach={(id) => {
        void getModelPage(id).then((page) => {
          if (page) teach(page);
        });
      }}
      onStart={setup.start}
      onContinue={(id) => setup.open(id)}
      onInvite={(invite) => st.push({ at: "door", id: invite.model_id, invite: invite.id })}
    />
  );
}

function DoorTop({ st, id, invite }: { st: Stack; id: string; invite?: string }) {
  return (
    <DoorScreen
      {...st.nav}
      onYes={() => {
        if (invite) {
          // An accepted invite opens the inviter's own chat, where the
          // teacher teaches (backend N598); without one, teaching as before.
          void answerModelInvite(invite, true).then((answered) => {
            if (!answered) return;
            if (answered.chat_link) window.location.assign(answered.chat_link);
            else st.swap({ at: "teach", only: id });
          });
          return;
        }
        void enterModel(id).then((yes) => {
          if (yes) st.swap({ at: "teach", only: id });
        });
      }}
      onNo={
        invite
          ? () => {
              void answerModelInvite(invite, false).then(() => st.toList());
            }
          : undefined
      }
    />
  );
}

function tryWay(st: Stack) {
  return (id: string) => {
    void getModelPage(id).then((page) => {
      if (page) st.push({ at: "try", id, name: page.name });
    });
  };
}

function Top({ st, queueTitle, setup }: { st: Stack; queueTitle: string; setup: ReturnType<typeof useSetupWays> }) {
  const top = st.top;
  switch (top.at) {
    case "list":
      return <ListTop st={st} setup={setup} />;
    case "what":
      return <WhatDoIGetScreen {...st.nav} onBack={st.back} />;
    case "page":
      return (
        <ModelPageScreen
          {...st.nav}
          modelId={top.id}
          onTeach={teachWay(st)}
          onApi={(way, page) => st.push(way === "try" ? { at: "try", id: page.id, name: page.name } : { at: way, id: page.id })}
          onFix={(step) => setup.open(top.id, step as SetupStep)}
        />
      );
    case "door":
      return <DoorTop st={st} id={top.id} invite={top.invite} />;
    case "teach":
      return <ModelTeach only={top.only} onBack={st.back} onClose={st.onClose} onDone={st.toQueue} onList={st.toList} />;
    case "queue":
      return (
        <QueueScreen
          {...st.nav}
          title={queueTitle}
          onStart={(only) => st.push({ at: "teach", only })}
          onAdd={() => st.push({ at: "add" })}
          onDone={st.onClose}
        />
      );
    case "add":
      return <AddExampleScreen {...st.nav} onBack={st.back} onAdded={(added) => st.swap({ at: "added", added })} />;
    case "added":
      return <AnswerAdded added={top.added} onBack={st.back} onClose={st.onClose} onDone={st.toQueue} />;
    case "blocks":
      return <ModelBlocks onBack={st.back} onDone={st.toList} />;
    case "setup":
      return (
        <ModelSetup
          key={top.first.model_id + top.first.screen.step}
          first={top.first}
          onBack={st.back}
          onClose={st.toList}
          onList={st.toList}
          onTeachOther={(id) => {
            void getModelPage(id).then((page) => {
              if (page) teachWay(st, "swap")(page);
            });
          }}
          onTry={tryWay(st)}
        />
      );
    default:
      return <ModelApiStack screen={top} nav={st.nav} push={st.push} swap={st.swap} onList={st.toList} />;
  }
}

/** The overlay fills the column Will's chat and its bar fill (backend N618
 *  item 10), not the narrower list of chats it opens from: the chats' front
 *  is that column. On a phone the two are the same width. Drawn where it
 *  stands when there is no such column around it; `undefined` until read. */
function useWillColumn() {
  const mark = useRef<HTMLSpanElement | null>(null);
  const [column, setColumn] = useState<Element | null | undefined>(undefined);
  useLayoutEffect(() => setColumn(mark.current?.closest("[data-chats-front]") ?? null), []);
  return { mark, column };
}

export default function ModelsOverlay({ start, queueTitle, blocks = false, onClose }: {
  start: ModelsScreen;
  /** A model is started in blocks (the ring chat_builder, N636 item 7). */
  blocks?: boolean;
  /** The queue row's own name ("Your queue"). */
  queueTitle: string;
  onClose: () => void;
}) {
  const st = useStack(start, onClose);
  const setup = useSetupWays(st, blocks);
  const { mark, column } = useWillColumn();
  useCoverSiteBar();
  // Opens like a chat (N632 item 6): no site bar above it, and Back on the
  // left takes the close's place, so the top bar's ✕ is not drawn.
  const frame = (
    <div data-models-overlay className="absolute inset-0 z-40 flex flex-col bg-background [&_.walk-ovtop>button[aria-label=Close]]:hidden">
      <Top st={st} queueTitle={queueTitle} setup={setup} />
    </div>
  );
  return (
    <>
      <span ref={mark} hidden />
      {column === undefined ? null : column ? createPortal(frame, column) : frame}
    </>
  );
}
