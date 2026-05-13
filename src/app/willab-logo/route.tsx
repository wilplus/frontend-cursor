import { ImageResponse } from "next/og";

/**
 * GET /willab-logo
 *
 * Dynamically-rendered Willab wordmark for transactional email
 * headers (PostSessionResultsEmail and friends). Same trick as
 * src/app/icon.tsx — Vercel renders the JSX into a PNG at the
 * edge, hosts it for free, no static asset upload needed.
 *
 * Why dynamic instead of a checked-in PNG:
 *   • Pacifico is the brand font — but it ships only via Google
 *     Fonts. Email clients strip Google Fonts, so the in-template
 *     <span> wordmark fell back to "Brush Script MT, cursive"
 *     half the time. Rasterising once on the server bakes Pacifico
 *     into the pixels and every client sees the same brand.
 *   • Wider aspect (4:1) than the favicon /icon route (1:1, the
 *     emoji-on-tile), so it sits properly in an email header at
 *     ~120 px wide without looking chunky.
 *   • Single source of truth — change the colour or proportions
 *     here and every email picks it up on next render.
 *
 * Cache-Control: public, max-age=86400 — wordmark doesn't change
 * often, so let CDNs / mail-image-proxies hold the PNG for a day
 * before re-fetching.
 */
export const runtime = "edge";

const W = 480;
const H = 120;

const COLOR_TEXT = "#1F1A14";
const COLOR_DOT = "#F97316";
const COLOR_BG = "#FCFAF6";

const PACIFICO_WOFF2 =
  "https://fonts.gstatic.com/s/pacifico/v22/FwZY7-Qmy14u9lezJ-6H6MmBp0u-.woff2";

export async function GET() {
  // Edge runtime can fetch fonts at request time — embedded into the
  // PNG so receiving clients don't need Google Fonts access.
  let pacifico: ArrayBuffer | null = null;
  try {
    const res = await fetch(PACIFICO_WOFF2);
    if (res.ok) pacifico = await res.arrayBuffer();
  } catch {
    // Non-fatal — fall through to system serif. Wordmark still
    // renders, just less brand-on.
  }

  return new ImageResponse(
    (
      <div
        style={{
          width: W,
          height: H,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: COLOR_BG,
          fontFamily: pacifico
            ? "Pacifico"
            : "Brush Script MT, cursive, serif",
          fontSize: 84,
          lineHeight: 1,
          color: COLOR_TEXT,
          // Slight optical drop so the descender of the "b" doesn't
          // crash the bottom edge.
          paddingBottom: 8,
        }}
      >
        <span>willab</span>
        <span style={{ color: COLOR_DOT }}>.</span>
      </div>
    ),
    {
      width: W,
      height: H,
      ...(pacifico
        ? {
            fonts: [
              {
                name: "Pacifico",
                data: pacifico,
                style: "normal" as const,
                weight: 400 as const,
              },
            ],
          }
        : {}),
      headers: {
        "Cache-Control": "public, max-age=86400",
      },
    }
  );
}
