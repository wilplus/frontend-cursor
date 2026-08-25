/**
 * Canonical product discovery and routing contract.
 *
 * Copy never unlocks or routes a product. A persisted bot bubble must carry a
 * versioned `metadata.product_action`; the backend stores the resulting
 * discovery permanently and the hamburger consumes that state.
 */

export type ProductId = "voice_album" | "life_panel";

export interface ProductAction {
  action: "open_product";
  product: ProductId;
  intent: string;
  source: string;
  context_transfer: "none";
  schema_version: 1;
}

export interface ProductMenuEntry {
  product: ProductId;
  label: string;
  href: string;
}

interface ProductSpec extends ProductMenuEntry {
  actionLabel: string;
  /** Old panel-menu keys now owned by this product destination. */
  ownedMenuKeys: readonly string[];
}

const PRODUCT_SPECS: Readonly<Record<ProductId, ProductSpec>> = {
  voice_album: {
    product: "voice_album",
    label: "Voice Album",
    actionLabel: "Find my Voice Album",
    href: "/voice-album",
    ownedMenuKeys: [],
  },
  life_panel: {
    product: "life_panel",
    label: "Life Panel",
    actionLabel: "Open Life Panel",
    href: "/panel/principles",
    ownedMenuKeys: ["principles"],
  },
};

const PRODUCT_ORDER: readonly ProductId[] = ["voice_album", "life_panel"];
const DISCOVERY_EVENT = "willab:product-discovered";

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

export function isProductId(value: unknown): value is ProductId {
  return value === "voice_album" || value === "life_panel";
}

/** Strict parser: no copy, note, boolean flag, or visual card can substitute. */
export function productActionFromMetadata(
  metadata: unknown,
): ProductAction | null {
  if (!isRecord(metadata)) return null;
  const candidate = metadata.product_action;
  if (!isRecord(candidate)) return null;
  if (candidate.action !== "open_product") return null;
  if (!isProductId(candidate.product)) return null;
  if (candidate.context_transfer !== "none") return null;
  if (candidate.schema_version !== 1) return null;
  if (typeof candidate.intent !== "string" || !candidate.intent) return null;
  if (typeof candidate.source !== "string" || !candidate.source) return null;
  return candidate as unknown as ProductAction;
}

export function productSpec(product: ProductId): ProductSpec {
  return PRODUCT_SPECS[product];
}

export function productMenuEntries(
  discovered: ReadonlySet<ProductId>,
): ProductMenuEntry[] {
  return PRODUCT_ORDER.filter((product) => discovered.has(product)).map(
    (product) => {
      const { label, href } = PRODUCT_SPECS[product];
      return { product, label, href };
    },
  );
}

export function isProductOwnedMenuKey(key: string): boolean {
  return PRODUCT_ORDER.some((product) =>
    PRODUCT_SPECS[product].ownedMenuKeys.includes(key),
  );
}

/** Notify already-mounted navigation after a newly persisted bubble arrives. */
export function announceProductDiscovery(product: ProductId): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(
    new CustomEvent<ProductId>(DISCOVERY_EVENT, { detail: product }),
  );
}

export function announceDiscoveriesFromPersistedMessages(
  messages: Array<{ role: string; metadata?: unknown }>,
): void {
  for (const message of messages) {
    if (message.role !== "bot") continue;
    const action = productActionFromMetadata(message.metadata);
    if (action) announceProductDiscovery(action.product);
  }
}

export function subscribeProductDiscovery(
  listener: (product: ProductId) => void,
): () => void {
  if (typeof window === "undefined") return () => {};
  const receive = (event: Event) => {
    const product = (event as CustomEvent<unknown>).detail;
    if (isProductId(product)) listener(product);
  };
  window.addEventListener(DISCOVERY_EVENT, receive);
  return () => window.removeEventListener(DISCOVERY_EVENT, receive);
}
