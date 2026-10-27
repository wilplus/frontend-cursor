import "server-only";
import { proxyRoute } from "@/app/api/_lib/proxyRoute";

export const runtime = "nodejs";

/** The plan's own yes (docs/flows/the-plan.md D; backend N211): `GET
 *  /v2/plan/consent` reads it for the card in Data & consent, `POST` turns it
 *  on or off (off deletes the personal answers). */
export const GET = proxyRoute("GET", "/v2/plan/consent", { noStore: true });
export const POST = proxyRoute("POST", "/v2/plan/consent", { body: "json", noStore: true });
