// @vitest-environment jsdom
/* Step 0 of the Feedback sheet: the coach's overall message (founder
   2026-09-29, Q1; Final Screens L8). */
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CoachStepLayer } from "./CoachMessageSheet";
import { useCoachStep } from "./useCoachStep";
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

function Host({ message, next, ready = true, stepsAhead = 0 }: {
  message: CoachMessage | null; next: () => void; ready?: boolean; stepsAhead?: number;
}) {
  const step = useCoachStep({ arcId: "arc-1", message, ready, next });
  return createElement("div", null,
    createElement("button", { "data-review": true, onClick: () => { step.show(); } }, "review"),
    createElement(CoachStepLayer, { step, message, stepsAhead }));
}

const sheet = () => host.querySelector("[data-coach-message-step]");

describe("step 0", () => {
  it("never opens by itself (Q1); Review feedback shows the words, the Take and the video", () => {
    act(() => root.render(createElement(Host, { message: MSG, next: () => {} })));
    expect(sheet()).toBeNull();
    act(() => host.querySelector<HTMLButtonElement>("[data-review]")!.click());
    expect(sheet()).not.toBeNull();
    expect(sheet()?.textContent).toContain("Your coach");
    expect(sheet()?.textContent).toContain("Take 2");
    expect(sheet()?.textContent).toContain("Let the pause after doubled breathe.");
    expect(sheet()?.querySelector("video")?.getAttribute("src")).toBe(MSG.videoUrl);
  });

  it("Continue goes on to the moments and closes the step", () => {
    const next = vi.fn();
    act(() => root.render(createElement(Host, { message: MSG, next })));
    act(() => host.querySelector<HTMLButtonElement>("[data-review]")!.click());
    const cont = [...host.querySelectorAll("button")].find((b) => b.textContent === "Continue")!;
    act(() => cont.click());
    expect(next).toHaveBeenCalledTimes(1);
    expect(sheet()).toBeNull();
  });

  it("comes first again whenever the walk starts, so it can be reread", () => {
    act(() => root.render(createElement(Host, { message: MSG, next: () => {} })));
    act(() => host.querySelector<HTMLButtonElement>("[data-review]")!.click());
    expect(sheet()).not.toBeNull();
    const cont = [...host.querySelectorAll("button")].find((b) => b.textContent === "Continue")!;
    act(() => cont.click());
    expect(sheet()).toBeNull();
    act(() => host.querySelector<HTMLButtonElement>("[data-review]")!.click());
    expect(sheet()).not.toBeNull();
  });

  it("draws the walk's header, the step bar and the video with a play icon only (L8)", () => {
    const play = vi.spyOn(HTMLMediaElement.prototype, "play").mockImplementation(() => Promise.resolve());
    const next = vi.fn();
    act(() => root.render(createElement(Host, { message: MSG, next, stepsAhead: 3 })));
    act(() => host.querySelector<HTMLButtonElement>("[data-review]")!.click());
    const nav = sheet()?.querySelector('[data-testid="feedback-pager"]');
    expect(nav?.textContent).toContain("Your coach · Take 2");
    expect(nav?.textContent).not.toContain("moment");
    const back = nav?.querySelector('button[aria-label="Back"]') as HTMLButtonElement;
    expect(back.disabled).toBe(true);
    // The step bar: this screen current, the first moment's screens after.
    const dots = sheet()?.querySelector("[data-coach-step-dots]");
    expect(dots?.children.length).toBe(4);
    // The video carries no native controls; one play button over it.
    const video = sheet()?.querySelector("video") as HTMLVideoElement;
    expect(video.hasAttribute("controls")).toBe(false);
    const playButton = sheet()?.querySelector('button[aria-label="Play"]') as HTMLButtonElement;
    expect(playButton).not.toBeNull();
    act(() => playButton.click());
    expect(play).toHaveBeenCalledTimes(1);
    // › goes on exactly as Continue does.
    const forward = nav?.querySelector('button[aria-label="Next"]') as HTMLButtonElement;
    act(() => forward.click());
    expect(next).toHaveBeenCalledTimes(1);
    play.mockRestore();
  });

  it("draws no step bar when nothing follows", () => {
    act(() => root.render(createElement(Host, { message: MSG, next: () => {} })));
    act(() => host.querySelector<HTMLButtonElement>("[data-review]")!.click());
    expect(sheet()?.querySelector("[data-coach-step-dots]")).toBeNull();
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
