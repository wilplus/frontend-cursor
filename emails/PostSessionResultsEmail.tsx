/**
 * PostSessionResultsEmail
 *
 * Transactional email sent when an admin publishes new voice snippets
 * for a user. Built with @react-email/components so it can be compiled
 * into cross-client safe HTML via @react-email/render — Outlook,
 * Apple Mail, Gmail, mobile clients.
 *
 * Design tokens are HARDCODED HEX (no Tailwind HSL vars) per spec
 * §2 — many email clients strip CSS custom properties, so vars
 * resolve to nothing. Same reason the staggered fade-in-up animation
 * lives in a <style> block inside <Head> and the email is laid out
 * to be readable even when that block is stripped.
 *
 * NOTES ON SPEC GAPS (call out, don't bury):
 *   • The "Reference Implementation", spec §3.5 (chip table), and
 *     spec §6 (plain-text fallback) were referenced but not pasted.
 *     The chip table layout, the body copy, and the navigation row
 *     contents were filled in from the brand voice on /results.
 *     Treat anything below as a first draft to iterate on, NOT as
 *     a faithful reproduction of a Lovable mock.
 *   • The Pacifico <Font> load uses Google Fonts. Outlook strips it;
 *     Apple Mail and Gmail web load it. The fallback for the
 *     "willab." wordmark when Pacifico fails to load is "Brush Script
 *     MT, cursive" — the cleanest non-Pacifico script that ships on
 *     macOS and Windows.
 */

import {
  Body,
  Container,
  Font,
  Head,
  Heading,
  Hr,
  Html,
  Img,
  Link,
  Preview,
  Section,
  Text,
} from "@react-email/components";

/* -------------------------------------------------------------------------- */
/* Design tokens (per spec §2 — hardcoded HEX, no CSS vars)                   */
/* -------------------------------------------------------------------------- */

const COLOR = {
  bg: "#FAF7F2",
  card: "#FCFAF6",
  border: "#EFE9DE",
  primary: "#F97316",
  primarySoft: "#FFEDD5",
  text: "#1F1A14",
  textMuted: "#6B6256",
  textOnPrimary: "#FFFFFF",
  divider: "#EFE9DE",
} as const;

const FONT_STACK_SYSTEM =
  'ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
const FONT_STACK_PACIFICO = `"Pacifico", "Brush Script MT", cursive`;

/* -------------------------------------------------------------------------- */
/* Static lucide SVG strings — Mic + Trophy (per spec §3, info chips)         */
/* Inline SVG so they don't depend on any external image host.                */
/* -------------------------------------------------------------------------- */

const ICON_SIZE = 14;

const MIC_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="${ICON_SIZE}" height="${ICON_SIZE}" viewBox="0 0 24 24" fill="none" stroke="${COLOR.primary}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" x2="12" y1="19" y2="22"/></svg>`;

const TROPHY_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="${ICON_SIZE}" height="${ICON_SIZE}" viewBox="0 0 24 24" fill="none" stroke="${COLOR.primary}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6"/><path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18"/><path d="M4 22h16"/><path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22"/><path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22"/><path d="M18 2H6v7a6 6 0 0 0 12 0V2Z"/></svg>`;

/* -------------------------------------------------------------------------- */
/* Props                                                                       */
/* -------------------------------------------------------------------------- */

export interface PostSessionResultsEmailProps {
  userFirstName?: string | null;
  snippetCount: number;
  topTheme: string;
  journeyUrl: string;
  unsubscribeUrl: string;
  /**
   * Kept on the contract per the original spec, even though the
   * footer no longer renders a "delivered to <email>" line. Keep
   * this around so a future variant (e.g. a "Delivered to" stamp
   * or a list-unsubscribe header) can re-introduce it without a
   * prop-shape break.
   */
  subscribedEmail: string;
}

/* -------------------------------------------------------------------------- */
/* Email                                                                       */
/* -------------------------------------------------------------------------- */

export default function PostSessionResultsEmail({
  userFirstName,
  snippetCount,
  // topTheme intentionally NOT destructured — kept on the props
  // interface for backend BFF compat but no longer rendered.
  journeyUrl,
  unsubscribeUrl,
}: PostSessionResultsEmailProps) {
  const greeting = userFirstName?.trim()
    ? `Hi ${userFirstName.trim()},`
    : `Hi there,`;

  // Inbox preview text. topTheme used to be tacked on the end here
  // ("… — High Charisma."), removed per spec along with the chip.
  const previewText = `${snippetCount} new voice ${
    snippetCount === 1 ? "moment" : "moments"
  } from your last session.`;

  return (
    <Html>
      <Head>
        <meta name="color-scheme" content="light only" />
        <meta name="supported-color-schemes" content="light" />

        {/* Pacifico for the "willab." wordmark only. Gracefully
            falls back to "Brush Script MT, cursive" in Outlook +
            other clients that strip Google Fonts. */}
        <Font
          fontFamily="Pacifico"
          fallbackFontFamily="cursive"
          webFont={{
            url: "https://fonts.gstatic.com/s/pacifico/v22/FwZY7-Qmy14u9lezJ-6H6MmBp0u-.woff2",
            format: "woff2",
          }}
          fontWeight={400}
          fontStyle="normal"
        />

        {/* Staggered fade-in-up — pure progressive enhancement.
            Email clients that strip <style> show the static layout. */}
        <style>{`
          @keyframes pse-fade-in-up {
            0%   { opacity: 0; transform: translateY(8px); }
            100% { opacity: 1; transform: translateY(0); }
          }
          .pse-fade { opacity: 1; }
          @media (prefers-reduced-motion: no-preference) {
            .pse-fade {
              opacity: 0;
              animation: pse-fade-in-up 0.45s ease-out forwards;
            }
            .pse-fade-1 { animation-delay: 0ms; }
            .pse-fade-2 { animation-delay: 80ms; }
            .pse-fade-3 { animation-delay: 160ms; }
            .pse-fade-4 { animation-delay: 240ms; }
            .pse-fade-5 { animation-delay: 320ms; }
          }
        `}</style>
      </Head>

      <Preview>{previewText}</Preview>

      <Body
        style={{
          backgroundColor: COLOR.bg,
          fontFamily: FONT_STACK_SYSTEM,
          color: COLOR.text,
          margin: 0,
          padding: "32px 16px",
          WebkitFontSmoothing: "antialiased",
        }}
      >
        <Container
          style={{
            maxWidth: 580,
            margin: "0 auto",
          }}
        >
          {/* Top: centred Willab wordmark logo, dynamically rendered
              by /willab-logo (src/app/willab-logo/route.tsx — Vercel
              edge ImageResponse with Pacifico baked into the PNG).
              4:1 aspect (480×120 source) sits properly in an email
              header at ~160 px wide. Renders identically in every
              email client because the font is rasterised — no
              Google Fonts strip risk. */}
          <Section style={{ paddingBottom: 24, textAlign: "center" }}>
            <Img
              src="https://www.willonski.com/willab-logo"
              alt="Willab"
              width="160"
              height="40"
              style={{
                display: "inline-block",
                width: "160px",
                height: "auto",
                border: 0,
              }}
            />
          </Section>

          {/* Card */}
          <Section
            style={{
              backgroundColor: COLOR.card,
              border: `1px solid ${COLOR.border}`,
              borderRadius: 16,
              padding: 40,
            }}
          >
            {/* Eyebrow */}
            <Text
              className="pse-fade pse-fade-1"
              style={{
                margin: 0,
                fontSize: 12,
                letterSpacing: "0.08em",
                textTransform: "uppercase",
                color: COLOR.primary,
                fontWeight: 600,
              }}
            >
              Your Voice Journey
            </Text>

            {/* Headline */}
            <Heading
              as="h1"
              className="pse-fade pse-fade-2"
              style={{
                margin: "8px 0 0 0",
                fontFamily: FONT_STACK_SYSTEM,
                fontWeight: 600,
                fontSize: 28,
                lineHeight: "34px",
                color: COLOR.text,
              }}
            >
              {greeting}
              <br />
              your latest voice moments are ready.
            </Heading>

            {/* Body copy */}
            <Text
              className="pse-fade pse-fade-3"
              style={{
                margin: "20px 0 0 0",
                fontSize: 16,
                lineHeight: "26px",
                color: COLOR.text,
              }}
            >
              Your coach finished pulling out the moments where your delivery
              hit hardest — and the ones worth a second pass. Open your
              journey to listen back, read the coach&apos;s notes, and pick
              what to push on next.
            </Text>

            {/* Info chips (spec §3.5 — table layout for Outlook).
                Two equal columns, each with an inline SVG icon + label.
                Built as a table so Outlook 2016+ honours the side-by-side
                layout — flex/grid would collapse there. */}
            <table
              role="presentation"
              cellPadding={0}
              cellSpacing={0}
              border={0}
              className="pse-fade pse-fade-4"
              style={{ width: "100%", marginTop: 28, borderCollapse: "separate", borderSpacing: 0 }}
            >
              <tbody>
                <tr>
                  {/* Single full-width Published-snippets chip. The
                      Top-theme cell that used to live alongside this
                      was removed per spec — the topic/theme readout
                      no longer ships in the email body. `topTheme`
                      stays on the props interface for backend BFF
                      compat but is not rendered. */}
                  <td
                    style={{
                      width: "100%",
                      verticalAlign: "middle",
                    }}
                  >
                    <table
                      role="presentation"
                      cellPadding={0}
                      cellSpacing={0}
                      border={0}
                      style={{
                        width: "100%",
                        backgroundColor: COLOR.primarySoft,
                        borderRadius: 12,
                        padding: "12px 14px",
                      }}
                    >
                      <tbody>
                        <tr>
                          <td
                            style={{
                              width: ICON_SIZE,
                              verticalAlign: "middle",
                              paddingRight: 8,
                              lineHeight: 0,
                            }}
                            dangerouslySetInnerHTML={{ __html: MIC_SVG }}
                          />
                          <td style={{ verticalAlign: "middle" }}>
                            <span
                              style={{
                                display: "block",
                                fontSize: 11,
                                letterSpacing: "0.06em",
                                textTransform: "uppercase",
                                color: COLOR.textMuted,
                                fontWeight: 600,
                                lineHeight: "13px",
                              }}
                            >
                              Published snippets
                            </span>
                            <span
                              style={{
                                display: "block",
                                marginTop: 2,
                                fontSize: 16,
                                fontWeight: 600,
                                color: COLOR.text,
                                lineHeight: "20px",
                              }}
                            >
                              {snippetCount} new
                            </span>
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </td>
                </tr>
              </tbody>
            </table>

            {/* CTA pill — Inline anchor so Outlook stops reflowing it.
                The pill is centred via a single-cell table — Outlook
                ignores text-align on the parent for inline-blocks. */}
            <table
              role="presentation"
              cellPadding={0}
              cellSpacing={0}
              border={0}
              className="pse-fade pse-fade-5"
              style={{ width: "100%", marginTop: 32 }}
            >
              <tbody>
                <tr>
                  <td align="center">
                    <Link
                      href={journeyUrl}
                      style={{
                        display: "inline-block",
                        backgroundColor: COLOR.primary,
                        color: COLOR.textOnPrimary,
                        textDecoration: "none",
                        fontWeight: 600,
                        fontSize: 15,
                        lineHeight: "20px",
                        padding: "14px 28px",
                        borderRadius: 9999,
                      }}
                    >
                      Open your Voice Journey →
                    </Link>
                  </td>
                </tr>
              </tbody>
            </table>

            <Hr
              style={{
                borderTop: `1px solid ${COLOR.divider}`,
                borderBottom: 0,
                borderLeft: 0,
                borderRight: 0,
                margin: "32px 0 24px 0",
              }}
            />

            <Text
              style={{
                margin: 0,
                fontSize: 13,
                lineHeight: "20px",
                color: COLOR.textMuted,
              }}
            >
              Each snippet has a coach note, a one-tap player, and a CTA back
              into a contextual chat — pick the moment that grabs you and
              push on it.
            </Text>
          </Section>

          {/* Footer — three legal/admin links only. */}
          <Section style={{ padding: "24px 8px 0 8px", textAlign: "center" }}>
            <Text
              style={{
                margin: 0,
                fontSize: 12,
                lineHeight: "18px",
                color: COLOR.textMuted,
              }}
            >
              <Link
                href={unsubscribeUrl}
                style={{ color: COLOR.textMuted, textDecoration: "underline" }}
              >
                Unsubscribe
              </Link>
              <span>{"  ·  "}</span>
              <Link
                href="https://www.willonski.com/privacy"
                style={{ color: COLOR.textMuted, textDecoration: "underline" }}
              >
                Privacy
              </Link>
              <span>{"  ·  "}</span>
              <Link
                href="https://www.willonski.com/terms"
                style={{ color: COLOR.textMuted, textDecoration: "underline" }}
              >
                Terms
              </Link>
            </Text>
          </Section>
        </Container>

        {/* Bare-image fallback so plain-text-only clients with image
            indexing still get *something* visual. Tiny so it doesn't
            inflate the email. */}
        <Img
          src="https://www.willonski.com/icon"
          width={1}
          height={1}
          alt=""
          style={{ display: "none" }}
        />
      </Body>
    </Html>
  );
}

/* -------------------------------------------------------------------------- */
/* Default props for react-email's preview server.                            */
/* -------------------------------------------------------------------------- */

PostSessionResultsEmail.PreviewProps = {
  userFirstName: "Artur",
  snippetCount: 5,
  topTheme: "High Charisma",
  journeyUrl: "https://www.willonski.com/results",
  unsubscribeUrl: "https://www.willonski.com/unsubscribe?token=preview",
  subscribedEmail: "artur@willonski.com",
} satisfies PostSessionResultsEmailProps;
