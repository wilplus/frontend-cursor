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
  canTap,
  nextSelection,
  selectionLength,
  HELPER_WORDS_MAX,
  phraseTokens,
  tokensWithinFragment,
  quoteSpan,
  selectionSpan,
} from "./phraseTokens";

const PLAIN = "The first one is retention, and it is the one that surprised us.";
const MARKED =
  "The first one is retention, and it is the one that **surprised us**.";

describe("phraseTokens", () => {
  it("returns one token per word a reader can see", () => {
    expect(phraseTokens(PLAIN).map((t) => t.text)).toEqual(PLAIN.split(" "));
  });

  it("never puts a marker character in a word", () => {
    const tokens = phraseTokens(MARKED);
    for (const token of tokens) {
      expect(token.text, token.text).not.toMatch(/[*=]/);
    }
    expect(tokens.map((t) => t.text)).toContain("surprised");
  });

  it("emits RAW-draft offsets, not displayed ones", () => {
    const tokens = phraseTokens(MARKED);
    const surprised = tokens.find((t) => t.text === "surprised")!;
    // The word starts AFTER the two asterisks, at its real index in the draft.
    expect(MARKED.slice(surprised.start, surprised.end)).toBe("surprised");
    expect(surprised.start).toBe(MARKED.indexOf("surprised"));
    // And that is NOT where it sits in the displayed string — which is exactly
    // the bug this guards: displayed is two characters earlier.
    expect(surprised.start).not.toBe(PLAIN.indexOf("surprised"));
  });

  it("keeps a word whole when a marker splits it in the source", () => {
    // `**sur**prised` is one word to a reader and two spans to the parser. A
    // speaker cannot tap half a word.
    const raw = "it **sur**prised us";
    const tokens = phraseTokens(raw);
    expect(tokens.map((t) => t.text)).toEqual(["it", "surprised", "us"]);
    // The span covers the WORD, starting at its first readable character —
    // the opening marker sits before it and belongs to no word.
    const word = tokens[1];
    expect(raw.slice(word.start, word.end)).toBe("sur**prised");
  });

  it("handles the legacy accent spelling too", () => {
    const raw = "that ==changed everything== for us";
    expect(phraseTokens(raw).map((t) => t.text)).toEqual([
      "that", "changed", "everything", "for", "us",
    ]);
  });

  it("is empty for an empty draft", () => {
    expect(phraseTokens("")).toEqual([]);
  });
});

describe("selectionSpan", () => {
  it("slices the RAW draft so text and offsets agree", () => {
    const tokens = phraseTokens(MARKED);
    const from = tokens.findIndex((t) => t.text === "surprised");
    const span = selectionSpan(MARKED, tokens, { from, to: from + 1 })!;
    expect(MARKED.slice(span.start, span.end)).toBe(span.text);
    // Markers land inside, because start/end index the same string. A span
    // whose text disagreed with its offsets would be a different phrase
    // depending on which field you trusted.
    expect(span.text).toBe("surprised us**.");
  });

  it("is null with nothing selected", () => {
    expect(selectionSpan(PLAIN, phraseTokens(PLAIN), null)).toBeNull();
  });

  it("survives a selection pointing past the tokens", () => {
    const tokens = phraseTokens(PLAIN);
    expect(selectionSpan(PLAIN, tokens, { from: 0, to: 999 })).toBeNull();
  });
});

describe("nextSelection: one tap, one word, one connected phrase (QA4 A, Q-B5 A)", () => {
  it("starts a run on the first tap", () => {
    expect(nextSelection(null, 3)).toEqual({ from: 3, to: 3 });
  });

  it("each tap beside the run adds one word, either side", () => {
    let run = nextSelection(null, 3);
    run = nextSelection(run, 4);
    expect(run).toEqual({ from: 3, to: 4 });
    run = nextSelection(run, 2);
    expect(run).toEqual({ from: 2, to: 4 });
    run = nextSelection(run, 5);
    expect(run).toEqual({ from: 2, to: 5 });
  });

  it("a tap on the first or last picked word takes it away", () => {
    expect(nextSelection({ from: 2, to: 5 }, 2)).toEqual({ from: 3, to: 5 });
    expect(nextSelection({ from: 2, to: 5 }, 5)).toEqual({ from: 2, to: 4 });
  });

  it("clears when the only selected word is tapped again", () => {
    expect(nextSelection({ from: 3, to: 3 }, 3)).toBeNull();
  });

  it("never breaks the phrase: an inner word or a far word does nothing", () => {
    const run = { from: 2, to: 5 };
    expect(nextSelection(run, 3)).toBe(run);
    expect(nextSelection(run, 4)).toBe(run);
    const short = { from: 2, to: 3 };
    expect(nextSelection(short, 9)).toBe(short);
    expect(nextSelection(short, 0)).toBe(short);
  });

  it("can only ever select one run, so the exactly-once rule holds", () => {
    let selection = nextSelection(null, 1);
    selection = nextSelection(selection, 2);
    selection = nextSelection(selection, 7);
    expect(selection).toEqual({ from: 1, to: 2 });
  });
});

describe("quoteSpan — the emphasis → lock promotion", () => {
  it("finds the emphasised words after the markers wrapped them", () => {
    // The speaker accepted `surprised us`; by lock time the draft carries
    // `**surprised us**`. Matching on the displayed text is what makes that
    // work without asking them again.
    const span = quoteSpan(MARKED, "surprised us")!;
    expect(span.start).toBe(MARKED.indexOf("surprised us"));
    expect(MARKED.slice(span.start, span.end)).toBe("surprised us");
  });

  it("finds a quote in a plain paragraph", () => {
    const span = quoteSpan(PLAIN, "surprised us")!;
    expect(PLAIN.slice(span.start, span.end)).toBe("surprised us");
  });

  it("refuses an ambiguous anchor rather than guessing", () => {
    const raw = "we shipped it, and then we shipped it again";
    expect(quoteSpan(raw, "we shipped it")).toBeNull();
  });

  it("is null for a quote that is not there", () => {
    expect(quoteSpan(PLAIN, "never said this")).toBeNull();
    expect(quoteSpan(PLAIN, "")).toBeNull();
    expect(quoteSpan("", "anything")).toBeNull();
  });
});


describe("tokensWithinFragment — orange lands inside what was asked about", () => {
  /* Founder 2026-09-17, locked: the rooting phrase is chosen inside "the
     whole fragment suggested for confidence judgement" — not the whole
     paragraph, and not only the words the speaker marked. */
  const DRAFT =
    "We started in a garage. Nobody believed the numbers. Then it changed.";
  const all = () => phraseTokens(DRAFT);

  it("offers only the words of the confident fragment", () => {
    const out = tokensWithinFragment(
      all(), DRAFT, "Nobody believed the numbers.",
    );
    expect(out.map((t) => t.text)).toEqual([
      "Nobody", "believed", "the", "numbers.",
    ]);
  });

  it("keeps each word pointing at where it really lives in the draft", () => {
    const out = tokensWithinFragment(all(), DRAFT, "believed the numbers");
    // OVERLAP, not containment: "numbers." is one token and the quote stops
    // before its full stop. Requiring the whole token to sit inside the
    // fragment would drop the last word of every fragment ending on
    // punctuation — which is most of them. The speaker taps WORDS.
    expect(DRAFT.slice(out[0].start, out[out.length - 1].end)).toBe(
      "believed the numbers.",
    );
  });

  it("shows the WHOLE paragraph rather than nothing when it cannot locate it", () => {
    // A fragment reworded since it was suggested must not dead-end the step:
    // the speaker would lose the orange phrase entirely. Narrowing improves
    // the choice; it is never a gate on it.
    expect(tokensWithinFragment(all(), DRAFT, "words never said").length)
      .toBe(all().length);
    expect(tokensWithinFragment(all(), DRAFT, null).length).toBe(all().length);
    expect(tokensWithinFragment(all(), DRAFT, "   ").length).toBe(all().length);
  });

  it("survives an applied emphasis having rewrapped the words", () => {
    // `**` moves every raw index after it; the readable text does not. The
    // fragment is located in the DISPLAYED text for exactly that reason.
    const bolded =
      "We started in a garage. Nobody **believed the numbers**. Then it changed.";
    const out = tokensWithinFragment(
      phraseTokens(bolded), bolded, "Nobody believed the numbers",
    );
    expect(out.map((t) => t.text)).toEqual([
      "Nobody", "believed", "the", "numbers.",
    ]);
  });
});

describe("at most four words (founder lock 2026-09-30, B3)", () => {
  it("the cap is four", () => {
    expect(HELPER_WORDS_MAX).toBe(4);
  });

  it("one, two, three, four taps pick four words; the fifth does nothing", () => {
    let run = nextSelection(null, 2);
    run = nextSelection(run, 3);
    run = nextSelection(run, 4);
    run = nextSelection(run, 5);
    expect(run).toEqual({ from: 2, to: 5 });
    expect(nextSelection(run, 6)).toBe(run);
    expect(nextSelection(run, 1)).toBe(run);
  });

  it("canTap greys exactly the words a tap cannot reach", () => {
    const one = { from: 4, to: 4 };
    expect(canTap(one, 3)).toBe(true);
    expect(canTap(one, 5)).toBe(true);
    expect(canTap(one, 6)).toBe(false);
    expect(canTap(one, 0)).toBe(false);
    // The selected word itself clears the run, so it is always reachable.
    expect(canTap(one, 4)).toBe(true);
    // With nothing selected every word starts a run.
    expect(canTap(null, 40)).toBe(true);
    // A full run: only its two ends can be tapped (to take them away).
    const full = { from: 0, to: 3 };
    expect(canTap(full, 0)).toBe(true);
    expect(canTap(full, 3)).toBe(true);
    expect(canTap(full, 1)).toBe(false);
    expect(canTap(full, 4)).toBe(false);
  });

  it("selectionLength counts the words in the run", () => {
    expect(selectionLength(null)).toBe(0);
    expect(selectionLength({ from: 3, to: 3 })).toBe(1);
    expect(selectionLength({ from: 0, to: 3 })).toBe(4);
  });
});
