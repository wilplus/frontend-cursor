// @vitest-environment jsdom
/* The coach's video in a bubble follows the video's orientation (founder,
   2026-10-16): a horizontal video is the wide box, a vertical one the tall
   one; a caller's own frame is kept. */
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import CoachVideo from "./CoachVideo";

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

function mount(className?: string) {
  act(() => root.render(<CoachVideo src="data:video/mp4;base64," className={className} />));
  const video = host.querySelector("video") as HTMLVideoElement;
  const box = host.querySelector("[data-coach-video]") as HTMLElement;
  return { video, box };
}

const classes = (el: HTMLElement) => el.className.split(/\s+/);
/** The ratio as the style holds it ("1.7777 / 1"), as a number. */
const ratioOf = (el: HTMLElement) => parseFloat(el.style.aspectRatio);

/** The metadata arrives with the picture's size. */
function loaded(video: HTMLVideoElement, width: number, height: number) {
  Object.defineProperty(video, "videoWidth", { value: width, configurable: true });
  Object.defineProperty(video, "videoHeight", { value: height, configurable: true });
  act(() => {
    video.dispatchEvent(new Event("loadedmetadata"));
  });
}

describe("CoachVideo follows the video's orientation", () => {
  it("is the wide box until the metadata says otherwise, then takes the horizontal video's own shape", () => {
    const { video, box } = mount("w-full");
    expect(box.dataset.orientation).toBeUndefined();
    expect(video.className).toContain("aspect-video");
    loaded(video, 1280, 720);
    expect(box.dataset.orientation).toBe("landscape");
    expect(classes(box)).toContain("w-full");
    expect(ratioOf(video)).toBeCloseTo(1280 / 720);
  });

  it("stands tall for a vertical video, only as wide as the picture, at the left", () => {
    const { video, box } = mount("w-full");
    loaded(video, 720, 1280);
    expect(box.dataset.orientation).toBe("portrait");
    expect(classes(box)).toContain("w-fit");
    expect(classes(box)).toContain("self-start");
    expect(classes(box)).not.toContain("w-full");
    expect(classes(video)).toContain("w-auto");
    expect(ratioOf(video)).toBeCloseTo(720 / 1280);
  });

  it("keeps a frame the caller named, whatever the video's shape", () => {
    const { video, box } = mount("w-full [&>video]:aspect-[4/5]");
    loaded(video, 720, 1280);
    expect(box.dataset.orientation).toBe("portrait");
    expect(classes(box)).toContain("w-full");
    expect(classes(video)).not.toContain("w-auto");
    expect(video.style.aspectRatio).toBe("");
  });
});
