import { ImageResponse } from "next/og";

/**
 * Favicon + PWA icon: the studio-mic emoji 🎙️ on a clean white rounded
 * tile. Rendered at 512×512 so the manifest's 192/512 references and
 * platform downscales (GitHub favicon, Vercel deploy notification, iOS
 * home-screen) stay crisp. Single source — served at /icon, /favicon.ico,
 * and as both manifest icons.
 */
export const runtime = "edge";
export const size = { width: 512, height: 512 };
export const contentType = "image/png";

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: 512,
          height: 512,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#ffffff",
          borderRadius: 112,
          fontSize: 340,
          lineHeight: 1,
        }}
      >
        🎙️
      </div>
    ),
    { ...size, emoji: "twemoji" }
  );
}
