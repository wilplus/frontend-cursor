import { accountRoute } from "@/app/api/_lib/accountRoute";

export const runtime = "nodejs";

/* Change email: a link to the new address, a notice to the old one (N187). */
export const POST = accountRoute("POST", "/v2/account/email");
