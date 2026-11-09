/*
STORY    As a person opening the iPhone app, I want it to open on my chats, or on the first page when I am signed out, so that I never stop at sign-in when I am in, and never see the chats flash when I am out; the website's /chat stays as it is.
OUTCOME
  O1  The app starts on /chat, a path Capacitor can start on (its folder is in webDir).
  O2  Signed out, an app open of /chat is sent to the first page by the server (N568); a link into a chat goes to sign-in and comes back after it.
  O3  Signed in, an app open of /chat stays there, with no redirect.
  O4  On the website, a signed-out open of /chat is not redirected by the server, as before.
PROVES   O1 -> opens on the chats, a page Capacitor can start on
         O2 -> sends a signed-out app open to the first page, and a link in a chat through sign-in back to it
         O3 -> keeps a signed-in app open on the chats
         O4 -> leaves a signed-out website open of /chat as it was
WHY      Backend N561 item 1 (amends N354 item 1): the app opened on /login, a stop and a sign-in check on every open. N568: signed out, the first page (N471 item 4).
*/
import { existsSync } from "node:fs";
import { join } from "node:path";
import { NextRequest } from "next/server";
import { beforeAll, describe, expect, it } from "vitest";

import config from "../capacitor.config";
import { middleware } from "@/middleware";

const SITE = "https://www.willpowerlab.com";
const IPHONE = "Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko)";
// What the app's web view sends: WebKit's own, then Capacitor's appendUserAgent.
const APP = `${IPHONE} Mobile/15E148 ${config.appendUserAgent}`;
const SAFARI = `${IPHONE} Version/18.5 Mobile/15E148 Safari/604.1`;

beforeAll(() => {
  process.env.NEXT_PUBLIC_SUPABASE_URL = "https://test.supabase.co";
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "anon";
});

/** A signed-in browser's Supabase cookie: a session whose token is still
 *  valid, so reading it needs no network. */
function sessionCookie(): string {
  const now = Math.floor(Date.now() / 1000);
  const session = {
    access_token: "header.payload.signature",
    refresh_token: "refresh",
    token_type: "bearer",
    expires_in: 3600,
    expires_at: now + 3600,
    user: { id: "u1", aud: "authenticated", role: "authenticated", email: "a@b.c" },
  };
  return `sb-test-auth-token=base64-${Buffer.from(JSON.stringify(session)).toString("base64url")}`;
}

function open(path: string, userAgent: string, cookie?: string) {
  const headers: Record<string, string> = { "user-agent": userAgent, "sec-fetch-dest": "document" };
  if (cookie) headers.cookie = cookie;
  return middleware(new NextRequest(`${SITE}${path}`, { headers }));
}

describe("the iPhone app opens on the chats (backend N561 item 1)", () => {
  it("opens on the chats, a page Capacitor can start on", () => {
    expect(config.server?.appStartPath).toBe("chat");
    // Without it Capacitor refuses to start the app at all.
    expect(existsSync(join(config.webDir!, config.server!.appStartPath!, "index.html"))).toBe(true);
  });

  it("sends a signed-out app open to the first page, and a link in a chat through sign-in back to it", async () => {
    const bare = await open("/chat", APP);
    expect(bare.status).toBe(307);
    expect(bare.headers.get("location")).toBe(`${SITE}/`);

    const lens = await open("/chat?lens=arc1&take=t1", APP);
    const login = new URL(lens.headers.get("location")!);
    expect(login.pathname).toBe("/login");
    expect(login.searchParams.get("redirectTo")).toBe("/chat?lens=arc1&take=t1");
  });

  it("keeps a signed-in app open on the chats", async () => {
    const res = await open("/chat", APP, sessionCookie());
    expect(res.headers.get("location")).toBeNull();
    expect(res.headers.get("x-middleware-next")).toBe("1");
  });

  it("leaves a signed-out website open of /chat as it was", async () => {
    const res = await open("/chat", SAFARI);
    expect(res.headers.get("location")).toBeNull();
    expect(res.headers.get("x-middleware-next")).toBe("1");
  });
});
