/* -------------------------------------------------------------------------- */
/*  What Enter means inside a lane (founder 2026-09-18)                        */
/*                                                                            */
/*  A lane is six or eight screens asking for one thing each, and until now    */
/*  the only way past any of them was the mouse. Enter now does what the CTA   */
/*  does.                                                                     */
/*                                                                            */
/*  Kept pure and separate from LaneShell on purpose: every rule below is a    */
/*  case someone will hit on real hardware — an IME commit, a modifier, a      */
/*  focused button — and a rule you cannot unit-test is a rule that rots.      */
/* -------------------------------------------------------------------------- */

export interface EnterContext {
  key: string;
  shiftKey: boolean;
  altKey: boolean;
  metaKey: boolean;
  ctrlKey: boolean;
  /** True while an input method editor is mid-composition. */
  isComposing: boolean;
  /** Upper-case tag name of whatever has focus; "" when nothing does. */
  tagName: string;
  isContentEditable: boolean;
  /** The focused element handles Enter itself (the drawing box does). */
  ownsEnter: boolean;
}

/** True when this key press should move the lane on. */
export function enterAdvances(c: EnterContext): boolean {
  if (c.key !== "Enter" || c.altKey) return false;

  // A Polish, Japanese or Chinese author COMMITS a composition with Enter.
  // Advancing on that press eats the word and walks the screen at once.
  if (c.isComposing) return false;

  // The element asked for this key. Enter there means "draw", and the step
  // must not also move on underneath the request that just went out.
  if (c.ownsEnter) return false;

  // A focused button or link already fires on Enter natively. Advancing too
  // would do both things from one press — Skip AND Next, for instance.
  if (c.tagName === "BUTTON" || c.tagName === "A") return false;

  const modified = c.metaKey || c.ctrlKey;

  // A long text box keeps its newline: the author is writing a body, not
  // answering a question. The modifier is the deliberate way past it, and it
  // is the idiom the Lounge composer already uses (Lounge.tsx:1384).
  if (c.tagName === "TEXTAREA" || c.isContentEditable) return modified;

  if (c.shiftKey) return false;
  return true;
}
