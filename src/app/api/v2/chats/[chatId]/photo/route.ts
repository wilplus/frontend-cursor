import "server-only";
import { chatUploadRoute } from "../../chatUpload";

/** POST /api/v2/chats/[chatId]/photo: a photo or a screenshot from the "+"
 *  (N351), relayed to `POST /v2/chats/<chatId>/photo`. */
export const runtime = "nodejs";
export const maxDuration = 60;

export const POST = chatUploadRoute("photo");
