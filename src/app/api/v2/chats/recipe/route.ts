import { proxyRoute } from "@/app/api/_lib/proxyRoute";

export const runtime = "nodejs";

/** My chat's recipe, for the chat builder's ring (backend N578 item 7,
 *  N579; 404 without it): GET {assistant, recipe, starting_questions,
 *  locked}; PUT replaces it, {recipe}, or 400 with its code. */
export const GET = proxyRoute("GET", "/v2/chats/recipe", { noStore: true });
export const PUT = proxyRoute("PUT", "/v2/chats/recipe", { body: "json", noStore: true });
