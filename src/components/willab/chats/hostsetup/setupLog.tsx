"use client";

import { W } from "./hostSetupCopy";
import { Mine, Say } from "./SetupBits";

/* -------------------------------------------------------------------------- */
/*  The setup read as a chat (backend N647 item 9): each step answered stays  */
/*  above the one on show, Will's lines as his bubbles and the answer as the  */
/*  person's own, whether tapped or typed. What a tap answered is read from   */
/*  the screen it was tapped on, as the person saw it: the value kept, the    */
/*  choice picked, the ticks joined with " · ", or the button's own words.   */
/* -------------------------------------------------------------------------- */

/** One step answered: Will's lines on it and the person's answer. */
export type Said = { will: string[]; me: string };

/** Taps that answer nothing: they change the screen on show, or open the
 *  typing, whose words are the answer. */
const NOT_ANSWERS = new Set<string>([W.change, W.typeOwn, W.answer, W.startAgain, W.backPlain]);

const text = (el: Element | null | undefined) => (el?.textContent ?? "").trim();
const outsideHistory = (el: Element) => !el.closest("[data-setup-history]");

/** Will's lines on the screen on show: not those of the steps above it, nor
 *  a line shown as the thing to keep (the hello in its card). */
export function willLines(screen: Element): string[] {
  return [...screen.querySelectorAll("[data-will-line]")]
    .filter((el) => outsideHistory(el) && !el.closest("[data-setup-card], [data-setup-value]"))
    .map(text)
    .filter(Boolean);
}

/** What the value kept reads: chips joined, a card's own words, or as shown. */
function valueOf(value: Element): string {
  const chips = [...value.querySelectorAll("[data-chip]")].map(text);
  if (chips.length) return chips.join(" · ");
  const card = value.querySelector("[data-setup-card]");
  if (card) return text(card.querySelector("[data-will-line]") ?? card.querySelector("b") ?? card);
  return text(value);
}

/** What a tap answered on `screen`, or null for a tap that answers nothing
 *  (Change, a tick, the bar's back arrow). */
export function answerOf(screen: Element, button: HTMLElement): string | null {
  if (button.closest("[data-one-top-bar], [data-setup-history]")) return null;
  if (button.getAttribute("role") === "checkbox") return null;
  const label = text(button);
  if (NOT_ANSWERS.has(label)) return null;
  const mine = (sel: string) => [...screen.querySelectorAll(sel)].filter(outsideHistory);
  if (label === W.keep) {
    const value = mine("[data-setup-value]")[0];
    if (value) return valueOf(value);
    const cards = mine("[data-setup-card] b").map(text);
    return cards.length ? cards.join(" · ") : label;
  }
  if (label === W.done) {
    const ticked = mine('[role="checkbox"][aria-checked="true"] b').map(text);
    if (ticked.length) return ticked.join(" · ");
  }
  // A choice: its title, not the line under it.
  const title = button.closest("[data-host-foot]") ? null : button.querySelector("b");
  return title ? text(title) : label;
}

/** The steps answered, above the one on show. */
export function SetupHistory({ log }: { log: readonly (Said | null)[] }) {
  const said = log.filter((s): s is Said => s !== null);
  if (!said.length) return null;
  return (
    <div data-setup-history="" className="flex flex-col gap-3">
      {said.map((s, k) => (
        <div key={k} data-setup-said="" className="flex flex-col gap-3">
          {s.will.map((line, n) => <Say key={n}>{line}</Say>)}
          <Mine>{s.me}</Mine>
        </div>
      ))}
    </div>
  );
}
