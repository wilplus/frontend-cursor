import { describe, expect, it } from "vitest";
import { enterAdvances, type EnterContext } from "./laneKeys";

const press = (over: Partial<EnterContext> = {}): EnterContext => ({
  key: "Enter",
  shiftKey: false,
  altKey: false,
  metaKey: false,
  ctrlKey: false,
  isComposing: false,
  tagName: "INPUT",
  isContentEditable: false,
  ownsEnter: false,
  ...over,
});

describe("Enter is the CTA", () => {
  it("advances from a one-line field", () => {
    expect(enterAdvances(press())).toBe(true);
  });

  it("advances with nothing focused", () => {
    expect(enterAdvances(press({ tagName: "" }))).toBe(true);
  });

  it("ignores every other key", () => {
    expect(enterAdvances(press({ key: "a" }))).toBe(false);
  });
});

describe("what Enter must never do", () => {
  it("never eats an IME composition", () => {
    // The press that commits a Polish or Japanese word must not also walk the
    // screen. This is the one that bites on real hardware.
    expect(enterAdvances(press({ isComposing: true }))).toBe(false);
  });

  it("leaves a textarea its newline", () => {
    expect(enterAdvances(press({ tagName: "TEXTAREA" }))).toBe(false);
    expect(enterAdvances(press({ tagName: "TEXTAREA", metaKey: true }))).toBe(true);
    expect(enterAdvances(press({ tagName: "TEXTAREA", ctrlKey: true }))).toBe(true);
  });

  it("leaves a focused button to fire itself", () => {
    // Otherwise one press on Skip would also press Next.
    expect(enterAdvances(press({ tagName: "BUTTON" }))).toBe(false);
    expect(enterAdvances(press({ tagName: "A" }))).toBe(false);
  });

  it("stays out of the drawing box", () => {
    expect(enterAdvances(press({ tagName: "TEXTAREA", ownsEnter: true }))).toBe(false);
  });

  it("ignores Shift and Alt", () => {
    expect(enterAdvances(press({ shiftKey: true }))).toBe(false);
    expect(enterAdvances(press({ altKey: true }))).toBe(false);
  });
});
