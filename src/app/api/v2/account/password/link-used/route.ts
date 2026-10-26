import { accountRoute } from "@/app/api/_lib/accountRoute";

export const runtime = "nodejs";

/* Set new password saved a password from an emailed link: logged (N189). */
export const POST = accountRoute("POST", "/v2/account/password/link-used");
