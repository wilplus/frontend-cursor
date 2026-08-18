import { describe, expect, it } from "vitest";
import { readAdviceScroll, writeAdviceScroll } from "./processingAdviceScroll";

describe("ProcessingWait storage is never on the recording critical path", () => {
  it("restores a saved reading position when storage is available", () => {
    const storage = {
      getItem: () => "147",
      setItem: () => undefined,
    };

    expect(readAdviceScroll(storage)).toBe(147);
  });

  it("degrades to position zero when iOS storage access throws", () => {
    const storage = {
      getItem: () => {
        throw new DOMException("Access denied", "SecurityError");
      },
      setItem: () => {
        throw new DOMException("Access denied", "SecurityError");
      },
    };

    expect(readAdviceScroll(storage)).toBe(0);
    expect(() => writeAdviceScroll(storage, 147)).not.toThrow();
  });

  it("also tolerates storage being entirely unavailable", () => {
    expect(readAdviceScroll(null)).toBe(0);
    expect(() => writeAdviceScroll(null, 147)).not.toThrow();
  });
});
