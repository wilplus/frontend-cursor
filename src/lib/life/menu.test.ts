import { describe, expect, it } from "vitest";
import {
  panelMenu,
} from "./menu";

describe("panelMenu", () => {
  it("shows nothing when the panel does not exist for this caller", () => {
    // The kill switch sits upstream of everything else here.
    expect(panelMenu(null)).toEqual([]);
  });
});
