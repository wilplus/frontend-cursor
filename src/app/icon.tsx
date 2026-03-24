import { ImageResponse } from "next/og";

/** Favicon: microphone SVG in brand colours (dark navy + orange). Served at /icon and /favicon.ico. */
export const runtime = "edge";
export const size = { width: 32, height: 32 };
export const contentType = "image/png";

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: 32,
          height: 32,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#1e293b",
          borderRadius: 7,
        }}
      >
        <svg
          width="20"
          height="20"
          viewBox="0 0 20 20"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          {/* Microphone body */}
          <rect x="7" y="1" width="6" height="10" rx="3" fill="#f97316" />
          {/* Arc */}
          <path
            d="M4 10a6 6 0 0 0 12 0"
            stroke="#f97316"
            strokeWidth="1.8"
            strokeLinecap="round"
            fill="none"
          />
          {/* Stand */}
          <line x1="10" y1="16" x2="10" y2="19" stroke="#f97316" strokeWidth="1.8" strokeLinecap="round" />
          {/* Base */}
          <line x1="7" y1="19" x2="13" y2="19" stroke="#f97316" strokeWidth="1.8" strokeLinecap="round" />
        </svg>
      </div>
    ),
    { ...size }
  );
}
