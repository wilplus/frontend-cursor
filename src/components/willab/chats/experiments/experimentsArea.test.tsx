// @vitest-environment jsdom
/*
STORY    A host opens Experiments and moves through a session without
         seeing a score or a hidden word.
OUTCOME
  O1  The screens follow the prompt file and stay free of hidden words.
PROVES   O1 -> "the experiment screens"
*/
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import AiDoor from "./AiDoor";
import Experiments from "./Experiments";
import { readInterventions, readTakes, resetExperimentStore } from "@/services/api/experiments";
import { loadPromptFile } from "@/lib/willab/experiments/promptsYaml";
import { leaksHiddenWord, optionLabel } from "@/lib/willab/experiments/words";
import promptText from "@/lib/willab/experiments/prompts_v1.yaml?raw";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const file = loadPromptFile(promptText);
const flush = () => act(async () => { await new Promise((resolve) => setTimeout(resolve, 0)); });

describe("the experiment screens", () => {
  let container: HTMLDivElement;
  let root: Root;
  let back: (() => boolean) | null;

  beforeEach(() => {
    resetExperimentStore();
    back = null;
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });

  const click = async (selector: string) => {
    const node = container.querySelector<HTMLButtonElement>(selector);
    if (!node) throw new Error(`missing ${selector}`);
    await act(async () => node.click());
    await flush();
  };
  const screen = () => container.querySelector("[data-exp-screen]")?.getAttribute("data-exp-screen");
  const promptId = () => container.querySelector("[data-prompt-id]")?.getAttribute("data-prompt-id");
  const question = async (words: string) => {
    const input = container.querySelector<HTMLInputElement>("[data-experiment-composer] input");
    if (!input?.form) throw new Error("missing question box");
    const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
    await act(async () => {
      set?.call(input, words);
      input.dispatchEvent(new Event("input", { bubbles: true }));
    });
    await act(async () => input.form?.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true })));
  };
  const lastReply = () => [...container.querySelectorAll('[role="log"] [data-row="app"]')].at(-1)?.textContent;

  it("explains the current choice and its follow-ups, then waits for a tap", async () => {
    await act(async () => {
      root.render(createElement(AiDoor, { onBindBack: (fn) => { back = fn; } }));
    });
    await question("Experiments");
    expect(screen()).toBe("ai");
    expect(lastReply()).toContain("Tap Training or Experiments so I know which one to open.");

    await click("[data-ai-choice='experiments']");
    await click("[data-pair='pages'] [data-choice='yes']");
    await click("[data-exp-go='rules']");
    expect(screen()).toBe("rules");
    const threshold = readInterventions()[0].threshold;

    await question("What is the minimum match?");
    expect(lastReply()).toContain("how close a clip must be");
    await question("Tell me more");
    expect(lastReply()).toContain("A looser rule accepts weaker matches");
    expect(lastReply()).toContain("The pick");
    await question("Stricter");
    expect(readInterventions()[0].threshold).toBe(threshold);
    await click("[data-pair='threshold'] [data-choice='yes']");
    expect(readInterventions()[0].threshold).toBeGreaterThan(threshold);
    await click("[data-pair='mode'] [data-choice='pick']");
    expect(screen()).toBe("pick");
  });

  it("walks a session in the file's order, rates with the file's words, and keeps the reading private", async () => {
    await act(async () => {
      root.render(createElement(Experiments, { onBindBack: (fn) => { back = fn; } }));
    });
    expect(container.querySelector("[data-exp-go='session']")?.textContent).toContain("Preview five questions");
    await click("[data-exp-go='session']");
    expect(container.textContent).toContain("uses sample readings");
    await question("Where is the Record button?");
    expect(screen()).toBe("consent");
    expect(lastReply()).toContain("shared test chat");
    await click("[data-pair='consent'] [data-choice='yes']");
    expect(screen()).toBe("baseline");
    expect(container.textContent).toContain("Preview · 1 of 5");
    expect(container.querySelector("[data-prompt-text]")?.textContent).toBe(file.prompts[0].text);
    expect(container.querySelector("[data-pair='said'] [data-choice='yes']")?.textContent).toBe("Use sample answer");

    await click("[data-pair='said'] [data-choice='yes']");
    await click("[data-pair='energy'] [data-choice='low']");
    await click("[data-pair='feeling'] [data-choice='tense']");
    await click("[data-pair='save'] [data-choice='yes']");
    expect(screen()).toBe("baseline");
    expect(readTakes()).toMatchObject([{ prompt_id: "b1", audio_name: null, analysis: null }]);
    for (const id of ["b2", "b3", "p1"]) {
      expect(promptId()).toBe(id);
      await click("[data-pair='said'] [data-choice='no']");
    }
    expect(screen()).toBe("take");
    expect(promptId()).toBe("c1");
    expect(container.textContent).toContain("Preview · 5 of 5");
    expect(container.querySelector("[data-prompt-text]")?.textContent).toBe(file.prompts.find((item) => item.id === "c1")?.text);
    expect(container.querySelector("[data-special]")).toBeNull();

    await click("[data-pair='said'] [data-choice='yes']");
    expect([...container.querySelectorAll("[data-pair='energy'] button")].map((button) => button.textContent)).toEqual(file.self_report.energy.map(optionLabel));
    expect([...container.querySelectorAll("[data-pair='feeling'] button")].map((button) => button.getAttribute("data-choice"))).toEqual([...file.self_report.feeling]);
    await click("[data-pair='energy'] [data-choice='low']");
    await click("[data-pair='feeling'] [data-choice='tense']");
    await click("[data-pair='save'] [data-choice='yes']");
    await flush();
    expect(screen()).toBe("reading");
    expect(container.textContent).toContain("Loading sample feedback");
    await act(async () => { await new Promise((resolve) => setTimeout(resolve, 1200)); });
    expect(screen()).toBe("analysis");
    const reading = container.querySelector("[data-experiments]")?.textContent ?? "";
    expect(reading).toContain("Sample feedback");
    expect(leaksHiddenWord(reading)).toBeNull();
    expect(reading).toContain("vs your baseline");
    expect(reading).toContain("vs the reference");
    expect(reading).toContain("not measured");
    expect(reading).toContain("Locked");
    expect(reading).toContain("early research version");
    expect(reading).not.toContain("0.802");
    expect(container.querySelector("[data-gate]")?.getAttribute("data-gate")).toBe("engagement");
    expect(container.querySelector("[data-gate]")?.textContent).toContain("how much you join in");
    expect(container.querySelector("[data-summary-step='arousal']")?.textContent).toContain("Locked");

    await click("[data-pair='next'] [data-choice='yes']");
    expect(screen()).toBe("pick");
    await click("[data-pair='mode'] [data-choice='rules']");
    expect(screen()).toBe("rules");

    for (let i = 0; i < 2; i += 1) {
      await act(async () => { back?.(); });
      await flush();
    }
    expect(screen()).toBe("analysis");
    await click("[data-pair='next'] [data-choice='no']");
    expect(screen()).toBe("preview-complete");
    await click("[data-exp-screen='preview-complete'] button");
    expect(screen()).toBe("menu");
    await click("[data-exp-go='library']");
    expect(container.querySelector("[data-prompt-text]")?.textContent).toBe(file.prompts[0].text);
    expect(container.textContent).toContain("1 of 14");
    await act(async () => { back?.(); });
    await flush();
    await click("[data-pair='pages'] [data-choice='yes']");
    await click("[data-pair='pages'] [data-choice='yes']");
    await click("[data-exp-go='export']");
    expect(screen()).toBe("export");
    expect(container.textContent).toContain("Only me");
    expect(container.textContent).toContain("A researcher");
    await act(async () => { back?.(); });
    await flush();
    await click("[data-exp-go='delete']");
    expect(screen()).toBe("delete");
    expect(container.textContent).toContain("Delete my data");
    await click("[data-pair='delete'] [data-choice='yes']");
    await click("[data-pair='sure'] [data-choice='yes']");
    expect(screen()).toBe("deleted");
  });
});
