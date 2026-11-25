"use client";

import { createContext, forwardRef, useContext, useEffect, useId, useRef, useState, type HTMLAttributes, type ReactNode } from "react";
import { PanelLeft, PanelLeftClose } from "lucide-react";
import Logo from "@/components/Logo";
import { DashboardAccountMenu } from "@/components/dashboard/DashboardHeader";
import { useUiLocale } from "@/components/ui/UiLocaleProvider";
import { uiText } from "@/lib/uiLocale";
import DumpPullBar from "../DumpPullBar";
import { ChatArtifactScope } from "./ChatArtifact";

const WorkspaceSidebar = createContext<{ needsSpace: boolean; show: () => void } | null>(null);

/** Whether the workspace header needs room for its top-left sidebar icon. */
export function useWorkspaceSidebar() {
  return useContext(WorkspaceSidebar);
}

/** The conversation scrolls inside the workspace, independently of its composer. */
export const ChatScroll = forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement>>(function ChatScroll(
  { className = "", ...props }, ref,
) {
  return <div {...props} ref={ref} data-conversation-scroll
    className={`scrollbar-none flex min-h-0 min-w-0 flex-1 flex-col overflow-y-auto overflow-x-hidden overscroll-contain ${className}`} />;
});

export default function ChatWorkspace({ sidebar, viewKey, suspended = false, children }: {
  sidebar: ReactNode;
  viewKey: string;
  suspended?: boolean;
  children: ReactNode;
}) {
  const locale = useUiLocale();
  const [desktop, setDesktop] = useState(false);
  const [desktopOpen, setDesktopOpen] = useState(true);
  const [mobileOpen, setMobileOpen] = useState(false);
  const id = useId();
  const trigger = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    const media = window.matchMedia?.("(min-width: 768px)");
    if (!media) return;
    const sync = () => setDesktop(media.matches);
    sync();
    media.addEventListener("change", sync);
    return () => media.removeEventListener("change", sync);
  }, []);
  const drawer = !desktop && mobileOpen && !suspended;
  const open = desktop ? desktopOpen : drawer;
  const Icon = open ? PanelLeftClose : PanelLeft;
  const label = uiText(locale, open ? "closeChatSidebar" : "openChatSidebar");
  const closeDrawer = () => {
    setMobileOpen(false);
    trigger.current?.focus({ preventScroll: true });
  };
  useEffect(() => {
    setMobileOpen(false);
    if (document.activeElement?.closest("[data-chat-workspace] > aside") && !desktop) {
      trigger.current?.focus({ preventScroll: true });
    }
  }, [desktop, suspended, viewKey]);

  return (
    <div data-chat-workspace className="relative isolate flex h-full min-h-0 w-full flex-1 bg-background"
      onKeyDown={(event) => {
        if (drawer && event.key === "Escape" && event.currentTarget.contains(event.target as Node)) closeDrawer();
      }}>
      {!suspended ? <button ref={trigger} type="button" aria-label={label} title={label}
        aria-expanded={open} aria-controls={id}
        className="absolute left-2 top-[calc(env(safe-area-inset-top)+8px)] z-[47] grid size-11 place-items-center rounded-lg text-muted-foreground hover:bg-accent hover:text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring"
        onClick={() => desktop ? setDesktopOpen(!desktopOpen) : drawer ? closeDrawer() : setMobileOpen(true)}>
        <Icon size={21} strokeWidth={1.7} aria-hidden />
      </button> : null}
      {drawer ? <div aria-hidden onClick={closeDrawer}
        className="absolute inset-0 z-[45] bg-black/30 md:hidden" /> : null}
      <aside id={id} aria-label={uiText(locale, "chatsNavigation")} aria-hidden={!open || suspended || undefined}
        ref={(element) => { element?.toggleAttribute("inert", suspended); }}
        onClick={(event) => {
          if (drawer && event.target instanceof Element && event.target.closest('button[aria-current="page"]')) closeDrawer();
        }}
        className={`${open ? "flex" : "hidden"} absolute inset-y-0 left-0 z-[46] min-h-0 w-[min(17rem,calc(100%_-_2.75rem))] shrink-0 flex-col border-r border-border bg-background pt-[env(safe-area-inset-top)] md:relative md:z-auto md:w-[252px] md:bg-muted/35`}>
        <DumpPullBar>
          <div className="flex h-[60px] shrink-0 items-center pl-[57px] pr-3"><Logo /></div>
        </DumpPullBar>
        {sidebar}
        <div className="shrink-0 border-t border-border px-3 py-2 pb-[max(8px,env(safe-area-inset-bottom))]">
          <DashboardAccountMenu above />
        </div>
      </aside>
      <div data-chat-main className="relative flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden"
        aria-hidden={drawer || undefined} ref={(element) => { element?.toggleAttribute("inert", drawer); }}>
        <WorkspaceSidebar.Provider value={{ needsSpace: !open && !suspended, show: () => desktop ? setDesktopOpen(true) : setMobileOpen(true) }}>
          <ChatArtifactScope.Provider value={viewKey}>{children}</ChatArtifactScope.Provider>
        </WorkspaceSidebar.Provider>
      </div>
    </div>
  );
}
