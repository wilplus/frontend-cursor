import "server-only";
import { uploadRoute } from "../../chatUpload";

export const runtime = "nodejs";
export const maxDuration = 60;

/** A file sent in a chat ("Send a file" behind the "+"): multipart `file`
 *  to POST /v2/chats/<id>/file, the same shape as the photo route. */
export const POST = uploadRoute("POST", ({ chatId }) => `/v2/chats/${encodeURIComponent(chatId)}/file`);
