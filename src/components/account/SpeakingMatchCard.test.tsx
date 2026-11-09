// @vitest-environment jsdom
/*
STORY    As a person whose practice buddies are matched by how I speak, I
         want the signed card "Matching by how you speak" in Settings, with
         Turn off, so that I can stop it at any time and have what Will
         learned from how I speak deleted, my chats kept.
OUTCOME
  O1  The card shows only while matching by how people speak is switched
      on at all (`available`) and I have it on; off by default, it is not
      there, nor when the switch cannot be read.
  O2  On, it reads the signed words with "Turn off"; Turn off asks first,
      "Turn off matching by how you speak?", "We delete what Will learned
      from how you speak. Your buddies stay.", and sends nothing until
      confirmed; Cancel leaves it on.
  O3  Confirmed, the backend is told to turn it off, and only once it has
      the card says "Off. We deleted what Will learned from how you
      speak." with "Turn on", which turns it back on.
  O4  A turn-off the backend could not finish says so and leaves it on.
PROVES   O1 -> "the card is there only when matching by how you speak is available and on"
         O2 -> "Turn off asks first in the signed words, and Cancel leaves it on"
         O3 -> "Turn off deletes what Will learned, says so, and Turn on turns it back on"
         O4 -> "a turn-off that fails says so and leaves it on"
WHY      Founder, 4 November 2026, N463 item 2 (opt-in, off by default)
         and N465 items 1 and 2 (the Settings card, signed as drawn on the
         prototype's screen 5); 9 November 2026, N559 item 6 (the off
         switch, built before the speaking part is switched on); App Model
         MATCH-11; backend #1861 (GET/POST /v2/me/speaking-match).
*/
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

const api = vi.hoisted(() => ({ getSpeakingMatch: vi.fn(), setSpeakingMatch: vi.fn() }));
vi.mock("@/services/api/takeMatches", async (importOriginal) => ({ ...(await importOriginal<object>()), ...api }));

import SpeakingMatchCard from "./SpeakingMatchCard";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let host: HTMLDivElement;
let root: Root;
beforeEach(() => {
  host = document.createElement("div");
  document.body.appendChild(host);
  root = createRoot(host);
  api.getSpeakingMatch.mockReset();
  api.setSpeakingMatch.mockReset();
});
afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
});

const ON_WORDS =
  "On. Will uses your pace, your pauses and how you build an answer to choose your practice buddies. Nobody sees it, you included.";
const OFF_WORDS = "Off. We deleted what Will learned from how you speak.";
const render = async () => {
  await act(async () => root.render(createElement(SpeakingMatchCard)));
};
const button = (text: string) => [...host.querySelectorAll("button")].find((b) => b.textContent === text);
const tap = async (text: string) => {
  await act(async () => button(text)!.click());
};

it("the card is there only when matching by how you speak is available and on", async () => {
  for (const state of [{ on: false, available: true }, { on: true, available: false }, { on: false, available: false }, null]) {
    api.getSpeakingMatch.mockResolvedValue(state);
    await render();
    expect(host.textContent).toBe("");
    await act(async () => root.unmount());
    root = createRoot(host);
  }
  api.getSpeakingMatch.mockResolvedValue({ on: true, available: true });
  await render();
  expect(host.textContent).toContain("Matching by how you speak");
});

it("Turn off asks first in the signed words, and Cancel leaves it on", async () => {
  api.getSpeakingMatch.mockResolvedValue({ on: true, available: true });
  await render();
  expect(host.querySelector("h2")?.textContent).toBe("Matching by how you speak");
  expect(host.textContent).toContain(ON_WORDS);
  await tap("Turn off");
  expect(host.querySelector("h2")?.textContent).toBe("Turn off matching by how you speak?");
  expect(host.textContent).toContain("We delete what Will learned from how you speak. Your buddies stay.");
  expect(button("Cancel")).toBeTruthy();
  expect(api.setSpeakingMatch).not.toHaveBeenCalled();
  await tap("Cancel");
  expect(host.textContent).toContain(ON_WORDS);
  expect(api.setSpeakingMatch).not.toHaveBeenCalled();
});

it("Turn off deletes what Will learned, says so, and Turn on turns it back on", async () => {
  api.getSpeakingMatch.mockResolvedValue({ on: true, available: true });
  api.setSpeakingMatch.mockImplementation(async (on: boolean) => ({ on, available: true }));
  await render();
  await tap("Turn off");
  await tap("Turn off");
  expect(api.setSpeakingMatch).toHaveBeenCalledWith(false);
  expect(host.querySelector("h2")?.textContent).toBe("Matching by how you speak");
  expect(host.textContent).toContain(OFF_WORDS);
  await tap("Turn on");
  expect(api.setSpeakingMatch).toHaveBeenLastCalledWith(true);
  expect(host.textContent).toContain(ON_WORDS);
});

it("a turn-off that fails says so and leaves it on", async () => {
  api.getSpeakingMatch.mockResolvedValue({ on: true, available: true });
  api.setSpeakingMatch.mockResolvedValue(null);
  await render();
  await tap("Turn off");
  await tap("Turn off");
  expect(host.querySelector('[role="alert"]')).not.toBeNull();
  expect(host.textContent).toContain(ON_WORDS);
  expect(host.textContent).not.toContain(OFF_WORDS);
});
