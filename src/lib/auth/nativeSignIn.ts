import { Capacitor } from "@capacitor/core";

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
