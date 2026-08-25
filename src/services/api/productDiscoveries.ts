import { getAuthToken } from "@/lib/api/auth-client";
import { isProductId, type ProductId } from "@/lib/productDiscovery";

const ENDPOINT = "/api/v2/user/product-discoveries";

/** Durable discoveries; soft-fail hidden rather than exposing a product early. */
export async function fetchProductDiscoveries(): Promise<ProductId[]> {
  const token = await getAuthToken();
  if (!token) return [];
  try {
    const response = await fetch(ENDPOINT, {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    });
    if (!response.ok) return [];
    const body = (await response.json().catch(() => null)) as {
      products?: unknown;
    } | null;
    return Array.isArray(body?.products)
      ? body.products.filter(isProductId)
      : [];
  } catch {
    return [];
  }
}
