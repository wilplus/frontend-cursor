/* -------------------------------------------------------------------------- */
/*  THE OFFSETS ARE THE WHOLE POINT                                            */
/*                                                                            */
/*  RootPhraseSpan is {text, start, end} and the backend reads those offsets   */
/*  literally against the RAW draft — the one carrying `**bold**` and legacy   */
/*  `==x==`. A tokenizer that measured the displayed string would be short by  */
/*  every marker character before it, and every span on an emphasised          */
/*  paragraph would land on the wrong words. Silently: the offsets stay in     */
/*  range and the text still looks plausible.                                  */
/*                                                                            */
/*  So the emphasised cases below are not edge cases. They are the reason this */
/*  module exists.                                                            */
/* -------------------------------------------------------------------------- */
import { describe, expect, it } from "vitest";

import {
  nextSelection,
} from "./phraseTokens";

describe("at most four words (founder lock 2026-09-30, B3)", () => {

  it("one, two, three, four taps pick four words; the fifth does nothing", () => {
    let run = nextSelection(null, 2);
    run = nextSelection(run, 3);
    run = nextSelection(run, 4);
    run = nextSelection(run, 5);
    expect(run).toEqual({ from: 2, to: 5 });
    expect(nextSelection(run, 6)).toBe(run);
    expect(nextSelection(run, 1)).toBe(run);
  });
});
