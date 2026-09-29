// @vitest-environment jsdom
/* Step 0 of the Feedback sheet: the coach's overall message (founder
   2026-09-29, Q1; Final Screens L8). */
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CoachStepLayer } from "./CoachMessageSheet";
import { coachSeenKey, useCoachStep } from "./useCoachStep";
import { mapCoachMessage, type CoachMessage } from "@/services/api/idealText";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const MSG: CoachMessage = {
  text: "Let the pause after doubled breathe.",
  videoUrl: "https://media/coach.mp4",
  takeIndex: 2,
  publishedAt: "2026-09-29T08:00:00Z",
};

let host: HTMLDivElement;
let root: Root;
beforeEach(() => {
  window.localStorage.clear();
  host = document.createElement("div");
  document.body.appendChild(host);
  root = createRoot(host);
});
afterEach(() => {
  act(() => root.unmount());
  host.remove();
});

describe("the served message", () => {
  it("maps text, video, Take and time", () => {
    expect(mapCoachMessage({
      text: " Well done. ", video_url: "https://v", take_index: 2,
      published_at: "2026-09-29T08:00:00Z",
    })).toEqual({ text: "Well done.", videoUrl: "https://v", takeIndex: 2,
      publishedAt: "2026-09-29T08:00:00Z" });
  });
  it("is nothing when the coach sent neither words nor a video", () => {
    expect(mapCoachMessage({ text: "  ", video_url: null, take_index: 1 })).toBeNull();
    expect(mapCoachMessage(null)).toBeNull();
  });
  it("keeps a video-only message", () => {
    expect(mapCoachMessage({ video_url: "https://v" })?.videoUrl).toBe("https://v");
  });
});

function Host({ message, next, ready = true }: {
  message: CoachMessage | null; next: () => void; ready?: boolean;
}) {
  const step = useCoachStep({ arcId: "arc-1", message, ready, next });
  return createElement("div", null,
    createElement("button", { "data-review": true, onClick: () => { step.show(); } }, "review"),
    createElement(CoachStepLayer, { step, message }));
}

const sheet = () => host.querySelector("[data-coach-message-step]");

describe("step 0", () => {
  it("opens by itself once, shows the words, the Take and the video", () => {
    act(() => root.render(createElement(Host, { message: MSG, next: () => {} })));
    expect(sheet()).not.toBeNull();
    expect(sheet()?.textContent).toContain("Your coach");
    expect(sheet()?.textContent).toContain("Take 2");
    expect(sheet()?.textContent).toContain("Let the pause after doubled breathe.");
    expect(sheet()?.querySelector("video")?.getAttribute("src")).toBe(MSG.videoUrl);
  });

  it("Continue goes on to the moments, and it does not open by itself again", () => {
    const next = vi.fn();
    act(() => root.render(createElement(Host, { message: MSG, next })));
    const cont = [...host.querySelectorAll("button")].find((b) => b.textContent === "Continue")!;
    act(() => cont.click());
    expect(next).toHaveBeenCalledTimes(1);
    expect(sheet()).toBeNull();
    expect(window.localStorage.getItem(coachSeenKey("arc-1", MSG))).toBe("1");
    act(() => root.unmount());
    root = createRoot(host);
    act(() => root.render(createElement(Host, { message: MSG, next })));
    expect(sheet()).toBeNull();
  });

  it("comes first again whenever the walk starts, so it can be reread", () => {
    window.localStorage.setItem(coachSeenKey("arc-1", MSG), "1");
    act(() => root.render(createElement(Host, { message: MSG, next: () => {} })));
    expect(sheet()).toBeNull();
    act(() => host.querySelector<HTMLButtonElement>("[data-review]")!.click());
    expect(sheet()).not.toBeNull();
  });

  it("renders nothing without a message", () => {
    act(() => root.render(createElement(Host, { message: null, next: () => {} })));
    act(() => host.querySelector<HTMLButtonElement>("[data-review]")!.click());
    expect(sheet()).toBeNull();
  });
});

describe("only on the Ideal Text", () => {
  it("is never mounted by Recording Mode, Presentation Mode or export", () => {
    const dir = join(process.cwd(), "src/components/willab");
    const users = readdirSync(dir)
      .filter((f) => /\.tsx?$/.test(f) && !f.includes(".test."))
      .filter((f) => readFileSync(join(dir, f), "utf8").includes("CoachMessageSheet"));
    expect(users.sort()).toEqual(["CoachMessageSheet.tsx", "TranscriptReviewDeck.tsx"]);
  });
});
