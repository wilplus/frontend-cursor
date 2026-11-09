"use client";

import { useCallback, useState } from "react";
import { enterModel, getModelPage, type ModelPage } from "@/services/api/models";
import { useBackDismiss } from "../useBackDismiss";
import { AddExampleScreen, DoorScreen, ModelListScreen, ModelPageScreen, QueueScreen, WhatDoIGetScreen } from "./ModelScreens";
import ModelTeach from "./ModelTeach";

/* -------------------------------------------------------------------------- */
/*  The AI models over the list of chats: one stack of screens, ‹ back one,   */
/*  ✕ out to the chats (and the phone's Back the same, useBackDismiss).      */
/*                                                                            */
/*    list   → What do I get? · a model's page · Teach it                     */
/*    Teach it → the door for a model the person does not teach yet           */
/*               ("This is my field" joins it, MOD-07), else teaching at once  */
/*    queue  → Start (the one queue) · a model alone · Add an example         */
/*    teaching, when nothing more waits → the queue, which says so (MOD-23)   */
/* -------------------------------------------------------------------------- */

export type ModelsScreen =
  | { at: "list" }
  | { at: "what" }
  | { at: "page"; id: string }
  | { at: "door"; id: string }
  | { at: "teach"; only: string | null }
  | { at: "queue" }
  | { at: "add" };

export default function ModelsOverlay({ start, queueTitle, onClose }: {
  start: ModelsScreen;
  /** The queue row's own name ("Your queue"). */
  queueTitle: string;
  onClose: () => void;
}) {
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
  const top = stack[stack.length - 1];
  const nav = { onBack: stack.length > 1 ? back : undefined, onClose };
  const teach = (page: Pick<ModelPage, "id" | "role">) =>
    push(page.role === "public" ? { at: "door", id: page.id } : { at: "teach", only: page.id });
  const toList = () => setStack([{ at: "list" }]);
  const toQueue = useCallback(() => setStack((was) => [...was.filter((s) => s.at === "list" || s.at === "queue").slice(0, 1), { at: "queue" }]), []);

  return (
    <div data-models-overlay className="absolute inset-0 z-40 flex flex-col bg-background">
      {top.at === "list" ? (
        <ModelListScreen
          {...nav}
          onWhat={() => push({ at: "what" })}
          onOpen={(id) => push({ at: "page", id })}
          onTeach={(id) => {
            void getModelPage(id).then((page) => {
              if (page) teach(page);
            });
          }}
        />
      ) : top.at === "what" ? (
        <WhatDoIGetScreen {...nav} onBack={back} />
      ) : top.at === "page" ? (
        <ModelPageScreen {...nav} modelId={top.id} onTeach={teach} />
      ) : top.at === "door" ? (
        <DoorScreen
          {...nav}
          onYes={() => {
            const id = top.id;
            void enterModel(id).then((joined) => {
              if (joined) swap({ at: "teach", only: id });
            });
          }}
        />
      ) : top.at === "teach" ? (
        <ModelTeach only={top.only} onBack={back} onClose={onClose} onDone={toQueue} onList={toList} />
      ) : top.at === "queue" ? (
        <QueueScreen
          {...nav}
          title={queueTitle}
          onStart={(only) => push({ at: "teach", only })}
          onAdd={() => push({ at: "add" })}
          onDone={onClose}
        />
      ) : (
        <AddExampleScreen {...nav} onBack={back} />
      )}
    </div>
  );
}
