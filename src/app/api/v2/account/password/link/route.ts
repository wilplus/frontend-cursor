import { accountRoute } from "@/app/api/_lib/accountRoute";

export const runtime = "nodejs";

/* Forgot password? or Set a password: a link to the account's email (N187). */
export const POST = accountRoute("POST", "/v2/account/password/link");
