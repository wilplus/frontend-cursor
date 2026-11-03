import { Capacitor, registerPlugin } from "@capacitor/core";
import { createClient } from "@/lib/supabase/client";
import { sameSitePath } from "@/lib/auth/sameSitePath";

/**
 * Sign-in inside the iPhone app (backend N267).
 *
 * The app is a web view on www.willpowerlab.com. A provider's page there is
 * another host, so Capacitor hands it to Safari, and the provider sends the
 * person back to the website in Safari, never to the app. Google also refuses
 * sign-in inside an app's own web view. So in the app the provider opens in an
 * in-app Safari panel and returns to the app's own address; the code is then
 * handed to /auth/callback inside the web view, where the PKCE cookie that
 * signInWithOAuth set is, and the sign-in finishes as it does on the web.
 *
 * Supabase must allow this address: Authentication → URL Configuration →
 * Redirect URLs. Its scheme is CFBundleURLTypes in ios/App/App/Info.plist.
 */
export const APP_CALLBACK = "com.willpowerlab.app://auth/callback";

export function isNativeApp(): boolean {
  return Capacitor.isNativePlatform();
}

let pending: { remove: () => Promise<void> } | null = null;

/** Open the provider in the in-app panel; come back to /auth/callback. */
export async function openInAppSignIn(providerUrl: string): Promise<void> {
  const [{ App }, { Browser }] = await Promise.all([
    import("@capacitor/app"),
    import("@capacitor/browser"),
  ]);
  // A panel closed without signing in leaves its listener; a new tap replaces it.
  await pending?.remove();
  pending = await App.addListener("appUrlOpen", async ({ url }) => {
    if (!url.startsWith(APP_CALLBACK)) return;
    await pending?.remove();
    pending = null;
    await Browser.close().catch(() => {});
    // Whatever Supabase appended (?code=…, or #error=…) goes on unchanged.
    window.location.href = `${window.location.origin}/auth/callback${url.slice(APP_CALLBACK.length)}`;
  });
  await Browser.open({ url: providerUrl });
}

/* -------------------------------------------------------------------------- */
/*  Sign in with Apple, native (backend N365 item 2): Apple's own sheet, from  */
/*  the app's AppleSignInPlugin (ios/App/App/WillpowerLabBridge.swift). Its    */
/*  identity token goes to Supabase (`signInWithIdToken`, provider "apple",    */
/*  Client ID com.willpowerlab.app); then, as /auth/oauth-complete does after  */
/*  Google and LinkedIn, the session is confirmed server-side and the person   */
/*  goes to the page they came for, or /chat.                                  */
/* -------------------------------------------------------------------------- */

type AppleSignInNative = {
  authorize(options: { nonce: string }): Promise<{ identityToken: string; givenName: string; familyName: string }>;
};
const AppleSignIn = registerPlugin<AppleSignInNative>("AppleSignIn");

async function sha256Hex(text: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
}

/** "ok" when signed in (the page is then leaving), "canceled" when the person
 *  closed Apple's sheet, "failed" with Supabase's or Apple's reason otherwise. */
export async function signInWithApple(): Promise<{ result: "ok" | "canceled" | "failed"; message?: string }> {
  const raw = Array.from(crypto.getRandomValues(new Uint8Array(32)), (b) => b.toString(16).padStart(2, "0")).join("");
  let apple: Awaited<ReturnType<AppleSignInNative["authorize"]>>;
  try {
    apple = await AppleSignIn.authorize({ nonce: await sha256Hex(raw) });
  } catch (err) {
    const code = (err as { code?: string })?.code;
    return code === "CANCELED" ? { result: "canceled" } : { result: "failed", message: (err as Error)?.message };
  }
  const supabase = createClient();
  const { error } = await supabase.auth.signInWithIdToken({ provider: "apple", token: apple.identityToken, nonce: raw });
  if (error) return { result: "failed", message: error.message };
  // Apple gives the name on the first sign-in only; keep it as Google's is kept.
  const fullName = [apple.givenName, apple.familyName].filter(Boolean).join(" ");
  if (fullName) {
    await supabase.auth
      .updateUser({ data: { full_name: fullName, given_name: apple.givenName, family_name: apple.familyName } })
      .catch(() => undefined);
  }
  try {
    await fetch("/api/auth/confirm-session", { method: "POST", credentials: "include" });
  } catch {
    /* non-fatal, as in /auth/oauth-complete */
  }
  await new Promise((r) => setTimeout(r, 200));
  const back = sameSitePath(new URLSearchParams(window.location.search).get("redirectTo"));
  window.location.replace(back ?? "/chat");
  return { result: "ok" };
}
