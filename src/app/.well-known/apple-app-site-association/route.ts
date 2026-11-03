import { NextResponse } from "next/server";

/* -------------------------------------------------------------------------- */
/*  Links that open in the iPhone app (backend N365 item 5, universal links).  */
/*                                                                            */
/*  Apple reads this file from www.willpowerlab.com when the app is installed  */
/*  and opens these paths in the app instead of Safari: a coach's link to the  */
/*  feedback (/chat?lens=…, /chat?idealArc=…), an invite link (/c/…), and the  */
/*  account pages. The app then shows the page (src/lib/nativeLinks.ts).       */
/*                                                                            */
/*  The app's id is the Apple team id and the bundle id. The team id comes     */
/*  from APPLE_TEAM_ID on Vercel (the same value as the backend's              */
/*  APNS_TEAM_ID); unset, there is no file and every link opens in Safari, as  */
/*  before. Served as JSON, never redirected: Apple follows no redirect.       */
/* -------------------------------------------------------------------------- */

// Read per request, not baked in at build. Vercel binds a variable to a
// deployment: once APPLE_TEAM_ID is added, redeploy production to serve it.
export const dynamic = "force-dynamic";

export const BUNDLE_ID = "com.willpowerlab.app";
export const APP_PATHS = ["/chat", "/chat/*", "/c/*", "/account/*"];

export function GET() {
  const team = (process.env.APPLE_TEAM_ID ?? "").trim();
  if (!/^[A-Z0-9]{10}$/.test(team)) return new NextResponse(null, { status: 404 });
  const appID = `${team}.${BUNDLE_ID}`;
  return NextResponse.json(
    {
      applinks: {
        details: [{ appIDs: [appID], components: APP_PATHS.map((path) => ({ "/": path })) }],
      },
      webcredentials: { apps: [appID] },
    },
    { headers: { "Cache-Control": "public, max-age=3600" } },
  );
}
