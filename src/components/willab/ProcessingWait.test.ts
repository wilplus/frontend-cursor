import { describe, expect, it } from "vitest";
import { processingTipFrame } from "./processingTipCycle";

describe("ProcessingWait tip continuity", () => {
  const epoch = 1_000;

  it("derives the same tip and fade from the same job epoch after a remount", () => {
    const beforeUnmount = processingTipFrame(epoch + 10_000, epoch, 4);
    const afterRemount = processingTipFrame(epoch + 10_000, epoch, 4);
    expect(afterRemount).toEqual(beforeUnmount);
    expect(afterRemount).toMatchObject({ index: 1, visible: true });
  });

  it("starts a crossfade every seven seconds and swaps after 420ms", () => {
    expect(processingTipFrame(epoch + 6_999, epoch, 4)).toMatchObject({
      index: 0,
      visible: true,
    });
    expect(processingTipFrame(epoch + 7_000, epoch, 4)).toMatchObject({
      index: 0,
      visible: false,
      nextDelayMs: 420,
    });
    expect(processingTipFrame(epoch + 7_419, epoch, 4)).toMatchObject({
      index: 0,
      visible: false,
      nextDelayMs: 1,
    });
    expect(processingTipFrame(epoch + 7_420, epoch, 4)).toMatchObject({
      index: 1,
      visible: true,
    });
    expect(processingTipFrame(epoch + 14_000, epoch, 4)).toMatchObject({
      index: 1,
      visible: false,
      nextDelayMs: 420,
    });
    expect(processingTipFrame(epoch + 14_420, epoch, 4)).toMatchObject({
      index: 2,
      visible: true,
    });
  });
});
