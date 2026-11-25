import { callBackend } from "@/app/api/_lib/backend";

export const runtime = "nodejs";

/** The founder's labels against what both pickers served (backend N701). */
export async function GET() {
  const response = await callBackend("/v2/user/speaking-patterns/golden", { method: "GET" });
  response.headers.set("Cache-Control", "no-store");
  return response;
}
