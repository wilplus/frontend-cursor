"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { BackRow, ONE_BAR_ROW } from "../OneTopBar";
import { LetterCircle } from "./ChatList";
import { TopBar } from "./TopBar";
import BuildModels from "./BuildModels";
import type { HostRecipe, OwnChat } from "@/services/api/hostSetup";
import HostOwnChat from "./hostsetup/HostOwnChat";
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

function Switch({ mode, onMode }: { mode: Mode; onMode: (mode: Mode) => void }) {
  const one = (m: Mode, label: string) => (
    <button
      type="button"
      data-switch={m}
      aria-pressed={mode === m}
      onClick={() => onMode(m)}
      className={`rounded-full px-3 py-1.5 text-[13.5px] font-semibold ${mode === m ? "bg-foreground text-background" : "text-muted-foreground"}`}
    >
      {label}
    </button>
  );
  return (
    <span data-live-build="" className="flex items-center rounded-full border border-border p-0.5">
      {one("live", W.live)}
      {one("build", W.build)}
    </span>
  );
}

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
      className={`flex-1 border-b-2 py-2.5 text-[15px] font-semibold ${tab === t ? "border-foreground text-foreground" : "border-transparent text-muted-foreground"}`}
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
  const swap = canTry ? <Switch mode={mode} onMode={setMode} /> : null;
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
        <HostOwnChat key={name} name={name} recipe={live(recipe, own)} about={own?.about ?? []} onBack={onBack} bar={bar} />
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
