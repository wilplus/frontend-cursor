import type { CapacitorConfig } from "@capacitor/cli";

// The iPhone app is a shell around the live site (backend N267): it opens
// www.willpowerlab.com, so every web deploy reaches the app with no new build
// and no store review. Not the bare domain: it redirects to www, and Capacitor
// sends a redirect to another host out to Safari, so the app would load
// nothing. `webDir` is only there because Capacitor requires one; the app
// never shows it while `server.url` is set.
//
// The app opens on sign-in, not the landing page (N354): a signed-out person
// sees sign-in at once, and the middleware sends a signed-in one on to /chat
// server-side, so the landing never flashes. The path goes in
// `appStartPath`, never in `server.url`: iOS keeps a page inside the app only
// when its address starts with `server.url`, so ".../login" there would send
// /chat and /auth/callback out to Safari. Capacitor also refuses to start
// unless `webDir` has a matching path, hence `capacitor/www/login/`. A link
// that opens the app on "/" still reaches sign-in through page.client.tsx.
const config: CapacitorConfig = {
  appId: "com.willpowerlab.app",
  appName: "WillpowerLab",
  webDir: "capacitor/www",
  server: {
    url: "https://www.willpowerlab.com",
    appStartPath: "login",
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
};

export default config;
