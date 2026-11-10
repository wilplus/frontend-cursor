import { uploadRoute } from "@/app/api/v2/chats/chatUpload";

export const runtime = "nodejs";

/** Existing data, multipart `file` (a CSV or a JSON file), read and checked
 *  (backend N566 item 4). Nothing counts until "Upload it" with the tick. */
export const POST = uploadRoute("POST", (p) => `/v2/models/${encodeURIComponent(p.modelId)}/setup/data`);
