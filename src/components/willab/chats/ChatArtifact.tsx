"use client";

import {
  createContext, useCallback, useContext, useEffect, useId, useRef, useState,
  type ComponentPropsWithoutRef, type ReactNode, type Ref,
} from "react";
import { ChevronRight, ChevronsUp } from "lucide-react";
import { useUiLocale } from "@/components/ui/UiLocaleProvider";
import { cn } from "@/lib/utils";

/** Covers a conversation that stays mounted while a neighbour opens. */
export const ChatArtifactScope = createContext("");

export function ChatArtifactPreview({ title, preview, buttonRef, className, ...button }: {
  title: string;
  preview?: string | null;
  buttonRef?: Ref<HTMLButtonElement>;
} & Omit<ComponentPropsWithoutRef<"button">, "children" | "title">) {
  return (
    <button {...button} ref={buttonRef} type="button" data-chat-artifact-preview aria-expanded={false}
      className={cn("mr-auto grid min-h-11 w-full max-w-[440px] grid-cols-[minmax(0,1fr)_auto] items-center gap-2 rounded-xl border border-border bg-background px-3 py-2 text-left hover:bg-accent", className)}>
      <span className="min-w-0">
        <span className="block break-words text-[14px] font-semibold leading-snug">{title}</span>
        {preview ? <span className="block truncate text-[13px] text-muted-foreground">{preview}</span> : null}
      </span>
      <ChevronRight className="size-4 text-muted-foreground" aria-hidden />
    </button>
  );
}

function ArtifactSections({ moment, intervention, output }: {
  moment?: ReactNode; intervention?: ReactNode; output?: ReactNode;
}) {
  const polish = useUiLocale() === "pl";
  return (
    <>
      {moment ? <section data-artifact-section="moment" aria-label="Moment" className="min-w-0">{moment}</section> : null}
      {intervention ? <section data-artifact-section="intervention" aria-label={polish ? "Kolejny krok" : "Next step"} className="min-w-0">{intervention}</section> : null}
      {output ? <section data-artifact-section="output" aria-label={polish ? "Wynik" : "Output"} className="min-w-0 border-t border-border pt-2 first:border-t-0 first:pt-0">{output}</section> : null}
    </>
  );
}

export function ChatArtifactPanel({
  moment, intervention, output, footer, onMinimise, hideMinimise, panelRef, className, ...article
}: {
  moment?: ReactNode;
  intervention?: ReactNode;
  output?: ReactNode;
  footer?: ReactNode;
  onMinimise: () => void;
  hideMinimise?: boolean;
  panelRef?: Ref<HTMLElement>;
} & Omit<ComponentPropsWithoutRef<"article">, "children">) {
  const locale = useUiLocale();
  const current = useRef<HTMLElement | null>(null);
  const setPanel = useCallback((element: HTMLElement | null) => {
    if (!element) current.current?.querySelectorAll<HTMLMediaElement>("audio, video").forEach((media) => {
      if (!media.paused) media.pause();
    });
    current.current = element;
    if (typeof panelRef === "function") panelRef(element);
    else if (panelRef) panelRef.current = element;
  }, [panelRef]);
  return (
    <article {...article} ref={setPanel} tabIndex={-1} data-chat-artifact-open
      className={cn("mr-auto flex w-full max-w-[440px] min-w-0 flex-col gap-2.5 border-l border-border pl-3 text-[15px] leading-relaxed", className)}>
      <ArtifactSections moment={moment} intervention={intervention} output={output} />
      {footer}
      {!hideMinimise ? <button type="button"
        className="inline-flex min-h-11 w-fit items-center gap-1.5 rounded-md px-1 text-[13px] text-muted-foreground hover:bg-accent hover:text-foreground"
        onClick={onMinimise}>
        <ChevronsUp className="size-3.5" aria-hidden />{locale === "pl" ? "Zminimalizuj" : "Minimise"}
      </button> : null}
    </article>
  );
}

export default function ChatArtifact({ title, preview, moment, intervention, output, hideMinimise, onOpenChange }: {
  title: string;
  preview?: string | null;
  moment?: ReactNode;
  intervention?: ReactNode;
  output?: ReactNode;
  hideMinimise?: boolean;
  onOpenChange?: (open: boolean) => void;
}) {
  const scope = useContext(ChatArtifactScope);
  const [open, setOpen] = useState(false);
  const id = useId();
  const panel = useRef<HTMLElement>(null);
  const button = useRef<HTMLButtonElement>(null);
  const restoreFocus = useRef(false);
  const notify = useRef(onOpenChange);
  notify.current = onOpenChange;
  useEffect(() => {
    setOpen(false);
    notify.current?.(false);
  }, [scope]);
  useEffect(() => {
    if (open) panel.current?.focus({ preventScroll: true });
    else if (restoreFocus.current) {
      restoreFocus.current = false;
      button.current?.focus({ preventScroll: true });
    }
  }, [open]);

  if (!moment && !intervention && !output) return null;
  const toggle = (next: boolean) => {
    restoreFocus.current = !next;
    setOpen(next);
    notify.current?.(next);
  };
  return open ? <ChatArtifactPanel id={id} aria-label={title} panelRef={panel}
    moment={moment} intervention={intervention} output={output}
    hideMinimise={hideMinimise} onMinimise={() => toggle(false)} /> :
    <ChatArtifactPreview title={title} preview={preview} buttonRef={button} onClick={() => toggle(true)} />;
}
