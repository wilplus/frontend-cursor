import "server-only";
import { uploadRoute } from "../../chatUpload";

export const runtime = "nodejs";
export const maxDuration = 60;

/** A photo sent in a chat (backend N351, POST /v2/chats/<id>/photo,
 *  multipart `file`): "Send a photo" behind the "+", and "Add a photo" when
 *  the chat asks for one (N610 items 4 and 7). */
export const POST = uploadRoute("POST", ({ chatId }) => `/v2/chats/${encodeURIComponent(chatId)}/photo`);
