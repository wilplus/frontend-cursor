// @vitest-environment jsdom
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { beforeEach, describe, expect, it } from "vitest";
import Experiments from "./Experiments";
import { resetExperimentStore } from "@/services/api/experiments";
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

  it("walks a session in the file's order, rates with the file's words, and keeps the reading private", async () => {
    await act(async () => {
      root.render(createElement(Experiments, { onBindBack: (fn) => { back = fn; } }));
    });
    const click = async (selector: string) => {
      const node = container.querySelector(selector) as HTMLButtonElement | null;
      if (!node) throw new Error(`missing ${selector}`);
      await act(async () => node.click());
      await flush();
    };
    const screen = () => container.querySelector("[data-exp-screen]")?.getAttribute("data-exp-screen");

    await click("[data-exp-go='session']");
    expect(container.querySelector("[data-ai-disclosure]")?.textContent).toContain("does not name a feeling");
    await click("[data-pair='consent'] [data-choice='yes']");
    await click("[data-pair='page'] [data-choice='no']");
    expect(screen()).toBe("baseline");
    expect(container.querySelector("[data-prompt-text]")?.textContent).toBe(file.prompts[0].text);

    const c5 = file.prompts.findIndex((prompt) => prompt.id === "c5");
    for (let i = 0; i < c5; i += 1) await click("[data-pair='said'] [data-choice='no']");
    expect(screen()).toBe("take");
    expect(container.querySelector("[data-prompt-id]")?.getAttribute("data-prompt-id")).toBe("c5");
    expect(container.querySelector("[data-prompt-text]")?.textContent).toBe(file.prompts[c5].text);
    expect(container.querySelector("[data-special]")).toBeNull();

    await click("[data-pair='said'] [data-choice='yes']");
    expect([...container.querySelectorAll("[data-pair='energy'] button")].map((button) => button.textContent)).toEqual(file.self_report.energy.map(optionLabel));
    expect([...container.querySelectorAll("[data-pair='feeling'] button")].map((button) => button.getAttribute("data-choice"))).toEqual([...file.self_report.feeling]);
    await click("[data-pair='energy'] [data-choice='low']");
    await click("[data-pair='feeling'] [data-choice='tense']");
    expect(container.querySelector("[data-prompt-text]")?.textContent).toContain("Policz na głos");
    await click("[data-pair='save'] [data-choice='yes']");

    expect(screen()).toBe("analysis");
    const reading = container.querySelector("[data-experiments]")?.textContent ?? "";
    expect(leaksHiddenWord(reading)).toBeNull();
    expect(reading).toContain("vs your baseline");
    expect(reading).toContain("vs the reference");
    expect(reading).not.toContain("engagement");
    expect(container.querySelector(`[data-cell='vocal:${file.order[0]}']`)?.getAttribute("data-comparison")).toBe("baseline");
    expect(container.querySelector("[data-cell='verbal:valence']")?.getAttribute("data-comparison")).toBe("reference");
    expect(container.querySelector("[data-gate]")?.textContent).toContain("how much you join in");

    await click("[data-pair='next'] [data-choice='yes']");
    expect(screen()).toBe("pick");
    await click("[data-pair='mode'] [data-choice='rules']");
    expect(screen()).toBe("rules");

    for (let i = 0; i < 6 && screen() !== "menu"; i += 1) {
      await act(async () => { back?.(); });
      await flush();
    }
    expect(screen()).toBe("menu");
    await click("[data-exp-go='library']");
    expect(container.querySelector("[data-prompt-text]")?.textContent).toBe(file.prompts[0].text);
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
