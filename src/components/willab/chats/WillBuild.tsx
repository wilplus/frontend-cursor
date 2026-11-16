"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { BackRow, ONE_BAR_ROW } from "../OneTopBar";
import { LetterCircle } from "./ChatList";
import { LiveBuildSwitch, TopBar, BUILD_MODE_EVENT } from "./TopBar";
import BuildModels from "./BuildModels";
import type { HostRecipe, OwnChat } from "@/services/api/hostSetup";
import HostOwnChat from "./hostsetup/HostOwnChat";
import CoachBuild from "./coachbuild/CoachBuild";
import CoachLive from "./coachbuild/CoachLive";
import { useCoachDraft } from "@/lib/willab/chatBuilder/useCoachDraft";
import { W } from "./hostsetup/hostSetupCopy";
import { openOverList, useKnownSetup } from "./hostsetup/hostSetupDoor";

/* -------------------------------------------------------------------------- */
/*  One's own chat, built and tried (backend N642 item 3, N643 items 3 and    */
/*  4), for the ring `chat_builder`, over the Lounge open as Will's chat:     */
/*                                                                            */
/*    Build  the arrow, the chat's name and the switch; under it two tabs.    */
/*           "Your chat" is Will's chat itself, so his field, what he and the */
/*           person wrote, "I want to edit my chat" and the links about one's */
/*           chat stay as they are; Will's lines there are the chat's parts   */
/*           (WillNeedsYou). "AI models" covers it (BuildModels).            */
/*    Live   the chat as people meet it ("Test my chat": answers at once,     */
/*           keeps nothing, costs nothing), under its name with "You run      */
/*           this chat." and the switch.                                       */
/*                                                                            */
/*  The switch shows once there is something to try (the setup's can_try).   */
/*  Back goes to the list of chats; the phone's Back is WillTopBar's, which   */
/*  draws this in its place.                                                  */
/* -------------------------------------------------------------------------- */

type Mode = "build" | "live";
type Tab = "chat" | "models";

/** The chat as people meet it: its hello and taps as the backend reads them
 *  for its people (own_chat, backend #1945), "Something else" added by the
 *  chat itself; the recipe's where the read has none. */
function live(recipe: HostRecipe, own: OwnChat | null): HostRecipe {
  const taps = (own?.taps ?? recipe.taps).filter((t) => t !== W.somethingElse);
  return { ...recipe, hello: own?.hello || recipe.hello, taps };
}

function Tabs({ tab, onTab }: { tab: Tab; onTab: (tab: Tab) => void }) {
  const one = (t: Tab, label: string) => (
    <button
      type="button"
      role="tab"
      data-build-tab={t}
      aria-selected={tab === t}
      onClick={() => onTab(t)}
      className={`flex-1 border-b-2 py-2.5 text-[15px] font-semibold ${tab === t ? "border-primary text-foreground" : "border-transparent text-muted-foreground"}`}
    >
      {label}
    </button>
  );
  return (
    <div role="tablist" className="flex shrink-0 border-b border-border">
      {one("chat", W.yourChatTitle)}
      {one("models", W.aiModelsTab)}
    </div>
  );
}

/** Over the whole of Will's chat, his field included. */
function Cover({ children }: { children: ReactNode }) {
  return <div data-build-cover="" className="absolute inset-0 z-10 flex flex-col bg-background">{children}</div>;
}

export default function WillBuild({ onBack }: { onBack: () => void }) {
  const setup = useKnownSetup();
  // Opened, one's chat is Live when there is something to try, else Build
  // (backend N642 item 3).
  const [chosen, setMode] = useState<Mode | null>(null);
  const [tab, setTab] = useState<Tab>("chat");
  const [coachOpen, setCoachOpen] = useState(false);
  const draft = useCoachDraft();
  const own = setup?.own_chat ?? null;
  const name = own?.title ?? W.yourChatTitle;
  const recipe = setup?.recipe ?? null;
  const canTry = setup?.can_try === true && recipe !== null;
  const mode: Mode = chosen ?? (canTry ? "live" : "build");
  // Before a chat exists, Build opens at "What do you do?", once (N642 item 3).
  const asked = useRef(false);
  useEffect(() => {
    if (asked.current || !setup || setup.recipe) return;
    asked.current = true;
    openOverList({});
  }, [setup]);
  useEffect(() => {
    const on = (e: Event) => {
      const next = (e as CustomEvent<string>).detail;
      if (next === "live" || next === "build") setMode(next);
    };
    window.addEventListener(BUILD_MODE_EVENT, on);
    return () => window.removeEventListener(BUILD_MODE_EVENT, on);
  }, []);
  const swap = canTry ? <LiveBuildSwitch mode={mode} onMode={setMode} /> : null;
  if (coachOpen) {
    return (
      <Cover>
        <CoachBuild doc={draft.doc} onChange={(next) => void draft.save(next)} onClose={() => setCoachOpen(false)} />
      </Cover>
    );
  }
  if (mode === "live" && canTry) {
    const bar = (
      <TopBar
        circle={<LetterCircle id={`own-${name}`} name={name} size={36} />}
        title={name}
        subtitle={W.youRunIt}
        onBack={onBack}
        right={swap}
      />
    );
    return (
      <Cover>
        {draft.doc ? <><>{bar}</><CoachLive doc={draft.doc} /></> : <HostOwnChat key={name} name={name} recipe={live(recipe, own)} about={own?.about ?? []} onBack={onBack} bar={bar} />}
      </Cover>
    );
  }
  const top = (
    <div data-build-bar="" className="shrink-0 bg-background pt-[env(safe-area-inset-top)]">
      <div className={ONE_BAR_ROW}>
        <BackRow onBack={onBack} label={name} />
        {swap ? <span className="ml-auto shrink-0 pl-2">{swap}</span> : null}
      </div>
      <Tabs tab={tab} onTab={setTab} />
      {tab === "chat" ? (
        <button type="button" data-open-coach="" onClick={() => setCoachOpen(true)} className="mx-4 my-2 min-h-11 rounded-2xl border border-border px-3 text-left text-[15px] font-semibold">
          Speaking coach
        </button>
      ) : null}
    </div>
  );
  if (tab === "models") {
    return (
      <Cover>
        {top}
        <BuildModels />
      </Cover>
    );
  }
  // "Your chat": Will's chat itself, under the bar and the tabs.
  return <div className="-mx-4">{top}</div>;
}
