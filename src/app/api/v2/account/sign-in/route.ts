import { accountRoute } from "@/app/api/_lib/accountRoute";

export const runtime = "nodejs";

/* Email and password on Data & consent: the email, whether there is a password, the provider. */
export const GET = accountRoute("GET", "/v2/account/sign-in");
