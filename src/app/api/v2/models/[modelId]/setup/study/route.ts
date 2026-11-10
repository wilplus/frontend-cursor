import { uploadRoute } from "@/app/api/v2/chats/chatUpload";

export const runtime = "nodejs";

/** A study, multipart `file`, read into starting rules (backend N528 item 4, N585). */
export const POST = uploadRoute("POST", (p) => `/v2/models/${encodeURIComponent(p.modelId)}/setup/study`);
