/* -------------------------------------------------------------------------- */
/*  CSP violations — the check that #242 needed and did not have.              */
/*                                                                            */
/*    BASE_URL=http://localhost:<port> node e2e/csp-violations.spec.mjs        */
/*                                                                            */
/*  #242 tightened style-src to `style-src-elem 'self'` on the premise that    */
/*  "the app ships zero <style> tags", verified by reading the rendered HTML.  */
/*  That premise was TRUE OF THE MARKUP and still took every route down:       */
/*  `sonner` writes its stylesheet into a <style> element at RUNTIME when the  */
/*  toaster mounts, and the toaster is mounted app-wide in the root layout.    */
/*  Safari refused the stylesheet, webpack's chunk load rejected with it, and  */
/*  the error boundary caught the fallout as "Something went wrong".           */
/*                                                                            */
/*  No amount of grepping source, reading build output, or curling HTML can    */
/*  see that block — it does not exist until a component has mounted in a      */
/*  live browser. So this spec is the only instrument that can hold the line:  */
/*  it loads real routes with the CSP ENFORCED and fails on any violation the  */
/*  browser reports.                                                          */
/*                                                                            */
/*  RUN IT AGAINST A PRODUCTION BUILD (`next build && next start`), not        */
/*  `next dev`: script-src carries 'unsafe-eval' only in dev, and dev injects  */
/*  styles for HMR that production never ships. Dev would report violations    */
/*  prod does not have, and miss the shape of the policy users actually get.   */
/*                                                                            */
/*  Chromium is enough. Safari escalated the same refusal into a crash where   */
/*  Chromium logged it and carried on, but BOTH report the violation — so the  */
/*  console is the signal, not the crash.                                     */
/* -------------------------------------------------------------------------- */

import { launchChromium } from "./_launch.mjs";

const BASE = process.env.BASE_URL ?? "http://localhost:3140";

// Public routes only: this runs without a session, and a protected route
// would 307 to /login and prove nothing about the page it redirected from.
const ROUTES = ["/", "/login", "/signup", "/blog", "/about", "/reset-password"];

let failures = 0;
const check = (name, ok, detail = "") => {
  console.log(`${ok ? "  ok  " : " FAIL "} ${name}${detail ? `  — ${detail}` : ""}`);
  if (!ok) failures++;
};

/** A CSP refusal as the browser reports it, in console text or as a violation event. */
const isCspMessage = (t) =>
  /Refused to (apply|load|execute|connect|frame)|Content Security Policy/i.test(t);

const browser = await launchChromium();
const ctx = await browser.newContext();

for (const route of ROUTES) {
  const page = await ctx.newPage();
  const violations = [];
  const pageErrors = [];

  page.on("console", (m) => {
    const t = m.text();
    if (isCspMessage(t)) violations.push(t);
  });
  page.on("pageerror", (e) => pageErrors.push(String(e)));

  // securitypolicyviolation fires for refusals the console may format
  // differently across versions; belt and braces.
  await page.addInitScript(() => {
    window.__cspViolations = [];
    document.addEventListener("securitypolicyviolation", (e) => {
      window.__cspViolations.push(`${e.violatedDirective} blocked ${e.blockedURI}`);
    });
  });

  await page.goto(BASE + route, { waitUntil: "networkidle", timeout: 45000 });
  // Client components mount after hydration, and the injected stylesheet
  // lands with them — asserting before this races the very thing we test.
  await page.waitForTimeout(1500);

  const evented = await page.evaluate(() => window.__cspViolations ?? []);
  const all = [...violations, ...evented];

  const crashed = await page.evaluate(() =>
    /Something went wrong/i.test(document.body.innerText.slice(0, 200))
  );

  check(`${route} — no CSP violations`, all.length === 0, all.slice(0, 2).join(" | ").slice(0, 200));
  check(`${route} — no uncaught page errors`, pageErrors.length === 0, pageErrors[0]?.slice(0, 140) ?? "");
  check(`${route} — did not fall through to the error boundary`, !crashed);

  await page.close();
}

/* ---------------------------------------------------------------------------
   The positive assertion, and the reason this spec is not just "no errors":
   a policy that blocked the injected stylesheet would still pass every check
   above if the block simply never appeared. So prove it IS there and IS live
   — a <style> element whose sheet actually carries rules. When it is refused,
   the element remains in the DOM but its sheet is empty, which is exactly the
   state #242 shipped.
--------------------------------------------------------------------------- */
const page = await ctx.newPage();
await page.goto(BASE + "/", { waitUntil: "networkidle", timeout: 45000 });
await page.waitForTimeout(1500);

const styles = await page.evaluate(() =>
  Array.from(document.querySelectorAll("style")).map((s) => ({
    applied: !!s.sheet && s.sheet.cssRules.length > 0,
    text: (s.textContent ?? "").slice(0, 60),
  }))
);

check("a runtime-injected <style> element is present", styles.length > 0, `found ${styles.length}`);
check(
  "every injected <style> is actually applied (not refused)",
  styles.length > 0 && styles.every((s) => s.applied),
  styles.filter((s) => !s.applied).map((s) => s.text).join(" | ")
);

await page.close();
await browser.close();

console.log(failures === 0 ? "\nPASS — no CSP violations" : `\nFAIL — ${failures} check(s)`);
process.exit(failures === 0 ? 0 : 1);
