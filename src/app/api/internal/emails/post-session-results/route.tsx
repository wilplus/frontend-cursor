import { NextRequest, NextResponse } from "next/server";
import { render } from "@react-email/render";
import PostSessionResultsEmail, {
  type PostSessionResultsEmailProps,
} from "../../../../../../emails/PostSessionResultsEmail";
import { buildPostSessionResultsText } from "../../../../../../emails/postSessionResultsText";

const BFF_REVISION = "internal-render-post-session-results-v1";

/**
 * POST /api/internal/emails/post-session-results
 *
 * Server-to-server render endpoint. The Python backend POSTs a
 * fully-formed PostSessionResultsEmailProps payload here and gets
 * back the rendered HTML (cross-client safe via @react-email/render's
 * `render()` — inlined CSS, no CSS vars, table-based layout) plus
 * the matching plain-text MIME part.
 *
 * Why an HTTP endpoint and not a Node-importable helper:
 *   • Backend is Python on Railway, frontend is Next.js on Vercel —
 *     no shared runtime.
 *   • This way the React Email template stays the single source of
 *     truth: backend never re-implements the layout in Jinja or
 *     hand-written HTML.
 *
 * Auth: shared secret in `EMAIL_RENDER_SECRET` env var (required on
 * both Vercel + Railway). Sent in the `x-internal-secret` header on
 * every request. Mismatched/missing secret → 401.
 *
 * Body:    PostSessionResultsEmailProps (see emails/PostSessionResultsEmail.tsx)
 * Returns: { html: string, text: string }
 *
 * 401 INVALID_SECRET     — header missing or wrong
 * 400 INVALID_INPUT      — body fails schema check (snippetCount, urls, …)
 * 500 RENDER_FAILED      — render() threw; check server logs
 */
export async function POST(req: NextRequest) {
  try {
    // ── Auth ──────────────────────────────────────────────────────
    const expected = process.env.EMAIL_RENDER_SECRET?.trim();
    if (!expected) {
      // Misconfig (env var missing on the host) — fail closed and
      // log loudly. Do NOT silently render: anyone could call this.
      console.error(
        "[render/post-session-results] EMAIL_RENDER_SECRET is not set on the server"
      );
      return NextResponse.json(
        { code: "MISCONFIGURED", error: "Render endpoint not configured" },
        { status: 500 }
      );
    }
    const provided = req.headers.get("x-internal-secret")?.trim();
    if (!provided || provided !== expected) {
      return NextResponse.json(
        { code: "INVALID_SECRET", error: "Bad or missing x-internal-secret" },
        { status: 401 }
      );
    }

    // ── Body validation ───────────────────────────────────────────
    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    const issues: string[] = [];

    const snippetCount = body.snippetCount;
    if (typeof snippetCount !== "number" || !Number.isFinite(snippetCount) || snippetCount < 0) {
      issues.push("`snippetCount` must be a non-negative number");
    }
    const topTheme = body.topTheme;
    if (typeof topTheme !== "string" || !topTheme.trim()) {
      issues.push("`topTheme` must be a non-empty string");
    }
    const journeyUrl = body.journeyUrl;
    if (typeof journeyUrl !== "string" || !/^https?:\/\//i.test(journeyUrl)) {
      issues.push("`journeyUrl` must be a fully-qualified http(s) URL");
    }
    const unsubscribeUrl = body.unsubscribeUrl;
    if (typeof unsubscribeUrl !== "string" || !/^https?:\/\//i.test(unsubscribeUrl)) {
      issues.push("`unsubscribeUrl` must be a fully-qualified http(s) URL");
    }
    const subscribedEmail = body.subscribedEmail;
    if (typeof subscribedEmail !== "string" || !subscribedEmail.includes("@")) {
      issues.push("`subscribedEmail` must be a valid email address");
    }

    if (issues.length > 0) {
      return NextResponse.json(
        {
          code: "INVALID_INPUT",
          error: `Invalid props: ${issues.join("; ")}`,
        },
        { status: 400 }
      );
    }

    const props: PostSessionResultsEmailProps = {
      userFirstName:
        typeof body.userFirstName === "string" ? body.userFirstName : null,
      snippetCount: snippetCount as number,
      topTheme: (topTheme as string).trim(),
      journeyUrl: journeyUrl as string,
      unsubscribeUrl: unsubscribeUrl as string,
      subscribedEmail: subscribedEmail as string,
    };

    // ── Render ────────────────────────────────────────────────────
    // pretty:false strips whitespace so the wire payload stays small.
    const html = await render(<PostSessionResultsEmail {...props} />, {
      pretty: false,
    });
    const text = buildPostSessionResultsText(props);

    return NextResponse.json(
      { html, text },
      {
        status: 200,
        headers: { "Cache-Control": "no-store", bff_revision: BFF_REVISION },
      }
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const name = err instanceof Error ? err.name : "Unknown";
    console.error(
      "[render/post-session-results] render failed:",
      name,
      message,
      err
    );
    return NextResponse.json(
      {
        code: "RENDER_FAILED",
        error: `Render failed: ${name}: ${message}`,
        bff_revision: BFF_REVISION,
      },
      { status: 500 }
    );
  }
}
