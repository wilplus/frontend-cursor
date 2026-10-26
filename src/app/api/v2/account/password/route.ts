import { accountRoute } from "@/app/api/_lib/accountRoute";

export const runtime = "nodejs";

/* Change password: checks the current one, signs out the other devices (N187). */
export const POST = accountRoute("POST", "/v2/account/password");
