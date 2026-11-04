// @vitest-environment jsdom
/*
STORY    As a speaker, I want each slide I speak to drawn as one clear idea,
         and my helper words never pushed off the screen by it, so that I
         know what to say and still see my own words.
OUTCOME
  O1  The first Take's questions are posters that fill the slide's space,
      each with its small label (backend N462).
  O2  The default presentation is the same poster: it fills the space when
      the Take has no helper words; with helper words it keeps its 16:9 box
      and the helper words are there under it (Never 5).
  O3  An answer to someone's question is the poster, "{name} asks" as its
      label (backend N441 item 7, N462).
  O4  An uploaded deck is drawn as itself, never as the poster.
PROVES   O1 -> "the first Take's questions are tall posters with their labels"
         O2 -> "the default presentation is the poster and gives way to helper words"
         O3 -> "an answer's question is the poster with whose question it is"
         O4 -> "an uploaded deck is never the poster"
WHY      Founder 2026-11-04: "the slides are perfect lock them", "update the
         default presentation and keep this formating for any presentation
         that comes from the questions to the specialist" (backend N462).
*/
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import RecordingRoadmap, { stageLook } from "./RecordingRoadmap";
import { DEFAULT_DECK } from "@/lib/willab/defaultDeck";

let root: Root;
let host: HTMLDivElement;

beforeEach(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  host = document.createElement("div");
  document.body.appendChild(host);
  act(() => {
    root = createRoot(host);
  });
});

afterEach(() => {
  act(() => root.unmount());
  host.remove();
});

const FIRST_TAKE = [
  { title: "What do you know better than most people you meet?", body: "The thing people come to you for." },
  { title: "What could you teach someone in five minutes that would save them a year?", body: "Something you learned the hard way." },
  { title: "Who would be glad you told them?", body: "Picture one person: a colleague, a customer, a friend." },
  { title: "When did it make a difference? Take us to that day.", body: "Where you were, what happened, what changed." },
  { title: "If they remember one sentence from you, what should it be?", body: "Say it the way you'll say it." },
];

function show(slides: { title: string; body: string }[], roots: { slideIndex: number; text: string }[] = [], asks: string | null = null) {
  act(() =>
    root.render(
      createElement(RecordingRoadmap, {
        slides: slides as never[],
        presentationRef: null,
        currentSlide: 0,
        roots: roots.map((r) => ({ ...r, type: "neutral" as const })) as never[],
        onSlideChange: () => undefined,
        strip: null,
        onFinish: () => undefined,
        asks,
      }),
    ),
  );
}

const poster = () => host.querySelector("[data-slide-poster]");

describe("the slide on the recording screen", () => {
  it("the first Take's questions are tall posters with their labels", () => {
    show(FIRST_TAKE);
    expect(poster()?.hasAttribute("data-slide-tall")).toBe(true);
    expect(poster()?.querySelector("[data-slide-kicker]")?.textContent).toBe("Your field");
    expect(poster()?.querySelector("h3")?.textContent).toBe(FIRST_TAKE[0].title);
    expect(poster()?.textContent).toContain("The thing people come to you for.");
  });

  it("the default presentation is the poster and gives way to helper words", () => {
    show([...DEFAULT_DECK]);
    expect(poster()?.hasAttribute("data-slide-tall")).toBe(true);
    expect(poster()?.querySelector("h3")?.textContent).toBe("Opening");

    show([...DEFAULT_DECK], [{ slideIndex: 0, text: "Start with who pays" }]);
    expect(poster()).not.toBeNull();
    expect(poster()?.hasAttribute("data-slide-tall")).toBe(false);
    expect(host.textContent).toContain("Start with who pays");
  });

  it("an answer's question is the poster with whose question it is", () => {
    show([{ title: "Is the scalp scrub good for dry hair?", body: "" }], [], "Sarah");
    expect(poster()?.querySelector("[data-slide-kicker]")?.textContent).toBe("Sarah asks");
    expect(poster()?.querySelector("h3")?.textContent).toBe("Is the scalp scrub good for dry hair?");
  });

  it("an uploaded deck is never the poster", () => {
    expect(stageLook([...DEFAULT_DECK], "https://example.com/deck.pdf", "Sarah", [])).toEqual({ poster: false, tall: false });
    expect(stageLook([{ title: "Our Q3 numbers", body: "" }], null, null, [])).toEqual({ poster: false, tall: false });
  });
});
