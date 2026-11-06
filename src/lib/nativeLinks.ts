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

/* A link tapped INSIDE the app that would open a new window (target
   "_blank": the links in Will's chat, Linkified.tsx) is handed by the app to
   Safari, where the person is signed out. One to a page that needs their
   account opens here instead, as a link from Messages does: the pages the
   association file names (the chat, invite links, the account pages) and a
   coach's booking page, which shows the person's price once signed in. Any
   other page or site opens as before. */
const NEEDS_ACCOUNT = [/^\/chat(\/|$)/, /^\/c\//, /^\/account\//, /^\/book\//];

/** The page in the app that a tapped new-window link names, when it is one
 *  that needs the person's account; else null (it opens as before). */
export function inAppPathOf(url: string): string | null {
  const path = appPathOf(url);
  if (!path) return null;
  const { pathname } = new URL(path, "https://www.willpowerlab.com");
  return NEEDS_ACCOUNT.some((page) => page.test(pathname)) ? path : null;
}

function onLinkTap(event: MouseEvent): void {
  if (event.defaultPrevented || event.button !== 0) return;
  const link = event.target instanceof Element ? event.target.closest("a[href]") : null;
  if (!(link instanceof HTMLAnchorElement) || link.target !== "_blank") return;
  const path = inAppPathOf(link.href);
  if (!path) return;
  event.preventDefault();
  window.location.assign(path);
}

/** Listen for links while the app runs; returns the cleanup. */
export async function startNativeLinks(): Promise<() => void> {
  if (!isNativeApp()) return () => {};
  document.addEventListener("click", onLinkTap);
  const { App } = await import("@capacitor/app");
  const handle = await App.addListener("appUrlOpen", ({ url }) => {
    const path = appPathOf(url);
    if (path && path !== window.location.pathname + window.location.search + window.location.hash) {
      window.location.assign(path);
    }
  });
  return () => {
    document.removeEventListener("click", onLinkTap);
    void handle.remove();
  };
}
