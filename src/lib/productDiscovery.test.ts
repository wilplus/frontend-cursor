import { describe, expect, it } from "vitest";
import {
  productMenuEntries,
  type ProductId,
} from "./productDiscovery";

describe("product discovery contract", () => {
  const lifePanelAction = {
    action: "open_product",
    product: "life_panel",
    intent: "start_setup",
    source: "voice_album_completion",
    context_transfer: "none",
    schema_version: 1,
  };

  it("builds only the hamburger rows the user has discovered", () => {
    expect(productMenuEntries(new Set<ProductId>())).toEqual([]);
    expect(productMenuEntries(new Set<ProductId>(["life_panel"]))).toEqual([
      { product: "life_panel", label: "Life Panel", href: "/panel/principles" },
    ]);
  });
});
