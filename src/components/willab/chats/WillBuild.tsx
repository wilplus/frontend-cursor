"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { Link as LinkIcon } from "lucide-react";
import { useBackDismiss } from "../useBackDismiss";
import { useUserProfile } from "../useUserProfile";
import { LetterCircle } from "./ChatList";
import { OwnAvatar } from "./hostsetup/ChatIconPicker";
import { copyText, publicChatHref, readOwnChat } from "@/lib/willab/chatBuilder/ownChat";
import { useLocalSetup } from "@/lib/willab/chatBuilder/localSetup";
import { readTalkDefinition, saveTalkCode } from "@/lib/willab/chatBuilder/talkDraft";
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
import VisitorTry from "./hostsetup/VisitorTry";
import { FrameBar, FrameLead } from "./hostsetup/SetupBits";
import { BarBox } from "@/components/willab/chats/ChatBar";

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

export function ShareOwnChat({ serverPath }: { serverPath?: string | null }) {
  const [copied, setCopied] = useState(false);
  const go = async () => {
    const href = publicChatHref(window.location.origin, readOwnChat().id, serverPath);
    await copyText(href);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2000);
    if (typeof navigator.share === "function") {
      try { await navigator.share({ url: href }); } catch { /* the person closed the sheet */ }
    }
  };
  return (
    <span className="relative z-30">
      <button type="button" aria-label="Share" data-share-chat="" onClick={() => void go()} className="pointer-events-auto relative z-30 flex h-11 w-11 items-center justify-center rounded-full text-foreground">
        <LinkIcon className="h-5 w-5" aria-hidden />
      </button>
      {copied ? <span role="status" data-link-copied="" className="fixed right-4 top-16 z-50 whitespace-nowrap rounded-full bg-foreground px-3 py-1.5 text-[13px] font-medium text-background">{W.linkCopied}</span> : null}
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
  const [table, setTable] = useState(false);
  const [visitor, setVisitor] = useState(false);
  const [seen, setSeen] = useState<string[]>([]);
  const { profile } = useUserProfile();
  const draft = useCoachDraft();
  const local = useLocalSetup();
  const own = setup?.own_chat ?? local?.own_chat ?? null;
  const name = own?.title ?? W.yourChatTitle;
  const recipe = setup?.recipe ?? (table ? local?.recipe ?? null : null);
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
    if (visitor) { setVisitor(false); return true; }
    if (talk) { setTalk(false); return true; }
    if (active !== null && tab === "chat") { setActive(null); return true; }
    if (table && !setup?.recipe) { setTable(false); return true; }
    return false;
  });
  const order = orderedParts(setup?.parts?.length ? setup.parts : (table ? local?.parts ?? [] : []));
  const openPart = (id: string) => {
    setSeen((was) => (was.includes(id) ? was : [...was, id]));
    setActive(id);
  };
  const closePart = () => setActive(null);
  // The header arrow leaves Build only from the list. A row's chat goes back
  // to that list, and so does the browser's Back (PartHistory).
  const rowOpen = active !== null && tab === "chat";
  const headerBack = () => leaveBuild({ visitor, talk, rowOpen, table, hasRecipe: Boolean(setup?.recipe), setVisitor, setTalk, closePart, setTable, onBack });
  return (
    <BuildScreen
      mode={mode}
      canTry={canTry}
      name={name}
      tools={tools}
      onBack={onBack}
      headerBack={headerBack}
      coachDoc={draft.doc}
      recipe={recipe}
      own={own}
      tab={tab}
      setTab={setTab}
      visitor={visitor}
      setVisitor={setVisitor}
      talk={talk}
      setTalk={setTalk}
      local={local}
      table={table}
      setTable={setTable}
      setup={setup}
      rowOpen={rowOpen}
      closePart={closePart}
      active={active}
      openPart={openPart}
      order={order}
      seen={seen}
      profileName={profile?.first_name ?? ""}
    />
  );
}

function leaveBuild(p: {
  visitor: boolean;
  talk: boolean;
  rowOpen: boolean;
  table: boolean;
  hasRecipe: boolean;
  setVisitor: (v: boolean) => void;
  setTalk: (v: boolean) => void;
  closePart: () => void;
  setTable: (v: boolean) => void;
  onBack: () => void;
}) {
  if (p.visitor) return p.setVisitor(false);
  if (p.talk) return p.setTalk(false);
  if (p.rowOpen) return p.closePart();
  if (p.table && !p.hasRecipe) return p.setTable(false);
  return p.onBack();
}

function BuildScreen(p: {
  mode: Mode;
  canTry: boolean;
  name: string;
  tools: ReactNode;
  onBack: () => void;
  headerBack: () => void;
  coachDoc: import("@/lib/willab/chatBuilder/types").CoachDefinition | null;
  recipe: HostRecipe | null;
  own: OwnChat | null;
  tab: Tab;
  setTab: (tab: Tab) => void;
  visitor: boolean;
  setVisitor: (v: boolean) => void;
  talk: boolean;
  setTalk: (v: boolean) => void;
  local: import("@/services/api/hostSetup").SetupRead | null;
  table: boolean;
  setTable: (v: boolean) => void;
  setup: import("@/services/api/hostSetup").SetupRead | null;
  rowOpen: boolean;
  closePart: () => void;
  active: string | null;
  openPart: (id: string) => void;
  order: SetupPart[];
  seen: string[];
  profileName: string;
}) {
  if (p.mode === "live" && p.canTry && p.recipe) return <LiveCover name={p.name} tools={p.tools} onBack={p.onBack} doc={p.coachDoc} recipe={p.recipe} own={p.own} />;
  if (p.tab === "models") return <Cover><BuildTop name={p.name} tools={p.tools} onBack={p.headerBack} tab={p.tab} setTab={p.setTab} /><BuildModels /></Cover>;
  const doc = readTalkDefinition();
  if (p.visitor && doc) return <Cover><VisitorTry name={p.name} doc={doc} sends={doc.chat.send} onBack={() => p.setVisitor(false)} /></Cover>;
  return (
    <Cover>
      <BuildTop name={p.name} tools={p.tools} onBack={p.headerBack} tab={p.tab} setTab={p.setTab} />
      {p.rowOpen ? <PartHistory onClose={p.closePart} /> : null}
      <div className={p.active ? "hidden" : "no-scrollbar flex min-h-0 flex-1 flex-col overflow-y-auto"}>
        {p.talk ? <TalkBuild onList={() => { p.setTalk(false); if (p.local) p.setTable(true); }} /> : (
          <WillNeedsYou
            page
            source={p.table && !p.setup?.recipe ? p.local : null}
            onPart={(part) => p.openPart(part.part)}
            onTalk={() => p.setTalk(true)}
            onTry={doc ? () => p.setVisitor(true) : undefined}
            onOpenChat={() => (p.local ? p.setTable(true) : p.setTalk(true))}
          />
        )}
      </div>
      {p.active === "code" ? <CodeChat onBack={p.closePart} /> : null}
      <PartChats p={p} />
    </Cover>
  );
}

function LiveCover({ name, tools, onBack, doc, recipe, own }: {
  name: string;
  tools: ReactNode;
  onBack: () => void;
  doc: import("@/lib/willab/chatBuilder/types").CoachDefinition | null;
  recipe: HostRecipe;
  own: OwnChat | null;
}) {
  const bar = (
    <TopBar circle={<OwnAvatar id={`own-${name}`} name={name} size={36} />} title={name} subtitle={W.youRunIt} onBack={onBack} right={tools} />
  );
  if (doc) return <Cover>{bar}<CoachLive doc={doc} /></Cover>;
  return <Cover><HostOwnChat key={name} name={name} recipe={live(recipe, own)} about={own?.about ?? []} onBack={onBack} bar={bar} /></Cover>;
}

function BuildTop({ name, tools, onBack, tab, setTab }: {
  name: string;
  tools: ReactNode;
  onBack: () => void;
  tab: Tab;
  setTab: (tab: Tab) => void;
}) {
  return (
    <div data-build-bar="" className="shrink-0 bg-background">
      <TopBar circle={<OwnAvatar id={`build-${name}`} name={name} size={36} />} title={name} subtitle={W.youRunIt} onBack={onBack} right={tools} />
      <Tabs tab={tab} onTab={setTab} />
    </div>
  );
}

function PartChats({ p }: { p: {
  order: SetupPart[];
  seen: string[];
  recipe: HostRecipe | null;
  active: string | null;
  setup: import("@/services/api/hostSetup").SetupRead | null;
  local: import("@/services/api/hostSetup").SetupRead | null;
  own: OwnChat | null;
  closePart: () => void;
  openPart: (id: string) => void;
  profileName: string;
} }) {
  return (
    <>
      {p.seen.map((id) => {
        const index = p.order.findIndex((part) => part.part === id);
        const part = p.order[index];
        if (!part || !p.recipe || part.part === "code") return null;
        const last = index === p.order.length - 1;
        const parts = (p.setup?.parts?.length ? p.setup.parts : p.local?.parts) ?? [];
        return (
          <PartChat
            key={id}
            part={part}
            index={index}
            total={p.order.length}
            shown={p.active === id}
            last={last}
            name={p.profileName}
            recipe={p.recipe}
            parts={parts}
            cost={p.setup?.cost ?? null}
            ownChat={p.own}
            onBack={p.closePart}
            onNext={() => (last ? p.closePart() : p.openPart(p.order[index + 1].part))}
          />
        );
      })}
    </>
  );
}

function CodeChat({ onBack }: { onBack: () => void }) {
  const [open, setOpen] = useState(false);
  return (
    <div data-part-chat="code" className="flex min-h-0 flex-1 flex-col">
      <TopBar circle={<LetterCircle id="part-code" name={W.codeTitle} size={36} />} title={W.codeTitle} subtitle="1 of 1" onBack={onBack} />
      <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-x-hidden px-4 py-4">
        <p className="m-0 text-[18px] font-semibold leading-snug">{W.codeAsk}</p>
        <div className="flex gap-2">
          <button type="button" className="h-[52px] min-w-11 flex-1 rounded-full border border-border text-[16px] font-medium" onClick={() => { saveTalkCode(""); onBack(); }}>No</button>
          <button type="button" className="h-[52px] min-w-11 flex-1 rounded-full bg-primary text-[16px] font-medium text-primary-foreground" onClick={() => setOpen(true)}>Yes</button>
        </div>
        {open ? <p className="m-0 text-[16px]">{W.codePaste}</p> : null}
      </div>
      {open ? (
        <div data-chat-bar="" className="flex min-h-[60px] shrink-0 items-center gap-1 p-2">
          <BarBox hint={W.codePaste} open grow onSend={async (words) => { saveTalkCode(words); onBack(); return true; }} />
        </div>
      ) : null}
    </div>
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
              <span className="relative z-30 flex items-center">
                <ShareOwnChat serverPath={ownChat?.link?.path} />
                <button type="button" data-part-next="" onClick={onNext} className="min-h-11 px-3 text-[15px] font-semibold text-foreground">
                  {last ? W.done : W.next}
                </button>
              </span>
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
