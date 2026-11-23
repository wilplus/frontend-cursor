// @vitest-environment jsdom
/*
STORY    As the founder trying dark mode first, I want the app dark only when
         my iPhone is dark and dark mode is switched on for me, and everyone
         else's app exactly as it is (backend N678 item 2, N680).
OUTCOME
  O1  Dark only with the ring row on and the iPhone set to dark; any other
      case, or an iPhone that did not answer, stays light.
  O2  Showing a style marks the page and tells the app's own parts, and a
      refusal from the app still leaves the page right.
PROVES   O1 -> "is dark only with the switch on and the iPhone dark"
         O2 -> "marks the page and tells the app"
*/
import { describe, expect, it, vi } from "vitest";
import { applyStyle, chosenStyle } from "./appearance";

describe("dark mode in the iPhone app", () => {
  it("is dark only with the switch on and the iPhone dark", () => {
    expect(chosenStyle({ ringOn: true, system: "dark" })).toBe("dark");
    expect(chosenStyle({ ringOn: false, system: "dark" })).toBe("light");
    expect(chosenStyle({ ringOn: true, system: "light" })).toBe("light");
    expect(chosenStyle({ ringOn: true, system: null })).toBe("light");
  });

  it("marks the page and tells the app", async () => {
    const use = vi.fn(async () => undefined);
    await applyStyle("dark", { use });
    expect(document.documentElement.classList.contains("dark")).toBe(true);
    expect(use).toHaveBeenCalledWith({ style: "dark" });

    const refuses = vi.fn(async () => {
      throw new Error("no");
    });
    await applyStyle("light", { use: refuses });
    expect(document.documentElement.classList.contains("dark")).toBe(false);
  });
});
