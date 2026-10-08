/* -------------------------------------------------------------------------- */
/*  "Judgement time!" on the PRODUCTION walk (/dev/feedback-walk?live=1),      */
/*  build plan D-FW-18. Shared by e2e/feedback-walk.spec.mjs and the           */
/*  screenshot manifest:                                                       */
/*                                                                            */
/*    routeJournal  answers the app's own Journal route for the signed         */
/*                  self-modeling post (JP1 A), or a 404 ("missing"): the     */
/*                  walk then shows no link                                    */
/*    toLiveIntro   from the coach's note to "Judgement time!" through the     */
/*                  walk's own buttons, with no practise: both praises (their */
/*                  helper words skipped), "Keep my words" on the clearer      */
/*                  version, Skip on the exercise's video                      */
/* -------------------------------------------------------------------------- */

import { liveScreen } from "./_walkPractise.mjs";

export const JOURNAL_SLUG = "why-we-ask-you-to-judge-honestly";

/** The signed post as the public backend serves it (JP1 A, N53.4). */
export const JOURNAL_POST = {
  slug: JOURNAL_SLUG,
  title: "Why we ask you to judge honestly",
  excerpt: "Dowrick's self-modeling, and why an honest answer trains your ear.",
  category: "science",
  author_name: "WillpowerLab",
  body: [
    "The psychologist Peter Dowrick spent decades studying how people learn by watching themselves. He called it self-modeling: when you see or hear yourself doing something a little better than you usually do, it shows you what you can already do, and you learn it quickly. His review 'Self model theory: learning from the future' (2012) brings that work together.",
    "WillpowerLab uses the same idea. Your most confident moments are kept, so you can hear what your confident voice already sounds like.",
    "Judging is our own addition to it. When you listen to a recording and answer one question, 'Does this sound confident to you?', you train your ear to notice confidence, in other voices and in your own. Honest answers sharpen that ear; kind answers that aren't true blur it. The clearer you can hear a confident voice, the less room is left for the inner critic.",
    "Reference: Dowrick, P. W. (2012). Self model theory: learning from the future. WIREs Cognitive Science, 3(2), 215–230.",
  ].join("\n\n"),
};

/** The citation's own figures, the only digits the post's screen may show
 *  (they are the article's, not a score: AC-9 scans allow exactly these). */
export const JOURNAL_ALLOW = [/\b2012\b/, /\b3\(2\)/, /\b215–230\b/];

/** Answer the Journal route: the post, or a 404. */
export async function routeJournal(context, mode = "published") {
  await context.route(`**/api/v2/journal/posts/${JOURNAL_SLUG}`, (route) =>
    mode === "published"
      ? route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(JOURNAL_POST) })
      : route.fulfill({ status: 404, contentType: "application/json", body: JSON.stringify({ post: null }) }),
  );
}

async function tap(page, key, testId) {
  await page.locator(`${liveScreen(key)} [data-testid="${testId}"]`).filter({ visible: true }).first()
    .click({ timeout: 60_000 });
}

/** From the coach's note to "Judgement time!". */
export async function toLiveIntro(page) {
  await tap(page, "coachnote", "walk-forward");
  await tap(page, "praise", "walk-forward");
  await tap(page, "helpers", "walk-skip");
  await tap(page, "praise", "walk-forward");
  await tap(page, "helpers", "walk-skip");
  await tap(page, "clearer", "walk-keep");
  await tap(page, "exVideo", "walk-skip");
  await page.waitForSelector(`${liveScreen("intro")} [data-testid="walk-forward"]`, { timeout: 60_000 });
}

/** From "Judgement time!" to the post inside the walk. */
export async function toLiveJournal(page) {
  await toLiveIntro(page);
  await tap(page, "intro", "walk-journal");
  await page.waitForSelector(`${liveScreen("journal")} [data-walk-journal-title]`, { timeout: 60_000 });
}

/** From "Judgement time!" to the first judgement. */
export async function toLiveJudge(page) {
  await toLiveIntro(page);
  await tap(page, "intro", "walk-forward");
  await page.waitForSelector(`${liveScreen("judge")} [data-walk-judgement]`, { timeout: 60_000 });
}
