import { describe, expect, it } from "vitest";
import {
  isProductOwnedMenuKey,
  productActionFromMetadata,
  productMenuEntries,
  productSpec,
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

  it("accepts the explicit versioned Life Panel destination", () => {
    expect(
      productActionFromMetadata({ product_action: lifePanelAction }),
    ).toEqual(lifePanelAction);
  });

  it("never infers a destination from copy or legacy flags", () => {
    expect(
      productActionFromMetadata({
        body: "Your Voice Album is ready",
        voice_album_ready: true,
      }),
    ).toBeNull();
  });

  it("rejects unknown products, context transfer, and schema drift", () => {
    expect(
      productActionFromMetadata({
        product_action: { ...lifePanelAction, product: "principles" },
      }),
    ).toBeNull();
    expect(
      productActionFromMetadata({
        product_action: { ...lifePanelAction, context_transfer: "chat" },
      }),
    ).toBeNull();
    expect(
      productActionFromMetadata({
        product_action: { ...lifePanelAction, schema_version: 2 },
      }),
    ).toBeNull();
  });

  it("builds only the hamburger rows the user has discovered", () => {
    expect(productMenuEntries(new Set<ProductId>())).toEqual([]);
    expect(productMenuEntries(new Set<ProductId>(["life_panel"]))).toEqual([
      { product: "life_panel", label: "Life Panel", href: "/panel/principles" },
    ]);
  });

  it("moves the old Principles row under the Life Panel product", () => {
    expect(isProductOwnedMenuKey("principles")).toBe(true);
    expect(productSpec("life_panel").label).toBe("Life Panel");
  });
});
