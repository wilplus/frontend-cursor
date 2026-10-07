/* -------------------------------------------------------------------------- */
/*  The Feedback walk's practise, answered in the browser (build plan          */
/*  D-FW-16). Shared by e2e/feedback-walk.spec.mjs and the screenshot          */
/*  manifest, so both drive the PRODUCTION walk on /dev/feedback-walk?live=1   */
/*  through the app's own clients and BFF routes, with:                        */
/*                                                                            */
/*    a signed-in session   the Supabase seed the other specs use, keyed on   */
/*                          the "dummy" project ref of the e2e placeholders   */
/*    a microphone          a tone from an oscillator: no device, no prompt   */
/*    the practise routes   open, attempts and check answered here; the       */
/*                          check answers one entry of `answers` per try      */
/*                          ("hang" never answers: the read is late, O5)      */
/*                                                                            */
/*  The check's body carries the fields the server keeps for itself (lane, a  */
/*  value) on purpose: the screens must show neither (AC-9).                  */
/* -------------------------------------------------------------------------- */

const REF = process.env.SUPABASE_REF || "dummy";

const SESSION = {
  access_token: "test-token", token_type: "bearer", expires_in: 3600,
  expires_at: Math.floor(Date.now() / 1000) + 3600, refresh_token: "r",
  user: { id: "u1", email: "t@t.co", aud: "authenticated", role: "authenticated" },
};

const PRACTICE_ID = "11111111-1111-4111-8111-111111111111";

function practiceJson(tries) {
  return {
    id: PRACTICE_ID,
    status: "open",
    kind: "rewrite",
    exercise: { exercise_id: "rewrite", version: 1, title: "", instruction: "" },
    passage: "",
    attempts: Array.from({ length: tries }, (_, i) => ({
      id: `aaaaaaaa-aaaa-4aaa-8aaa-00000000000${i + 1}`,
      attempt_index: i + 1, audio_ref: "x", duration_ms: 3000, assessment: "ok",
    })),
  };
}

/** The try's words a praise hands back (the harness's accepted words). */
export const TRY_WORDS = "The window closes once the incumbents match our price.";

/** Seed the session and the microphone before the page loads. */
export async function seedPractise(context) {
  // The browser client reads the cookie (@supabase/ssr); localStorage too.
  await context.addCookies([{
    name: `sb-${REF}-auth-token`,
    value: "base64-" + Buffer.from(JSON.stringify(SESSION)).toString("base64"),
    domain: "localhost", path: "/",
  }]);
  await context.addInitScript(([ref, session]) => {
    try {
      for (const k of Object.keys(localStorage)) if (k.startsWith("sb-")) localStorage.removeItem(k);
      localStorage.setItem(`sb-${ref}-auth-token`, JSON.stringify(session));
    } catch {
      /* storage blocked: the practise reads as late, which the spec reports */
    }
    if (!navigator.mediaDevices) return;
    navigator.mediaDevices.getUserMedia = async () => {
      const ctx = new AudioContext();
      const tone = ctx.createOscillator();
      const out = ctx.createMediaStreamDestination();
      tone.connect(out);
      tone.start();
      return out.stream;
    };
  }, [REF, SESSION]);
}

/** Answer the practise routes. `answers` is consumed one per try. Returns
 *  the calls made, for the spec to check. */
export async function routePractise(context, answers) {
  const queue = [...answers];
  const calls = [];
  let tries = 0;
  const json = (route, body, status = 200) =>
    route.fulfill({ status, contentType: "application/json", body: JSON.stringify(body) });
  await context.route("**/api/v2/user/snippets/*/confidence-practice", (route) => {
    calls.push("open");
    return json(route, { practice: practiceJson(0) });
  });
  await context.route("**/api/v2/user/confidence-practice/*/attempts", (route) => {
    tries += 1;
    calls.push(`upload:${tries}`);
    return json(route, { practice: practiceJson(tries) });
  });
  await context.route("**/api/v2/user/confidence-practice/*/attempts/*/check", (route) => {
    const answer = queue.shift() ?? "hang";
    calls.push(`check:${typeof answer === "string" ? answer : answer.next}`);
    if (answer === "hang") return undefined; // never answered: a late read (O5)
    return json(route, {
      outcome: answer.next === "praise" ? "done" : answer.next,
      check: { ...answer, lane: "cue", z: 1.37, rule_version: "practice-check-v2" },
      attempt_transcript: answer.next === "praise" ? TRY_WORDS : null,
      practice: practiceJson(tries),
    });
  });
  return calls;
}

/** Both at once, for a manifest entry's `prepare`. */
export const practisePrepare = (answers) => async (context) => {
  await seedPractise(context);
  await routePractise(context, answers);
};

const LIVE = "[data-feedback-walk] .walk-layer:not(.walk-ghost)";
export const liveScreen = (key) => `${LIVE} [data-testid="walk-screen-${key}"]`;

async function tap(page, key, testId) {
  await page.locator(`${liveScreen(key)} [data-testid="${testId}"]`).filter({ visible: true }).first()
    .click({ timeout: 60_000 });
}

/** From the coach's note to the practise on the accepted words: past both
 *  praises (their helper words skipped) and "Accept and practise". */
export async function toLivePractise(page) {
  await tap(page, "coachnote", "walk-forward");
  await tap(page, "praise", "walk-forward");
  await tap(page, "helpers", "walk-skip");
  await tap(page, "praise", "walk-forward");
  await tap(page, "helpers", "walk-skip");
  await tap(page, "clearer", "walk-forward");
  await page.waitForSelector(`${liveScreen("practise")} [data-walk-recording-strip]`, { timeout: 60_000 });
}

/** Record a moment, then Stop. */
export async function stopTry(page, ms = 1200) {
  await page.waitForTimeout(ms);
  await page.locator(`${liveScreen("practise")} [data-walk-recording-strip] button`).click({ timeout: 60_000 });
}
