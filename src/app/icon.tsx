import { ImageResponse } from "next/og";

/** Favicon for the site: 🎙️ (microphone). Served at /icon; no Lovable/default favicon. */
export const runtime = "edge";
export const size = { width: 32, height: 32 };
export const contentType = "image/png";

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          fontSize: 24,
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#fafafa",
          borderRadius: 6,
        }}
      >
        🎙️
      </div>
    ),
    { ...size }
  );
}
