// @vitest-environment jsdom
/*
STORY    As a speaker with the voice notebook, I want a short reminder to keep names and fragile things out whenever Will spots something, so that my notes stay about patterns, not secrets (backend N411).
OUTCOME
  O1  The notebook's ask comes with the mic line and the three privacy lines above it.
  O2  Under a message where Will spots something, the short line "🔒 Security disclaimer ›"; a tap shows the three lines.
  O3  Other messages get no line; the backend's own line row (every fifth named note) is drawn as the line alone.
PROVES   O1 -> introduces the notebook with the rules
         O2 -> reminds under every spotted message
         O3 -> stays quiet elsewhere
*/
import { act, createElement, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  NOTEBOOK_ASK,
  NOTEBOOK_INTRO,
  NotebookIntro,
  PRIVACY_LINE,
  PRIVACY_RULES,
  PrivacyLine,
  isNotebookAsk,
  isPrivacyLineRow,
  isSpotted,
} from "./NotebookPrivacy";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let host: HTMLDivElement;
let root: Root;
beforeEach(() => {
  host = document.createElement("div");
  document.body.appendChild(host);
  root = createRoot(host);
});
afterEach(() => {
  act(() => root.unmount());
  host.remove();
});
const draw = (node: ReactNode) => act(() => root.render(node));

describe("the notebook's security disclaimer (N411)", () => {
  it("introduces the notebook with the rules", () => {
    expect(isNotebookAsk({ role: "bot", body: NOTEBOOK_ASK, metadata: { offer: "voice_notebook" } })).toBe(true);
    // An ask written before N411 keeps its old words and no intro.
    expect(isNotebookAsk({ role: "bot", body: "Keep a voice notebook?", metadata: { offer: "voice_notebook" } })).toBe(false);
    draw(createElement(NotebookIntro));
    expect(host.textContent).toContain(NOTEBOOK_INTRO);
    for (const line of PRIVACY_RULES) expect(host.textContent).toContain(line);
  });

  it("reminds under every spotted message", () => {
    for (const meta of [
      { sunday_step: "case", offer: "sunday_note" },
      { sunday_step: "suggested" },
      { strength_step: "case", offer: "strengths" },
      { strength_again: "s1" },
    ]) expect(isSpotted(meta)).toBe(true);
    draw(createElement(PrivacyLine));
    expect(host.textContent).toContain(PRIVACY_LINE);
    expect(host.textContent).not.toContain(PRIVACY_RULES[0]);
    act(() => (host.querySelector("[data-privacy-line]") as HTMLButtonElement).click());
    for (const line of PRIVACY_RULES) expect(host.textContent).toContain(line);
  });

  it("stays quiet elsewhere", () => {
    expect(isSpotted({ sunday_step: "head" })).toBe(false);
    expect(isSpotted({ voice_note: "n1" })).toBe(false);
    expect(isSpotted(null)).toBe(false);
    expect(isPrivacyLineRow({ privacy_line: "names" })).toBe(true);
    expect(isPrivacyLineRow({ voice_note: "n1", names_someone: true })).toBe(false);
  });
});
