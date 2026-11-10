import "server-only";
import { uploadRoute } from "../../../../chatUpload";

export const runtime = "nodejs";
export const maxDuration = 60;

/** The photo a chat's question asks for (backend N610 item 4,
 *  POST /v2/chats/<id>/setup/<message_id>/photo, multipart `file`):
 *  {messages: the photo, then the host's next lines}. */
export const POST = uploadRoute(
  "POST",
  ({ chatId, messageId }) => `/v2/chats/${encodeURIComponent(chatId)}/setup/${encodeURIComponent(messageId)}/photo`,
);
