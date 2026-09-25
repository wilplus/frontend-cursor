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
 *   • The header is the app's own logo, rendered to a PNG by
 *     /willab-logo so no web font is needed (founder 2026-09-25).
 */

import {
  Body,
  Container,

  Head,
  Heading,
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

/* -------------------------------------------------------------------------- */
/* Copy — signed off by the founder 2026-09-25                                 */
/* -------------------------------------------------------------------------- */

/** The one line that says what happened. A count of moments, never a score
 *  (AC-9). Shared with the plain-text part so the two cannot drift. */
export function momentsLine(snippetCount: number): string {
  const n = Math.max(0, Math.floor(snippetCount || 0));
  if (n === 0) return "Your coach listened to your latest take and left feedback.";
  return `Your coach listened to your latest take and left feedback on ${n} ${
    n === 1 ? "moment" : "moments"
  }.`;
}

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

/* FOUNDER 2026-09-25: the old subject stays, the body is new and has one
   button, and the header is the app's own logo (/willab-logo). The project
   name leads, because the email is about ONE talk. `userFirstName` stays on
   the props for backend compatibility; the greeting is gone. */
export default function PostSessionResultsEmail({
  snippetCount,
  topTheme,
  journeyUrl,
  unsubscribeUrl,
}: PostSessionResultsEmailProps) {
  const previewText = momentsLine(snippetCount);

  return (
    <Html>
      <Head>
        <meta name="color-scheme" content="light only" />
        <meta name="supported-color-schemes" content="light" />

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
          {/* Top: the app's own logo — three dots and "WillpowerLab" —
              rendered by /willab-logo (src/app/willab-logo/route.tsx, an
              edge ImageResponse). 520×120 source, shown ~182 px wide. Renders identically in every
              email client because the font is rasterised — no
              Google Fonts strip risk. */}
          <Section style={{ paddingBottom: 24, textAlign: "center" }}>
            <Img
              src="https://www.willpowerlab.com/willab-logo"
              alt="WillpowerLab"
              width="182"
              height="42"
              style={{
                display: "inline-block",
                width: "182px",
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
              {topTheme}
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
              Your coach&apos;s feedback is in.
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
              {momentsLine(snippetCount)}
            </Text>
            <Text
              className="pse-fade pse-fade-4"
              style={{
                margin: "12px 0 0 0",
                fontSize: 16,
                lineHeight: "26px",
                color: COLOR.text,
              }}
            >
              Open it to hear each moment, say how it sounded to you, and see
              your coach&apos;s notes and exercises.
            </Text>

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
                      Open the feedback
                    </Link>
                  </td>
                </tr>
              </tbody>
            </table>

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
                href="https://www.willpowerlab.com/privacy"
                style={{ color: COLOR.textMuted, textDecoration: "underline" }}
              >
                Privacy
              </Link>
              <span>{"  ·  "}</span>
              <Link
                href="https://www.willpowerlab.com/terms"
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
          src="https://www.willpowerlab.com/icon"
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
  // Canonical post-publish deep-link is now /chat?session=<id> — the
  // standalone /results page was retired in favour of the in-chat
  // review flow. Backend must construct the URL with this shape;
  // we only validate it's a fully-qualified http(s) URL.
  journeyUrl: "https://www.willpowerlab.com/chat?session=preview-session-id",
  unsubscribeUrl: "https://www.willpowerlab.com/unsubscribe?token=preview",
  subscribedEmail: "artur@willonski.com",
} satisfies PostSessionResultsEmailProps;
