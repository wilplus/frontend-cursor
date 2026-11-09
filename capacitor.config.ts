import type { CapacitorConfig } from "@capacitor/cli";

// The iPhone app is a shell around the live site (backend N267): it opens
// www.willpowerlab.com, so every web deploy reaches the app with no new build
// and no store review. Not the bare domain: it redirects to www, and Capacitor
// sends a redirect to another host out to Safari, so the app would load
// nothing. `webDir` is only there because Capacitor requires one; the app
// never shows it while `server.url` is set.
//
// The app opens on the chats (backend N561 item 1; was: on sign-in, N354
// item 1): a signed-in person lands on the list with no stop at /login. A
// signed-out one is sent by the middleware, server-side, to the first page
// (N568, N471 item 4: the link field, the waitlist, "Sign in" in its
// corner), so the chats never flash; it knows the app by `appendUserAgent` below, and the
// website's /chat is unchanged. The path goes in `appStartPath`, never in
// `server.url`: iOS keeps a page inside the app only when its address
// starts with `server.url`, so ".../chat" there would send /login and
// /auth/callback out to Safari. Capacitor also refuses to start unless
// `webDir` has a matching path, hence `capacitor/www/chat/`.
const config: CapacitorConfig = {
  appId: "com.willpowerlab.app",
  appName: "WillpowerLab",
  webDir: "capacitor/www",
  // Added to the web view's user agent, so the server can tell the app from
  // Safari before any script runs (src/lib/nativeAppAgent.ts reads it).
  appendUserAgent: "WillpowerLabApp",
  server: {
    url: "https://www.willpowerlab.com",
    appStartPath: "chat",
    cleartext: false,
  },
  ios: {
    // The site does not set `viewport-fit=cover`, so its screens do not pad
    // for the status bar; "always" keeps the page below the clock and battery,
    // as Safari does, without changing any web screen.
    contentInset: "always",
    // The strips around the page (status bar, home bar) match its white
    // background; Info.plist keeps the app in light mode, as the site is.
    backgroundColor: "#ffffff",
  },
  plugins: {
    // The keyboard as in an app (backend N561 item 2). The plugin hides the
    // grey bar with the arrows and "Done" as soon as it loads, natively: no
    // script of it runs on the site. "native" shrinks the whole web view to
    // the space above the keyboard, so the page's 100dvh column ends on the
    // keyboard and the text box sits right on it, on every screen; the
    // footer steps aside while the keyboard is up (NativeKeyboard.tsx).
    // "body" would size <body> to the window minus the keyboard, which with
    // `contentInset: "always"` leaves the bottom a status bar's height under
    // the keyboard. "auto" paints the window behind the keyboard white, the
    // backgroundColor above, never black.
    Keyboard: {
      resize: "native",
      autoBackdropColor: "auto",
    },
  },
};

export default config;
