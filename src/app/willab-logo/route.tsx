import { ImageResponse } from "next/og";

/**
 * GET /willab-logo
 *
 * The WillpowerLab logo for transactional email headers
 * (PostSessionResultsEmail and friends), rendered to a PNG at the edge.
 *
 * THE APP'S OWN LOGO (founder 2026-09-25: "change it to the logo from the
 * app ... the logo text is black font WillpowerLab and small symbol logo").
 * It used to be a Pacifico script wordmark with an orange full stop — a mark
 * the app itself never shows. Now it is exactly src/components/Logo.tsx: three
 * black dots in a voice rhythm (the middle one larger) beside "WillpowerLab"
 * in a black semibold sans.
 *
 * Why a PNG and not inline SVG in the email: many email clients strip SVG and
 * web fonts, so rasterising once bakes the mark and the font into pixels and
 * every client shows the same logo. The background is transparent, so it sits
 * on the email's own background unchanged.
 *
 * Cache-Control: public, max-age=86400 — the logo rarely changes, so let CDNs
 * and mail-image proxies keep the PNG for a day.
 */
export const runtime = "edge";

const W = 520;
const H = 120;
const INK = "#121212";

/** Inter 600 as a TTF (the renderer reads TTF/OTF/WOFF, not WOFF2). The CSS
 *  API answers with TTF when asked without a browser user agent. */
async function loadInterSemibold(): Promise<ArrayBuffer | null> {
  try {
    const css = await (
      await fetch("https://fonts.googleapis.com/css2?family=Inter:wght@600")
    ).text();
    const url = css.match(/src:\s*url\(([^)]+)\)\s*format\('(?:truetype|opentype)'\)/)?.[1];
    if (!url) return null;
    const res = await fetch(url);
    return res.ok ? await res.arrayBuffer() : null;
  } catch {
    // Non-fatal: the default sans still renders the same shapes.
    return null;
  }
}

function Dot({ size }: { size: number }) {
  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        background: INK,
      }}
    />
  );
}

export async function GET() {
  const inter = await loadInterSemibold();

  return new ImageResponse(
    (
      <div
        style={{
          width: W,
          height: H,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: 22,
        }}
      >
        {/* Logo.tsx's viewBox (22 wide: r 2.2 / 3.2 / 2.2 at x 3 / 11 / 19),
            scaled ×4.4 so the mark sits beside 52px type as it does in the
            app. */}
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <Dot size={19} />
          <Dot size={28} />
          <Dot size={19} />
        </div>
        <div
          style={{
            display: "flex",
            fontFamily: inter ? "Inter" : "sans-serif",
            fontWeight: 600,
            fontSize: 52,
            letterSpacing: -1,
            color: INK,
          }}
        >
          WillpowerLab
        </div>
      </div>
    ),
    {
      width: W,
      height: H,
      ...(inter
        ? {
            fonts: [
              {
                name: "Inter",
                data: inter,
                style: "normal" as const,
                weight: 600 as const,
              },
            ],
          }
        : {}),
      headers: {
        "Cache-Control": "public, max-age=86400",
      },
    },
  );
}
