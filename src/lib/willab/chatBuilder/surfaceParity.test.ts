// @vitest-environment jsdom
/*
STORY    As the founder, I want Artur's chat, built from the document, to
         meet a speaker with the same lines, the same walk order and the
         same bar as the speaking coach already does.
OUTCOME
  O1  The document's lines, the practise taps and the three walks match
      the signed walk. A missing line is a gap, not a pass.
  O2  They send is a recording and typing. Nothing asked is the box. The
      chat asking records. A photo asked is Add a photo. Thanks stays off
      because typing is on.
PROVES   O1 -> "the document matches the speaking coach line for line"
         O2 -> "They send puts the box, the recorder and Add a photo in the right states"
*/
import { readFileSync } from "node:fs";
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it } from "vitest";
import ProcessingWait from "@/components/willab/ProcessingWait";
import IdealTextHeading from "@/components/willab/IdealTextHeading";
import { faceFromDefinition, parityGaps } from "./surfaceParity";
import { idealEmptyName, processingLabels, recordLabel, tryCopy } from "./screenCopy";
import { speakingCoachSeed } from "./seed";

describe("speaking coach parity", () => {
  it("the document matches the speaking coach line for line", () => {
    expect(parityGaps(speakingCoachSeed())).toEqual([]);
  });

  it("They send puts the box, the recorder and Add a photo in the right states", () => {
    const face = faceFromDefinition(speakingCoachSeed());
    expect(face.chat.send).toEqual(["rec", "text"]);
    expect(face.bars.nothing).toEqual({ middle: "ask-box", plus: ["Record your question"], thanks: false });
    expect(face.bars.asks.middle).toBe("record-answer");
    expect(face.bars.asks.plus).toEqual(["Type your answer"]);
    expect(face.bars.photo.middle).toBe("add-photo");
    expect(face.chat.hello).toBe("Hi. Record a short talk, and I'll tell you what worked.");
    expect(face.chat.questions.map((q) => q.q)).toEqual([
      "What talk are you getting ready for?",
      "Who will be listening?",
      "What is the one thing they should remember?",
    ]);
  });

  it("the wait, the record button, Ideal Text and the tries render the same words", () => {
    const seed = speakingCoachSeed();
    const host = document.createElement("div");
    document.body.appendChild(host);
    const root = createRoot(host);
    act(() => {
      root.render(createElement("div", null,
        createElement(ProcessingWait),
        createElement(ProcessingWait, { labels: processingLabels(seed) }),
        createElement(IdealTextHeading, { title: null, status: null }),
        createElement("p", { "data-rec": "" }, recordLabel(null, false)),
        createElement("p", { "data-rec-doc": "" }, recordLabel(seed, false)),
        createElement("p", { "data-landed": "" }, tryCopy(null).landed),
        createElement("p", { "data-landed-doc": "" }, tryCopy(seed).landed),
      ));
    });
    const labels = [...host.querySelectorAll("[data-recording-analysis], [data-wait-label], [data-analysis-label]")];
    const texts = [...host.querySelectorAll("p, span, h1, h2")].map((el) => el.textContent);
    expect(texts.filter((t) => t === "Processing your recording").length).toBeGreaterThanOrEqual(2);
    expect(host.textContent).toContain(idealEmptyName(seed));
    expect(host.querySelector("[data-rec]")?.textContent).toBe(host.querySelector("[data-rec-doc]")?.textContent);
    expect(host.querySelector("[data-landed]")?.textContent).toBe(host.querySelector("[data-landed-doc]")?.textContent);
    expect(labels.length + texts.length).toBeGreaterThan(0);
    act(() => root.unmount());
    host.remove();
  });

  it("the fixture is the seed a host applies", () => {
    const fixture = JSON.parse(readFileSync("docs/chat-builder/arturs-chat-speaking-coach.json", "utf8"));
    expect(fixture).toEqual(speakingCoachSeed());
  });
});
