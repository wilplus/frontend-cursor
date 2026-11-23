import { proxyRoute } from "@/app/api/_lib/proxyRoute";

export const runtime = "nodejs";

/** DELETE /v2/experiments/me. Deletes the caller's experiment rows. */
export const DELETE = proxyRoute("DELETE", "/v2/experiments/me", { noStore: true });
