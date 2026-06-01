/**
 * ResultsReadyEmail - Email sent to users when admin publishes their results
 *
 * Shows their charisma snippets are ready and provides a CTA to view them.
 * Used in: POST /v2/internal/publish-session-results (admin endpoint)
 */

interface ResultsReadyEmailProps {
  userName?: string;
  resultsUrl: string;
  sessionId: string;
}

export default function ResultsReadyEmail({
  userName = "there",
  resultsUrl,
}: ResultsReadyEmailProps) {
  return (
    <html>
      <head>
        <meta charSet="utf-8" />
        <style>
          {`
            body {
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', sans-serif;
              line-height: 1.6;
              color: #333;
              background-color: #f9fafb;
            }
            .container {
              max-width: 600px;
              margin: 0 auto;
              background-color: white;
              border-radius: 8px;
              overflow: hidden;
              box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
            }
            .header {
              background: linear-gradient(135deg, #000 0%, #333 100%);
              color: white;
              padding: 32px 24px;
              text-align: center;
            }
            .header h1 {
              margin: 0;
              font-size: 24px;
              font-weight: 600;
            }
            .content {
              padding: 32px 24px;
            }
            .content p {
              margin: 16px 0;
              font-size: 16px;
              line-height: 1.6;
            }
            .cta-container {
              text-align: center;
              margin: 32px 0;
            }
            .cta-button {
              display: inline-block;
              background-color: #000;
              color: white;
              padding: 14px 32px;
              border-radius: 6px;
              text-decoration: none;
              font-weight: 600;
              font-size: 16px;
              transition: background-color 0.2s;
            }
            .cta-button:hover {
              background-color: #333;
            }
            .footer {
              background-color: #f9fafb;
              padding: 24px;
              text-align: center;
              border-top: 1px solid #e5e7eb;
              font-size: 12px;
              color: #6b7280;
            }
            .divider {
              margin: 24px 0;
              border: none;
              border-top: 1px solid #e5e7eb;
            }
          `}
        </style>
      </head>
      <body>
        <div className="container">
          <div className="header">
            <h1>✨ Your Charisma Snippets Are Ready</h1>
          </div>

          <div className="content">
            <p>Hi {userName},</p>

            <p>
              Your voice analysis is complete! We&apos;ve extracted your best moments and added detailed feedback from our coaches.
            </p>

            <p>
              Check out your personalized Charisma Snippets—these are the moments where you showed exceptional communication skills.
            </p>

            <div className="cta-container">
              <a href={resultsUrl} className="cta-button">
                View Your Charisma Snippets →
              </a>
            </div>

            <p style={{ fontSize: "14px", color: "#6b7280", marginTop: "24px" }}>
              Each snippet includes detailed feedback from our coaches to help you understand what made that moment stand out.
            </p>

            <hr className="divider" />

            <p style={{ fontSize: "14px", margin: "16px 0" }}>
              Questions? Reply to this email or contact our support team.
            </p>
          </div>

          <div className="footer">
            <p style={{ margin: "0 0 8px 0" }}>
              © {new Date().getFullYear()} Willab. All rights reserved.
            </p>
            <p style={{ margin: "0" }}>
              This is an automated message—please don&apos;t reply directly to this email.
            </p>
          </div>
        </div>
      </body>
    </html>
  );
}

/**
 * Helper to convert component to HTML string for email sending
 * Usage: renderToString(<ResultsReadyEmail ... />)
 */
export function getResultsReadyEmailHTML(
  userName: string,
  resultsUrl: string,
  sessionId: string
): string {
  // In production, use renderToString from react-dom/server
  // For now, return the basic HTML structure
  return `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; color: #333; background-color: #f9fafb; }
          .container { max-width: 600px; margin: 0 auto; background-color: white; border-radius: 8px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); }
          .header { background: linear-gradient(135deg, #000 0%, #333 100%); color: white; padding: 32px 24px; text-align: center; }
          .header h1 { margin: 0; font-size: 24px; font-weight: 600; }
          .content { padding: 32px 24px; }
          .content p { margin: 16px 0; font-size: 16px; line-height: 1.6; }
          .cta-container { text-align: center; margin: 32px 0; }
          .cta-button { display: inline-block; background-color: #000; color: white; padding: 14px 32px; border-radius: 6px; text-decoration: none; font-weight: 600; font-size: 16px; }
          .footer { background-color: #f9fafb; padding: 24px; text-align: center; border-top: 1px solid #e5e7eb; font-size: 12px; color: #6b7280; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>✨ Your Charisma Snippets Are Ready</h1>
          </div>
          <div class="content">
            <p>Hi ${userName},</p>
            <p>Your voice analysis is complete! We've extracted your best moments and added detailed feedback from our coaches.</p>
            <p>Check out your personalized Charisma Snippets—these are the moments where you showed exceptional communication skills.</p>
            <div class="cta-container">
              <a href="${resultsUrl}" class="cta-button">View Your Charisma Snippets →</a>
            </div>
            <p style="font-size: 14px; color: #6b7280; margin-top: 24px;">
              Each snippet includes detailed feedback from our coaches to help you understand what made that moment stand out.
            </p>
          </div>
          <div class="footer">
            <p style="margin: 0 0 8px 0;">© ${new Date().getFullYear()} Willab. All rights reserved.</p>
            <p style="margin: 0;">This is an automated message—please don't reply directly to this email.</p>
          </div>
        </div>
      </body>
    </html>
  `;
}
