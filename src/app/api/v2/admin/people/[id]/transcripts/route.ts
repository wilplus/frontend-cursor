import "server-only";
import { proxyRoute } from "@/app/api/_lib/proxyRoute";

export const runtime = "nodejs";

/* Full transcripts for the profile's CSV: the founder only, and only for a speaker who said yes to training. The backend is the gate. */
export const GET = proxyRoute("GET", "/v2/admin/people/:id/transcripts", { noStore: true });
