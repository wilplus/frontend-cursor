import "server-only";
import { NextRequest, NextResponse } from "next/server";
import { callBackend } from "@/app/api/_lib/backend";

export const runtime = "nodejs";

/* -------------------------------------------------------------------------- */
/*  The Phase-1 processing-authorization BFF lane.                             */
/*                                                                            */
/*  Nothing in the frontend reached this contract before: the backend routes   */
/*  have existed since migration 0310 and had no caller, which is why no user  */
/*  could ever produce a receipt and why `enforce` would refuse every          */
/*  recording. This is the first half of that gap (Task 3).                    */
/*                                                                            */
/*  requireAuth is FALSE on every path here, deliberately. A user decides      */
/*  whether to accept BEFORE they have an account — the backend mints a signed */
/*  guest acquisition principal for exactly that case — so a proxy that        */
/*  demanded a session would make acceptance impossible for the only people    */
/*  who still need to do it. The backend's @optional_auth is the authority.    */
/*                                                                            */
/*  This route NEVER holds a copy of any policy text and never computes a      */
/*  hash. It forwards bytes. Both rules matter: the whole receipt scheme       */
/*  rests on the user agreeing to the exact copy the database stores, and a    */
/*  convenience re-hash anywhere in this path would make                       */
/*  POLICY_COPY_HASH_MISMATCH unable to see the drift it exists to catch.      */
/* -------------------------------------------------------------------------- */

const GUEST_OWNER_HEADER = "X-Willab-Guest-Owner";

/** Exactly the subpaths the acceptance flow needs, by method.
 *
 *  An allowlist rather than a pass-through: `/v2/processing-authorization` also
 *  carries `data-rights` (which can request erasure) and `terminate`. Those are
 *  real capabilities with their own surfaces; they do not get reachable from
 *  here as a side effect of opening the acceptance lane. */
const ALLOWED: Record<string, readonly string[]> = {
  "": ["GET", "POST"],
  principal: ["POST"],
  "ai-rendered": ["POST"],
  // A person changing a choice after accepting (founder 2026-09-25): the
  // practice switch and the sensitive-information withdrawal on the Data &
  // consent page. Nothing else from the backend lane opens with it.
  choices: ["GET", "POST"],
};

function target(context: { params: { path?: string[] } }, method: string): string | null {
  const path = (context.params.path ?? []).join("/");
  const methods = ALLOWED[path];
  if (!methods || !methods.includes(method)) return null;
  return `/v2/processing-authorization${path ? `/${path}` : ""}`;
}

async function proxy(
  request: NextRequest,
  context: { params: { path?: string[] } },
): Promise<NextResponse> {
  const destination = target(context, request.method);
  if (!destination) {
    return NextResponse.json(
      { code: "NOT_FOUND", error: "Not found." },
      { status: 404 },
    );
  }
  const guestOwner = request.headers.get(GUEST_OWNER_HEADER);
  const body = request.method === "POST" ? await request.text() : undefined;
  const response = await callBackend(destination, {
    method: request.method,
    ...(body === undefined ? {} : { body }),
    headers: {
      ...(body === undefined ? {} : { "Content-Type": "application/json" }),
      ...(guestOwner ? { [GUEST_OWNER_HEADER]: guestOwner } : {}),
    },
    requireAuth: false,
  });
  // The policy copy and the acceptance state are both per-principal and both
  // change the moment a policy is re-registered. A cached one would show a
  // user words they are not the ones being asked to agree to.
  response.headers.set("Cache-Control", "no-store");
  return response;
}

export const GET = proxy;
export const POST = proxy;
