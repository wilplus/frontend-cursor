import { proxyRoute } from "@/app/api/_lib/proxyRoute";

export const dynamic = "force-dynamic";

export const GET = proxyRoute("GET", "/v2/voice-album");
