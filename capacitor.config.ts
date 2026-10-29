import type { CapacitorConfig } from "@capacitor/cli";

// The iPhone app is a shell around the live site (backend N267): it opens
// www.willpowerlab.com, so every web deploy reaches the app with no new build
// and no store review. Not the bare domain: it redirects to www, and Capacitor
// sends a redirect to another host out to Safari, so the app would load
// nothing. `webDir` is only there because Capacitor requires one; the app
// never shows it while `server.url` is set.
const config: CapacitorConfig = {
  appId: "com.willpowerlab.app",
  appName: "WillpowerLab",
  webDir: "capacitor/www",
  server: {
    url: "https://www.willpowerlab.com",
    cleartext: false,
  },
  ios: {
    contentInset: "never",
  },
};

export default config;
