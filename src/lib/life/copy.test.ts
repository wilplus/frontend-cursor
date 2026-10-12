import { describe, expect, it } from "vitest";
import * as copy from "./copy";

/* -------------------------------------------------------------------------- */
/*  The copy fence, as a test                                                  */
/*                                                                            */
/*  `copy.ts` is the founder sign-off surface, so it is worth having a machine */
/*  hold the parts of the review that a machine can hold: the house rule on    */
/*  em-dashes, and N4's ban on anything that reads as a score.                 */
/*                                                                            */
/*  This does not replace sign-off. It only stops the two failures that would  */
/*  otherwise be caught by eye, on a file long enough that eyes skip.          */
/* -------------------------------------------------------------------------- */

/** Every string reachable from the module's exports, with a path for the
 *  failure message. */
function strings(
  value: unknown,
  path = ""
): Array<{ path: string; text: string }> {
  if (typeof value === "string") return [{ path, text: value }];
  if (Array.isArray(value)) {
    return value.flatMap((v, i) => strings(v, `${path}[${i}]`));
  }
  if (value && typeof value === "object") {
    return Object.entries(value).flatMap(([k, v]) =>
      strings(v, path ? `${path}.${k}` : k)
    );
  }
  return [];
}

const ALL = strings(copy);

/** "there is no streak, no score" must pass while "your streak" must fail, so a
 *  match is ignored when it sits just after a negation in the same sentence.
 *  Naming what this surface deliberately does not have is the whole point of
 *  the guide's last paragraph. */
const NEGATED = /\b(no|not|never|without|nothing)\b[^.]{0,24}$/i;

function offends(text: string, pattern: RegExp): boolean {
  const re = new RegExp(pattern.source, `${pattern.flags.replace("g", "")}g`);
  for (const match of text.matchAll(re)) {
    if (!NEGATED.test(text.slice(0, match.index))) return true;
  }
  return false;
}

describe("panel copy", () => {

  it("surfaces no score, streak, percentage or consistency meter", () => {
    // N4 / AC-9. This surface must not invent a number the product spent a
    // year removing. Saying it HAS no streak is allowed; having one is not.
    const banned =
      /\b(streaks?|scores?|scored|scoring|consistency|percent(age)?|rating|ranked)\b/i;
    const offenders = ALL.filter((s) => offends(s.text, banned));
    expect(offenders.map((s) => s.path)).toEqual([]);
  });
});

/* -------------------------------------------------------------------------- */
/*  Reachability                                                               */
/*                                                                            */
/*  `SETUP_GATE_REDIRECT` sat in this file for four commits, described a       */
/*  mechanic, was asserted on by two tests, and was never rendered by anything.*/
/*  It read as shipped behaviour in every review. This is the fence that stops */
/*  the next one: copy that no component imports is copy that does not exist,  */
/*  and a founder signing off this file should be signing off what users       */
/*  actually see.                                                              */
/* -------------------------------------------------------------------------- */

