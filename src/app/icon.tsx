import { ImageResponse } from "next/og";

/**
 * Favicon + PWA + iOS home-screen icon: the WillpowerLab symbol — three dots
 * (small · big · small, #111) on a full-bleed white square. Full-bleed (no
 * rounded corners) so iOS applies its own squircle mask cleanly with no
 * transparent gaps. Rendered at 512×512 so the manifest's 192/512 references and
 * platform downscales (browser tab, iOS/Android home-screen) stay crisp. Single
 * source — served at /icon, /favicon.ico, the apple-touch-icon, and both
 * manifest icons (see layout.tsx `icons` + manifest.ts).
 */
export const runtime = "edge";
export const size = { width: 512, height: 512 };
export const contentType = "image/png";

const DOT = "#111111";

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
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 40 }}>
          <div style={{ width: 70, height: 70, borderRadius: "50%", background: DOT }} />
          <div style={{ width: 102, height: 102, borderRadius: "50%", background: DOT }} />
          <div style={{ width: 70, height: 70, borderRadius: "50%", background: DOT }} />
        </div>
      </div>
    ),
    { ...size }
  );
}
