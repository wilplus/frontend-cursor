"use client";

import { useEffect, useRef, useState, type ComponentPropsWithoutRef, type ReactNode } from "react";
import { BarBox, ChatBarRow } from "@/components/willab/chats/ChatBar";
import { cn } from "@/lib/utils";
import { answerHelp, type HelpStep } from "./help";

type FrameProps = ComponentPropsWithoutRef<"div"> & {
  screen: HelpStep;
  help?: HelpStep;
  kicker?: string;
  foot?: ReactNode;
  wide?: boolean;
};

/** A new step opens at the top with its own question thread. */
export function Frame({ screen, help = screen, ...props }: FrameProps) {
  return <Conversation key={`${screen}/${help}`} screen={screen} help={help} {...props} />;
}

function Conversation({ screen, help = screen, kicker, title, children, foot, wide = false, ...attributes }: FrameProps) {
  const width = wide ? "max-w-5xl" : screen === "ai" ? "" : "max-w-3xl";
  const scroller = useRef<HTMLDivElement>(null);
  const [turns, setTurns] = useState<{ question: string; answer: string; topic: number }[]>([]);

  useEffect(() => {
    const node = scroller.current;
    if (node && turns.length > 0) node.scrollTop = node.scrollHeight;
  }, [turns]);

  const ask = async (words: string) => {
    const question = words.trim();
    if (!question) return false;
    setTurns((current) => [
      ...current,
      { question, ...answerHelp(question, help, current.at(-1)?.topic ?? -1) },
    ]);
    return true;
  };

  return (
    <div {...attributes} data-experiments="" data-exp-screen={screen} className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
      <div ref={scroller} data-experiment-thread="" className="no-scrollbar min-h-0 flex-1 overflow-x-hidden overflow-y-auto overscroll-contain">
        <div className={`mx-auto flex w-full ${width} flex-col gap-3 px-4 py-4`}>
          {kicker || title ? (
            <div className="flex flex-col gap-1">
              {kicker ? <p className="m-0 text-[14px] text-muted-foreground">{kicker}</p> : null}
              {title ? <h2 className="m-0 text-[20px] font-semibold leading-snug">{title}</h2> : null}
            </div>
          ) : null}
          {children}
          <div role="log" aria-label="Questions about this step" className="flex flex-col gap-2 empty:hidden">
            {turns.map(({ question, answer }, index) => (
              <div key={index} className="flex flex-col gap-2">
                <Bubble mine>{question}</Bubble>
                <Bubble>{answer}</Bubble>
              </div>
            ))}
          </div>
        </div>
      </div>
      {foot ? <div className={`mx-auto w-full ${width} shrink-0 px-4 pt-2`}>{foot}</div> : null}
      <ChatBarRow data-experiment-composer="" className={`mx-auto w-full ${width}`}>
        <BarBox hint="Ask a question" onSend={ask} />
      </ChatBarRow>
    </div>
  );
}

export function Bubble({ mine = false, className, ...props }: ComponentPropsWithoutRef<"div"> & { mine?: boolean }) {
  return (
    <div
      {...props}
      data-row={mine ? "me" : "app"}
      data-bubble=""
      className={cn(
        "min-w-0 max-w-[min(88%,38rem)] self-start whitespace-pre-wrap break-words rounded-2xl px-4 py-3 text-[16px] leading-relaxed",
        mine ? "ml-auto bg-primary text-primary-foreground" : "bg-muted text-foreground",
        className,
      )}
    />
  );
}

export function choiceBubble(selected: boolean) {
  return cn(
    "min-h-11 max-w-full break-words rounded-full border-[1.5px] border-primary px-4 py-2 text-[15px] font-semibold leading-snug disabled:opacity-50",
    selected ? "bg-primary text-primary-foreground" : "bg-background text-primary",
  );
}

export function ActionPair({ name, no, yes, onNo, onYes }: {
  name: string;
  no: string;
  yes: string;
  onNo: () => void;
  onYes: () => void;
}) {
  const one = (label: string, go: boolean, onClick: () => void) => (
    <button
      type="button"
      data-choice={go ? "yes" : "no"}
      onClick={onClick}
      className={choiceBubble(go)}
    >
      {label}
    </button>
  );
  return (
    <div data-pair={name} className="flex flex-wrap justify-end gap-2">
      {one(no, false, onNo)}
      {one(yes, true, onYes)}
    </div>
  );
}

export function ChoicePair({ name, options, value, onPick }: {
  name: string;
  options: { value: string; label: string; disabled?: boolean }[];
  value?: string;
  onPick: (value: string) => void;
}) {
  return (
    <div data-pair={name} className="flex flex-wrap justify-end gap-2">
      {options.map((option) => {
        const on = value === option.value;
        return (
          <button
            key={option.value}
            type="button"
            data-choice={option.value}
            aria-pressed={on}
            disabled={option.disabled}
            onClick={() => onPick(option.value)}
            className={choiceBubble(on)}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

export function Note({ children }: { children: string }) {
  return <Bubble>{children}</Bubble>;
}
