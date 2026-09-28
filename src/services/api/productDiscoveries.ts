import { bffFetch } from "@/lib/api/bffFetch";
import { isProductId, type ProductId } from "@/lib/productDiscovery";

const ENDPOINT = "/api/v2/user/product-discoveries";

/** Durable discoveries; soft-fail hidden rather than exposing a product early. */
export async function fetchProductDiscoveries(): Promise<ProductId[]> {
  const result = await bffFetch(ENDPOINT, { cache: "no-store" });
  if (result.kind !== "response" || !result.ok) return [];
  const body = result.body as { products?: unknown } | null;
  return Array.isArray(body?.products)
    ? body.products.filter(isProductId)
    : [];
}
