import { callBackend } from "@/app/api/_lib/backend";

export async function POST(req: Request) {
  return callBackend("/v2/coach/guidance/events", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: await req.text(),
  });
}
