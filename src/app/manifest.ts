import type { MetadataRoute } from "next";

/* The home-screen app opens on the chat itself (2026-11-05). From "/" a
 * signed-in member went through the middleware's sign-in check and a 307 to
 * /chat: two HTML round trips before the app. /chat sends a signed-out
 * person to the first page itself (MembersOnly) and shows the waitlist to
 * whoever is on it, as "/" did through the same redirect.
 *
 * `id` keeps the app the one already installed: without one, a browser takes
 * the start address as the app's identity, so moving it would read as a new
 * app. "/" is the identity every install so far was given. */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "WillpowerLab",
    short_name: "WillpowerLab",
    description: "The ideal text of your presentation, in your own words.",
    id: "/",
    start_url: "/chat",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#ffffff",
    theme_color: "#ffffff",
    icons: [
      {
        src: "/icon",
        sizes: "192x192",
        type: "image/png",
      },
      {
        src: "/icon",
        sizes: "512x512",
        type: "image/png",
      },
      {
        src: "/icon",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}

