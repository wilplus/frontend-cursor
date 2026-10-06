import { describe, expect, it } from "vitest";
import { publishNeedsSave } from "./publishNeedsSave";

describe("publishNeedsSave", () => {
  it("saves a post that has no id yet, publishing or not", () => {
    expect(publishNeedsSave({ id: null, publishing: true, dirty: false })).toBe(true);
    expect(publishNeedsSave({ id: undefined, publishing: false, dirty: false })).toBe(true);
  });
  it("saves unsaved edits before publishing an existing post", () => {
    expect(publishNeedsSave({ id: "p1", publishing: true, dirty: true })).toBe(true);
  });
  it("publishes a saved post as it is", () => {
    expect(publishNeedsSave({ id: "p1", publishing: true, dirty: false })).toBe(false);
  });
  it("never saves to unpublish", () => {
    expect(publishNeedsSave({ id: "p1", publishing: false, dirty: true })).toBe(false);
  });
});
