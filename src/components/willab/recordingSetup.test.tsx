// @vitest-environment jsdom
/*
STORY    As a speaker, I want setup to ask my topic, then the presentation time limit, then
         slides, then start, so that starting a Take is quick.
OUTCOME
  O1  The questions come in that order, and starting carries my topic.
  O2  With no slides added, the slides step's button is "Skip for now", the
      last step included, and it starts the Take.
  O3  Polish app UI localises the fixed questions, upload control and actions
      without translating the speaker's typed topic.
PROVES   O1 -> "asks topic, length, slides, then starts"
         O2 -> "asks topic, length, slides, then starts"
         O3 -> "uses approved Polish fixed UI while keeping the speaker's topic unchanged"
WHY      Founder 2026-10-12; "Skip for now", backend N449 item 3.
*/
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, expect, it, vi } from "vitest";

vi.mock("@/components/tokens/RecordPriceNote", () => ({ default: () => null }));
import RecordingSetup from "./RecordingSetup";

afterEach(() => {
  document.documentElement.lang = "";
  document.documentElement.removeAttribute("data-ui-locale");
  localStorage.clear();
});

function mountSetup(locale: "en" | "pl") {
  document.documentElement.lang = locale;
  const host = document.createElement("div");
  const root = createRoot(host);
  const onSubmit = vi.fn();
  act(() =>
    root.render(
      createElement(RecordingSetup, {
        contextArcId: null,
        preloadDeck: null,
        onSubmit,
      }),
    ),
  );
  const typeTopic = (value: string) => {
    const input = host.querySelector("input")!;
    act(() => {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(input, value);
      input.dispatchEvent(new Event("input", { bubbles: true }));
    });
  };
  const next = () => act(() => [...host.querySelectorAll("button")].at(-1)!.click());
  return { host, root, onSubmit, typeTopic, next };
}

it("asks topic, length, slides, then starts", () => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  const { host, root, onSubmit, typeTopic, next } = mountSetup("en");
  typeTopic("My pitch");

  next();
  expect(host.textContent).toContain("Do you have a time limit?");
  expect(host.textContent).toContain("3 min");
  expect(host.textContent).toContain("10 min");
  expect(host.textContent).toContain("Other");
  expect(host.textContent).toContain("No time limit");
  expect(host.textContent).not.toContain("How long do you want to practise?");
  act(() =>
    [...host.querySelectorAll("button")]
      .find((button) => button.textContent === "No time limit")!
      .click()
  );
  next();
  expect(host.textContent).toContain("Have slides to go with it?");
  expect(host.textContent).toContain("Upload your deck (PDF)");
  expect(host.textContent).not.toContain("Adding slides makes the ideal text dramatically better.");
  expect(host.textContent).not.toContain("Three is where it really lands");
  expect([...host.querySelectorAll("button")].at(-1)!.textContent).toBe("Skip for now");
  next();
  expect(onSubmit.mock.calls[0][0]).toMatchObject({ topic: "My pitch" });
  act(() => root.unmount());
});

it("uses approved Polish fixed UI while keeping the speaker's topic unchanged", () => {
  const { host, root, onSubmit, typeTopic, next } = mountSetup("pl");
  typeTopic("My English launch update");

  next();
  expect(host.textContent).toContain("Czy masz limit czasu?");
  expect(host.textContent).toContain("Inny");
  expect(host.textContent).toContain("Bez limitu czasu");
  act(() =>
    [...host.querySelectorAll("button")]
      .find((button) => button.textContent === "Bez limitu czasu")!
      .click(),
  );
  next();
  expect(host.textContent).toContain("Czy masz do tego slajdy?");
  expect(host.textContent).toContain("Prześlij prezentację (PDF)");
  expect([...host.querySelectorAll("button")].at(-1)!.textContent).toBe("Pomiń na razie");
  next();
  expect(onSubmit.mock.calls[0][0]).toMatchObject({ topic: "My English launch update" });
  act(() => root.unmount());
});
