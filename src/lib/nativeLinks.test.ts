/*
STORY    As a speaker with the iPhone app, I want a coach's link or an invite link tapped in Messages, WhatsApp or Mail to open in the app, on that page, so that I never land in Safari signed out.
OUTCOME
  O1  The association file Apple reads names the app (team id and bundle id) and the paths that open in it: the chat with the coach's feedback, invite links and the account pages; without the team id there is no file, and every link opens in Safari as before.
  O2  A tapped willpowerlab.com link opens its own page in the app, with its query; a link to another site, or not over https, opens nothing.
  O3  Inside the app, a link that would open a new window (Will's booking link) to a page that needs my account opens in the app, signed in, not in Safari signed out; other pages and sites open as before.
PROVES   O1 -> the association file names the app and its paths, and is absent without the team id
         O2 -> a willpowerlab.com link opens its page in the app; another site's does not
         O3 -> a new-window link to a page that needs the account stays in the app; others open as before
*/
import { afterEach, expect, it, vi } from "vitest";
import { GET } from "@/app/.well-known/apple-app-site-association/route";
import { appPathOf, inAppPathOf } from "./nativeLinks";

afterEach(() => vi.unstubAllEnvs());

it("the association file names the app and its paths, and is absent without the team id", async () => {
  vi.stubEnv("APPLE_TEAM_ID", "");
  expect(GET().status).toBe(404);

  vi.stubEnv("APPLE_TEAM_ID", "ABCDE12345");
  const res = GET();
  expect(res.status).toBe(200);
  expect(res.headers.get("content-type")).toContain("application/json");
  const body = await res.json();
  expect(body.applinks.details).toEqual([
    {
      appIDs: ["ABCDE12345.com.willpowerlab.app"],
      components: [{ "/": "/chat" }, { "/": "/chat/*" }, { "/": "/c/*" }, { "/": "/account/*" }],
    },
  ]);
});

it("a willpowerlab.com link opens its page in the app; another site's does not", () => {
  expect(appPathOf("https://www.willpowerlab.com/chat?lens=arc-1")).toBe("/chat?lens=arc-1");
  expect(appPathOf("https://willpowerlab.com/c/q3V8kR2mZ")).toBe("/c/q3V8kR2mZ");
  expect(appPathOf("https://evil.example/chat")).toBeNull();
  expect(appPathOf("http://www.willpowerlab.com/chat")).toBeNull();
  expect(appPathOf("com.willpowerlab.app://auth/callback?code=x")).toBeNull();
});

it("a new-window link to a page that needs the account stays in the app; others open as before", () => {
  expect(inAppPathOf("https://www.willpowerlab.com/book/artur")).toBe("/book/artur");
  expect(inAppPathOf("https://www.willpowerlab.com/chat?lens=arc-1")).toBe("/chat?lens=arc-1");
  expect(inAppPathOf("https://willpowerlab.com/c/q3V8kR2mZ")).toBe("/c/q3V8kR2mZ");
  expect(inAppPathOf("https://www.willpowerlab.com/account/data-consent")).toBe("/account/data-consent");
  expect(inAppPathOf("https://www.willpowerlab.com/terms")).toBeNull();
  expect(inAppPathOf("https://www.willpowerlab.com/chatter")).toBeNull();
  expect(inAppPathOf("https://cal.example/book/artur")).toBeNull();
});
