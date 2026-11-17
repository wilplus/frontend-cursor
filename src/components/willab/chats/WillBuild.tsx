"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { Link as LinkIcon } from "lucide-react";
import { useBackDismiss } from "../useBackDismiss";
import { useUserProfile } from "../useUserProfile";
import { LetterCircle } from "./ChatList";
import { OwnAvatar } from "./hostsetup/ChatIconPicker";
import { publicChatHref, readOwnChat } from "@/lib/willab/chatBuilder/ownChat";
import { LiveBuildSwitch, TopBar, BUILD_MODE_EVENT } from "./TopBar";
import BuildModels from "./BuildModels";
import type { HostRecipe, OwnChat, SetupPart } from "@/services/api/hostSetup";
import HostOwnChat from "./hostsetup/HostOwnChat";
import HostSetup from "./hostsetup/HostSetup";
import CoachLive from "./coachbuild/CoachLive";
import { useCoachDraft } from "@/lib/willab/chatBuilder/useCoachDraft";
import { W } from "./hostsetup/hostSetupCopy";
import { openOverList, useKnownSetup } from "./hostsetup/hostSetupDoor";
import WillNeedsYou, { orderedParts, PartBubble } from "./hostsetup/WillNeedsYou";
import TalkBuild from "./hostsetup/TalkBuild";
import { FrameBar, FrameLead } from "./hostsetup/SetupBits";

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

function ShareOwnChat({ serverPath }: { serverPath?: string | null }) {
  const [copied, setCopied] = useState(false);
  const go = async () => {
    const href = publicChatHref(window.location.origin, readOwnChat().id, serverPath);
    try { await navigator.clipboard.writeText(href); } catch { /* the sheet can still offer the link */ }
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1600);
    if (typeof navigator.share === "function") {
      try { await navigator.share({ url: href }); } catch { /* the person closed the sheet */ }
    }
  };
  return (
    <span className="relative">
      <button type="button" aria-label="Share" data-share-chat="" onClick={() => void go()} className="flex h-11 w-11 items-center justify-center rounded-full text-foreground">
        <LinkIcon className="h-5 w-5" aria-hidden />
      </button>
      {copied ? <span role="status" data-link-copied="" className="absolute right-0 top-12 z-20 whitespace-nowrap rounded-full bg-foreground px-3 py-1.5 text-[13px] font-medium text-background">Link copied</span> : null}
    </span>
  );
}

/** Over the whole of Will's chat, his field included. */
function Cover({ children }: { children: ReactNode }) {
  return <div data-build-cover="" className="absolute inset-0 z-10 flex flex-col bg-background">{children}</div>;
}

/** A row's chat is open: the browser's Back closes it, and leaves Build open. */
function PartHistory({ onClose }: { onClose: () => void }) {
  useBackDismiss(onClose);
  return null;
}

export default function WillBuild({ onBack }: { onBack: () => void }) {
  const setup = useKnownSetup();
  // Opened, one's chat is Live when there is something to try, else Build
  // (backend N642 item 3).
  const [chosen, setMode] = useState<Mode | null>(null);
  const [tab, setTab] = useState<Tab>("chat");
  const [active, setActive] = useState<string | null>(null);
  const [talk, setTalk] = useState(false);
  const [seen, setSeen] = useState<string[]>([]);
  const { profile } = useUserProfile();
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
  const tools = <span className="flex items-center"><ShareOwnChat serverPath={own?.link?.path} />{swap}</span>;
  useBackDismiss(onBack, () => {
    if (talk) { setTalk(false); return true; }
    if (active !== null && tab === "chat") { setActive(null); return true; }
    return false;
  });
  const order = orderedParts(setup?.parts ?? []);
  const openPart = (id: string) => {
    setSeen((was) => (was.includes(id) ? was : [...was, id]));
    setActive(id);
  };
  const closePart = () => setActive(null);
  // The header arrow leaves Build only from the list. A row's chat goes back
  // to that list, and so does the browser's Back (PartHistory).
  const rowOpen = active !== null && tab === "chat";
  const headerBack = () => (talk ? setTalk(false) : rowOpen ? closePart() : onBack());
  if (mode === "live" && canTry) {
    const bar = (
      <TopBar
        circle={<OwnAvatar id={`own-${name}`} name={name} size={36} />}
        title={name}
        subtitle={W.youRunIt}
        onBack={onBack}
        right={tools}
      />
    );
    return (
      <Cover>
        {draft.doc ? <><>{bar}</><CoachLive doc={draft.doc} /></> : <HostOwnChat key={name} name={name} recipe={live(recipe, own)} about={own?.about ?? []} onBack={onBack} bar={bar} />}
      </Cover>
    );
  }
  const top = (
    <div data-build-bar="" className="shrink-0 bg-background">
      <TopBar
        circle={<OwnAvatar id={`build-${name}`} name={name} size={36} />}
        title={name}
        subtitle={W.youRunIt}
        onBack={headerBack}
        right={tools}
      />
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
  // "Your chat" is a settings page. A row opens that row's own chat.
  return (
    <Cover>
      {top}
      {rowOpen ? <PartHistory onClose={closePart} /> : null}
      <div className={active ? "hidden" : "no-scrollbar flex min-h-0 flex-1 flex-col overflow-y-auto"}>
        {talk ? <TalkBuild onList={() => setTalk(false)} /> : <WillNeedsYou page onPart={(part) => openPart(part.part)} onTalk={() => setTalk(true)} />}
      </div>
      {seen.map((id) => {
        const index = order.findIndex((part) => part.part === id);
        const part = order[index];
        if (!part || !setup?.recipe) return null;
        const last = index === order.length - 1;
        return (
          <PartChat
            key={id}
            part={part}
            index={index}
            total={order.length}
            shown={active === id}
            last={last}
            name={profile?.first_name ?? ""}
            recipe={setup.recipe}
            parts={setup.parts}
            cost={setup.cost}
            ownChat={setup.own_chat}
            onBack={closePart}
            onNext={() => (last ? closePart() : openPart(order[index + 1].part))}
          />
        );
      })}
    </Cover>
  );
}

/** One row's chat. It stays mounted, so coming back shows this thread, not another's. */
function PartChat({ part, index, total, shown, last, name, recipe, parts, cost, ownChat, onBack, onNext }: {
  part: SetupPart;
  index: number;
  total: number;
  shown: boolean;
  last: boolean;
  name: string;
  recipe: HostRecipe;
  parts: SetupPart[];
  cost: import("@/services/api/hostSetup").ChatCost | null;
  ownChat: OwnChat | null;
  onBack: () => void;
  onNext: () => void;
}) {
  return (
    <div data-part-chat={part.part} className={shown ? "flex min-h-0 flex-1 flex-col" : "hidden"}>
      <FrameLead.Provider value={<PartBubble part={part} />}>
        <FrameBar.Provider value={(stepBack) => (
          <TopBar
            circle={<LetterCircle id={`part-${part.part}`} name={part.title} size={36} />}
            title={part.title}
            subtitle={W.placeInList(index + 1, total)}
            onBack={() => (stepBack ? stepBack() : onBack())}
            right={(
              <button type="button" data-part-next="" onClick={onNext} className="min-h-11 px-3 text-[15px] font-semibold text-foreground">
                {last ? W.done : W.next}
              </button>
            )}
          />
        )}>
          <HostSetup
            name={name}
            recipe={recipe}
            parts={{ line: null, parts }}
            cost={cost}
            ownChat={ownChat}
            part={part.part}
            onClose={onBack}
            onDone={onNext}
          />
        </FrameBar.Provider>
      </FrameLead.Provider>
    </div>
  );
}
