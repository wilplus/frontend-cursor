// @vitest-environment jsdom
/* -------------------------------------------------------------------------- */
/*  The AI version of your voice in the Lounge chat: a clip the page already   */
/*  asked for is drawn with the bubble, not a round trip after its lines.     */
/* -------------------------------------------------------------------------- */
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import LoungeAiVoiceBubble from "./LoungeAiVoiceBubble";
import { readAiVoiceOnce } from "@/services/api/aiVoice";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

vi.mock("@/lib/api/bffCall", () => ({
  outcomeCall: async (_path: string, _init: unknown, map: (d: Record<string, unknown>) => unknown) => ({
    ok: true,
    data: map({ demo: "ai_voice", clip: { state: "ready", url: "blob:ai", duration_ms: 3000, why: "It slows on March." } }),
  }),
}));

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

it("draws the player and the why with the bubble when the page already asked for the clip", async () => {
  // The walk's host asks as its AI bubble is shown.
  await readAiVoiceOnce("pr-1");
  act(() => root.render(<LoungeAiVoiceBubble body="A line." practiceId="pr-1" then={null} seed="m1" avatar={null} />));
  expect(host.querySelector("[data-snippet-player], audio, button[aria-label]")).not.toBeNull();
  expect(host.querySelector("[data-lounge-ai-why]")?.textContent).toBe("It slows on March.");
});
