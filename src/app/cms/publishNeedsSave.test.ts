import { describe, expect, it } from "vitest";
import { publishNeedsSave } from "./publishNeedsSave";

describe("publishNeedsSave", () => {
  it("saves unsaved edits before publishing an existing post", () => {
    expect(publishNeedsSave({ id: "p1", publishing: true, dirty: true })).toBe(true);
  });
});
