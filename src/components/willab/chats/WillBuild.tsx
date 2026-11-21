"use client";

import { Fragment, useEffect, useRef, useState, type ReactNode } from "react";
import { Boxes, Check, ChevronDown, ChevronRight, Link as LinkIcon, List, MessageSquare, Play } from "lucide-react";
import { useBackDismiss } from "../useBackDismiss";
import { useUserProfile } from "../useUserProfile";
import { LetterCircle } from "./ChatList";
import { OwnAvatar } from "./hostsetup/ChatIconPicker";
import { copyText, publicChatHref, readOwnChat } from "@/lib/willab/chatBuilder/ownChat";
import { useLocalSetup } from "@/lib/willab/chatBuilder/localSetup";
import { readTalkDefinition, saveTalkCode, saveTalkStarters } from "@/lib/willab/chatBuilder/talkDraft";
import { markTileStep, useTileSteps, type TileId } from "@/lib/willab/chatBuilder/tileSteps";
import { LiveBuildSwitch, TopBar, BUILD_MODE_EVENT } from "./TopBar";
import type { HostRecipe, OwnChat, SetupPart } from "@/services/api/hostSetup";
import HostOwnChat from "./hostsetup/HostOwnChat";
import HostSetup from "./hostsetup/HostSetup";
import CoachLive from "./coachbuild/CoachLive";
import { useCoachDraft } from "@/lib/willab/chatBuilder/useCoachDraft";
import { W } from "./hostsetup/hostSetupCopy";
import { useKnownSetup } from "./hostsetup/hostSetupDoor";
import WillNeedsYou, { orderedParts, PartBubble } from "./hostsetup/WillNeedsYou";
import TalkBuild from "./hostsetup/TalkBuild";
import CodeStep from "./hostsetup/CodeStep";
import VisitorTry from "./hostsetup/VisitorTry";
import { FrameBar, FrameLead } from "./hostsetup/SetupBits";
import ChatIconPicker from "./hostsetup/ChatIconPicker";
import Experiments from "./experiments/AiDoor";

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

const TILE_ORDER: TileId[] = ["build", "settings", "test", "ai"];

const TILES: { id: TileId; word: string; Icon: typeof MessageSquare }[] = [
  { id: "build", word: W.tileBuild, Icon: MessageSquare },
  { id: "settings", word: W.tileSettings, Icon: List },
  { id: "test", word: W.tileTest, Icon: Play },
  { id: "ai", word: W.tileAi, Icon: Boxes },
];

/** A soft ring on Build until the talk is finished. The other tiles stay plain. */
const NEXT_RING = "shadow-[inset_0_0_0_2px_rgba(255,106,20,0.45),0_0_18px_rgba(255,106,20,0.18)]";

function BuildHome({ onOpen }: { onOpen: (id: TileId) => void }) {
  const steps = useTileSteps();
  return (
    <div data-build-home="" className="flex min-h-0 flex-1 items-center justify-center overflow-hidden px-4 py-4">
      <div className="flex h-full w-full flex-col items-stretch gap-1 md:h-auto md:w-[70%] md:flex-row md:items-center md:gap-2">
        {TILES.map(({ id, word, Icon }, index) => {
          const nextId = TILE_ORDER.find((tile) => !steps[tile]);
          const next = id === nextId;
          return (
            <Fragment key={id}>
            {index > 0 ? (
              <span data-tile-chevron="" className="flex shrink-0 items-center justify-center text-muted-foreground">
                <ChevronDown className="h-4 w-4 md:hidden" aria-hidden />
                <ChevronRight className="hidden h-4 w-4 md:block" aria-hidden />
              </span>
            ) : null}
            <button
              type="button"
              data-build-tile={id}
              data-tile-highlight={next ? "" : undefined}
              onClick={() => onOpen(id)}
              className={`relative flex min-h-0 w-full flex-1 flex-col items-center justify-center gap-3 rounded-2xl border border-border bg-background text-foreground md:aspect-square ${next ? NEXT_RING : ""}`}
            >
              {steps[id] ? (
                <span data-tile-tick={id} className="absolute right-2.5 top-2.5 flex h-5 w-5 items-center justify-center text-foreground">
                  <Check className="h-4 w-4" strokeWidth={2} aria-hidden />
                </span>
              ) : null}
              <Icon className="h-8 w-8" strokeWidth={1.5} aria-hidden />
              <span className="text-[16px] font-medium">{word}</span>
            </button>
            </Fragment>
          );
        })}
      </div>
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
  const aiBack = useRef<(() => boolean) | null>(null);
  const [active, setActive] = useState<string | null>(null);
  const [talk, setTalk] = useState(false);
  const [table, setTable] = useState(false);
  const [visitor, setVisitor] = useState(false);
  const [iconOpen, setIconOpen] = useState(false);
  const [seen, setSeen] = useState<string[]>([]);
  const { profile } = useUserProfile();
  const draft = useCoachDraft();
  const local = useLocalSetup();
  const own = setup?.own_chat ?? local?.own_chat ?? null;
  const name = own?.title ?? W.yourChatTitle;
  const recipe = setup?.recipe ?? (table ? local?.recipe ?? null : null);
  const canTry = setup?.can_try === true && recipe !== null;
  const mode: Mode = chosen ?? "build";
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
    if (tab === "models" && aiBack.current?.()) return true;
    if (tab === "models") { setTab("chat"); return true; }
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
  const headerBack = () => leaveBuild({ visitor, talk, rowOpen, table, models: tab === "models", aiBack: aiBack.current, hasRecipe: Boolean(setup?.recipe), setVisitor, setTalk, closePart, setTable, closeModels: () => setTab("chat"), onBack });
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
      onBindBack={(fn) => { aiBack.current = fn; }}
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
      iconOpen={iconOpen}
      setIconOpen={setIconOpen}
    />
  );
}

function leaveBuild(p: {
  visitor: boolean;
  talk: boolean;
  rowOpen: boolean;
  table: boolean;
  models: boolean;
  aiBack: (() => boolean) | null;
  hasRecipe: boolean;
  setVisitor: (v: boolean) => void;
  setTalk: (v: boolean) => void;
  closePart: () => void;
  setTable: (v: boolean) => void;
  closeModels: () => void;
  onBack: () => void;
}) {
  if (p.visitor) return p.setVisitor(false);
  if (p.talk) return p.setTalk(false);
  if (p.rowOpen) return p.closePart();
  if (p.models && p.aiBack?.()) return;
  if (p.models) return p.closeModels();
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
  onBindBack: (fn: (() => boolean) | null) => void;
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
  iconOpen: boolean;
  setIconOpen: (open: boolean) => void;
}) {
  if (p.mode === "live" && p.canTry && p.recipe) return <LiveCover name={p.name} tools={p.tools} onBack={p.onBack} doc={p.coachDoc} recipe={p.recipe} own={p.own} />;
  const doc = readTalkDefinition();
  const home = !p.talk && !p.table && !p.visitor && !p.rowOpen && p.tab !== "models";
  const top = (
    <BuildTop
      name={p.name}
      tools={p.tools}
      onBack={p.headerBack}
      onIcon={() => p.setIconOpen(!p.iconOpen)}
      iconOpen={home && p.iconOpen}
    />
  );
  if (p.tab === "models") return <Cover>{top}<Experiments onBindBack={p.onBindBack} /></Cover>;
  if (p.visitor && doc) {
    return (
      <Cover>
        <VisitorTry
          name={p.name}
          doc={doc}
          sends={doc.chat.send}
          onBack={() => p.setVisitor(false)}
          onWorks={() => { markTileStep("test", true); p.setVisitor(false); p.setTab("models"); }}
        />
      </Cover>
    );
  }
  if (p.visitor && p.recipe) {
    return (
      <Cover>
        <HostOwnChat name={p.name} recipe={live(p.recipe, p.own)} about={p.own?.about ?? []} onBack={() => p.setVisitor(false)} bar={top} />
      </Cover>
    );
  }
  if (p.visitor) {
    return (
      <Cover>
        {top}
        <p data-try-empty="" className="m-0 px-6 py-8 text-center text-[16px] leading-snug">{W.tryFirst}</p>
      </Cover>
    );
  }
  if (home) {
    return (
      <Cover>
        {top}
        <BuildHome onOpen={(id) => {
          p.setIconOpen(false);
          if (id === "build") p.setTalk(true);
          if (id === "settings") p.setTable(true);
          if (id === "test") p.setVisitor(true);
          if (id === "ai") p.setTab("models");
        }} />
      </Cover>
    );
  }
  return <BuildDesk p={p} top={top} doc={doc} />;
}

function BuildDesk({ p, top, doc }: {
  p: Parameters<typeof BuildScreen>[0];
  top: ReactNode;
  doc: import("@/lib/willab/chatBuilder/types").CoachDefinition | null;
}) {
  return (
    <Cover>
      {p.rowOpen ? null : top}
      {p.rowOpen ? <PartHistory onClose={p.closePart} /> : null}
      <div className={p.active ? "hidden" : `no-scrollbar flex min-h-0 flex-1 flex-col ${p.talk ? "overflow-hidden" : "overflow-y-auto"}`}>
        {p.talk ? (
          <TalkBuild
            onList={() => { p.setTalk(false); if (p.local) p.setTable(true); }}
            onTry={() => p.setVisitor(true)}
            onReady={() => { p.setTalk(false); p.setTable(true); }}
          />
        ) : (
          <>
            <WillNeedsYou
              page
              source={p.table && !p.setup?.recipe ? p.local : null}
              onPart={(part) => p.openPart(part.part)}
            />
            {p.table ? (
              <button type="button" data-looks-right="" className="mx-4 mb-4 min-h-11 rounded-full bg-primary px-4 text-[16px] font-medium text-primary-foreground" onClick={() => { markTileStep("settings", true); p.setTable(false); p.setVisitor(true); }}>Looks right</button>
            ) : null}
          </>
        )}
      </div>
      {p.active === "starters" ? (
        <StartersStep
          place={W.placeInList(Math.max(1, p.order.findIndex((part) => part.part === "starters") + 1), Math.max(1, p.order.length))}
          starters={(p.local?.recipe?.starters ?? p.setup?.recipe?.starters ?? doc?.chat.taps ?? []).slice(0, 3)}
          onBack={p.closePart}
          onSave={(lines) => { saveTalkStarters(lines); p.closePart(); }}
        />
      ) : null}
      {p.active === "code" ? (
        <CodeStep
          place={W.placeInList(Math.max(1, p.order.findIndex((part) => part.part === "code") + 1), Math.max(1, p.order.length))}
          onBack={p.closePart}
          onSave={(paste, line) => { saveTalkCode(paste, line); p.closePart(); }}
        />
      ) : null}
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

function BuildTop({ name, tools, onBack, onIcon, iconOpen }: {
  name: string;
  tools: ReactNode;
  onBack: () => void;
  onIcon: () => void;
  iconOpen: boolean;
}) {
  return (
    <div data-build-bar="" className="shrink-0 bg-background">
      <TopBar
        circle={(
          <button type="button" data-icon-open="" aria-label="Icon" aria-expanded={iconOpen} onClick={onIcon} className="rounded-full">
            <OwnAvatar id={`build-${name}`} name={name} size={36} />
          </button>
        )}
        title={name}
        subtitle={W.youRunIt}
        onBack={onBack}
        right={tools}
      />
      {iconOpen ? <div className="border-b border-border px-4 py-3"><ChatIconPicker name={name} /></div> : null}
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
        if (!part || !p.recipe || part.part === "code" || part.part === "starters") return null;
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

function StartersStep({ starters, place, onBack, onSave }: {
  starters: string[];
  place: string;
  onBack: () => void;
  onSave: (lines: string[]) => void;
}) {
  const [lines, setLines] = useState(starters.length ? starters : [""]);
  const [edit, setEdit] = useState<number | null>(null);
  const [draft, setDraft] = useState("");
  const save = (next: string[]) => {
    const clean = next.map((line) => line.trim()).filter(Boolean).slice(0, 3);
    setLines(clean);
    onSave(clean);
  };
  return (
    <div data-part-chat="starters" data-starters="" className="flex min-h-0 flex-1 flex-col">
      <TopBar circle={<LetterCircle id="part-starters" name="Questions people tap first" size={36} />} title="Questions people tap first" subtitle={place} onBack={onBack} />
      <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto px-4 py-4">
        {lines.map((line, index) => (
          <div key={`${line}-${index}`} className="flex items-center gap-2">
            <button type="button" data-starter={index} className="min-h-11 flex-1 rounded-2xl border border-border px-3 text-left text-[16px]" onClick={() => { setEdit(index); setDraft(line); }}>{line}</button>
            <button type="button" aria-label="Remove" className="min-h-11 px-2 text-[15px]" onClick={() => save(lines.filter((_, at) => at !== index))}>Remove</button>
          </div>
        ))}
        {lines.length < 3 ? (
          <button type="button" data-starter-add="" className="min-h-11 text-left text-[16px] font-medium text-primary" onClick={() => { setEdit(lines.length); setDraft(""); }}>Add one</button>
        ) : null}
        {edit !== null ? (
          <form className="flex gap-2" onSubmit={(event) => {
            event.preventDefault();
            const next = [...lines];
            next[edit] = draft;
            save(next);
            setEdit(null);
          }}>
            <input aria-label="Question" value={draft} onChange={(event) => setDraft(event.target.value)} className="h-11 min-w-0 flex-1 rounded-xl border border-border px-3 text-[16px]" />
            <button type="submit" className="min-h-11 px-3 text-[15px] font-semibold">Save</button>
          </form>
        ) : null}
      </div>
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
        <FrameBar.Provider value={(stepBack) => shown ? (
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
        ) : null}>
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
