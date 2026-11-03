import { isNativeApp } from "@/lib/auth/nativeSignIn";
import { sameSitePath } from "@/lib/auth/sameSitePath";

/* -------------------------------------------------------------------------- */
/*  A willpowerlab.com link tapped elsewhere on the phone (Messages, WhatsApp, */
/*  Mail) opens the iPhone app (backend N365 item 5): iOS hands the app the    */
/*  link (`appUrlOpen`, kept for the first listener when it launched the app), */
/*  and the app shows that page. Which paths: the association file             */
/*  (src/app/.well-known/apple-app-site-association/route.ts). The sign-in     */
/*  panel's own return address (com.willpowerlab.app://…) is not a link here;  */
/*  nativeSignIn.ts takes it. On the web it does nothing.                      */
/* -------------------------------------------------------------------------- */

const HOSTS = new Set(["www.willpowerlab.com", "willpowerlab.com"]);

/** The page in the app that a tapped link names, or null when it is not ours. */
export function appPathOf(url: string): string | null {
  let link: URL;
  try {
    link = new URL(url);
  } catch {
    return null;
  }
  if (link.protocol !== "https:" || !HOSTS.has(link.hostname)) return null;
  return sameSitePath(`${link.pathname}${link.search}${link.hash}`);
}

/** Listen for links while the app runs; returns the cleanup. */
export async function startNativeLinks(): Promise<() => void> {
  if (!isNativeApp()) return () => {};
  const { App } = await import("@capacitor/app");
  const handle = await App.addListener("appUrlOpen", ({ url }) => {
    const path = appPathOf(url);
    if (path && path !== window.location.pathname + window.location.search + window.location.hash) {
      window.location.assign(path);
    }
  });
  return () => void handle.remove();
}
