import { proxyRoute } from "@/app/api/_lib/proxyRoute";

export const runtime = "nodejs";

/** The coach's tasks shown as models in Build's AI models, and the kinds of
 *  model coming (backend N642 item 6, #1948): {tasks: [{id, kind, title,
 *  line, waiting, open}], coming: [{kind, title, wanted}]}. */
export const GET = proxyRoute("GET", "/v2/models/coach-tasks", { noStore: true });
