# Willab — Branding & Marketing Strategy

Source of truth for how Willab presents itself and goes to market.
Scope: **US-first**, **B2B** (speech coaches/tutors + corporate L&D), **lab/scientific** tone.

Product reference: `.taskmaster/docs/APP_DESCRIPTION.md`.

---

## 1. Executive summary

Willab — short for **Willpower Lab** — is a measurement-first speech coaching
platform. A student records two short takes (warm-up + final task), sees a
real-time strength/pace wheel while speaking, answers metric self-ratings, and
receives an AI-generated report with a `performance_score_end` they can track
across sessions. Coaches assign homework; the app handles the practice and the
measurement loop in between.

The wedge is **measurable speaker improvement**. Most speech tools sell
"confidence" or "polish." Willab sells a score that moves, backed by published
internal research (EBCP, NECP). That framing is what unlocks the two B2B
buyers we care about: **independent speech coaches** who want their homework
to be rigorous and re-engaging, and **corporate L&D teams** who need to
justify training spend with longitudinal data.

US-first because (a) corporate L&D budgets concentrate there, (b) the coach
market is large and English-native, and (c) procurement and SOC2-style
buying motions are familiar.

---

## 2. Positioning

**Category:** Speech & communication training, instrumented.
We are **not** a generic public-speaking course, not a Toastmasters
replacement, and not a presentation-software competitor.

**Positioning statement.**

> For **speech coaches and corporate L&D teams** who need their communication
> training to produce visible, repeated improvement, **Willab is a
> measurement-first speech lab** that turns every practice session into a
> scored data point. Unlike confidence-focused apps and one-off workshops,
> Willab combines real-time vocal feedback with a published behavioral
> framework (EBCP/NECP), so coaches and L&D leaders can prove progress
> session-over-session.

**The three things we always say first:**
1. **Score that moves.** Every session produces a `performance_score_end`
   and a progress-over-sessions chart. Improvement is visible, not asserted.
2. **Real-time signal.** The strength + pace wheel gives students useful
   feedback in the moment, not a graded report a week later.
3. **Backed by research.** EBCP (Emotion-Based Collaborative Prompting) and
   NECP (Naming Emotions Collaborative Prompting) are linked on the Science
   page — buyers can read the actual papers, not a "science-y" landing block.

**What we explicitly do not claim:**
- We do not promise charisma "transformation" in N weeks.
- We do not benchmark against famous speakers.
- We do not score authenticity, personality, or worth.

---

## 3. Brand identity

### 3.1 Name & meaning
- **Willab** (verbal) / **Willpower Lab** (occasional expansion in long-form).
- "Lab" is load-bearing: every brand decision should reinforce that we are
  an **instrument**, not a coach replacement. Coaches keep coaching; we
  measure.
- 🎙️ remains the product mark in headers and email subjects; the microphone
  is the only ornament we use casually.

### 3.2 Brand promise
**"Practice that you can measure."**

One internal-facing line we use to settle disagreements about scope:
*If a feature does not produce, expose, or sharpen a measurement, it is not
on the roadmap this quarter.*

### 3.3 Personality
- **Measured.** We do not exclaim. Numbers and small comparisons do the work.
- **Curious.** We publish what we observe, including null results.
- **Respectful of expertise.** Coaches and L&D leaders are the customer.
  The app augments them; it does not lecture them.
- **Restrained on AI.** AI is plumbing, not a personality. Never "your AI
  coach." Use "Willab analyzes your recording" or "the report."

### 3.4 Voice & tone

| Surface | Voice |
|---|---|
| Landing & sales pages | Calm, specific, evidence-led. Short sentences. Numbers over adjectives. |
| In-app instructions | Functional and brief: "Record for at least 30 seconds." No hype. |
| Reports to students | Observational, not evaluative ("Pace dropped 12% in the last minute"), with one concrete next step. |
| Coach/admin UI | Professional, terse — these users are working, not browsing. |
| Sales emails | First-person, signed, no marketing template. Reference the buyer's actual training context. |

**Words we use:** measure, observe, signal, baseline, session, score, report,
practice, instrument, evidence.

**Words we avoid:** unleash, transform, hack, masterclass, AI coach, charisma
overhaul, 10x, secret, game-changing.

### 3.5 Visual identity (anchored on what's already shipped)

The current stack already defines the canonical palette in
`docs/STYLING_GUIDELINES.md` and `src/app/globals.css`. Do not redesign —
extend.

- **Primary:** Orange `hsl(24 95% 53%)`. Reserved for primary action, the
  wheel's active state, and the progress line on the score chart. Never
  decorative.
- **Surfaces:** `--background` / `--card` for neutrals. Heavy use of white
  space. No gradients on marketing surfaces unless they are inside a chart.
- **Type:** System sans, tight tracking on headings, generous line-height
  in body. Numbers and scores are heavier weight than surrounding text by
  one step — the number is the protagonist.
- **Imagery:** Avoid stock "businessperson with headset" photography.
  Use **plots, waveforms, wheel screenshots, and report cards** as imagery.
  When humans appear, they appear at their desk, mid-practice, not on
  stage.
- **Logo — locked.** Wordmark is **`WillpowerLab`** (CamelCase) set in
  Inter Semibold, paired with **the Reticle** — a single-color orange
  crosshair-and-dot mark. Full system, files, sizing rules, and
  do/don't are in `docs/marketing/logo-concepts/final/`. The Reticle
  mark and the in-product wheel share the same ring + center-dot
  geometry — brand and product converge by design.
- **Domain — locked.** `willpowerlab.com` primary, `willab.io`
  short-form / redirect, `willonski.com` legacy redirect.
- **Short-form / verbal nickname:** "Willab." Used in product chrome
  (the existing 🎙️ stays where it is) and casual founder voice;
  never on contracts, the homepage hero, or the wordmark itself.

### 3.6 Naming conventions for outputs
- **Session report** (not "results", not "feedback report").
- **Performance score** (the singular number students track).
- **Strength** and **pace** (the two real-time signals — never rename).
- **Progress over sessions** (the step-5 chart label — keep consistent in
  marketing screenshots).

---

## 4. Audience & ICP

Two distinct B2B buyers. Messaging and motion differ. Do not merge.

### 4.1 Independent speech coaches & small coaching businesses
- **Who:** Solo coaches and 2–20-person coaching firms working with
  executives, sales leaders, founders, or media talent in the US.
- **Pain:**
  - Homework is forgettable. Students don't practice between sessions.
  - Coaches cannot prove progress to enterprise clients procuring their time.
  - Building intake/assessment infrastructure themselves is unaffordable.
- **What they want from Willab:**
  - A homework loop their students will actually complete.
  - A score they can point to in client conversations.
  - Admin tools to assign warm-ups and review recordings.
- **Buying motion:** Self-serve trial → paid seat per active student.
  Decision in days. Champion is the coach. No procurement.

### 4.2 Corporate L&D / Enablement leaders
- **Who:** Director-level L&D, sales enablement, leadership development at
  US companies 500–10,000 FTE. Frequently report into CHRO or CRO.
- **Pain:**
  - Communication training is universally requested and universally
    impossible to measure. ROI conversations stall.
  - Existing vendors deliver workshops; engagement dies in 14 days.
  - Internal coaches don't scale beyond the top of the org chart.
- **What they want from Willab:**
  - A longitudinal score they can put in a board deck.
  - Cohort-level dashboards (aggregate of `performance_score_end` over
    time, broken down by team/program).
  - Integration into existing programs — not a replacement curriculum.
- **Buying motion:** Pilot (1 cohort, 30–60 days) → annual contract.
  Decision in weeks. Champion is L&D director; budget owner is VP People
  or VP Sales. Procurement, security review, MSA.

### 4.3 Out of scope (for now)
- B2C self-improvement individuals. The product can serve them, but
  paid acquisition CAC kills the unit economics at our current price
  assumption. Revisit after coach motion proves retention.
- K-12. Different procurement, different scoring ethics, different sales
  cycle.
- Non-English. Backend explicitly out of scope (`APP_DESCRIPTION.md` §10).

---

## 5. Competitive frame

| Competitor type | Example | Where they win | Where Willab wins |
|---|---|---|---|
| Async video pitch tools | Yoodli, Poised | Real-time hints during live meetings | Structured homework loop, coach assignment, longitudinal score, published research |
| Workshop providers | Decker, Own The Room | Brand, in-person credibility | Practice between sessions, data after sessions |
| Generic AI tutors | ChatGPT custom GPTs | Free, infinitely flexible | Defined scoring, coach workflow, no hallucinated scores |
| Toastmasters / peer practice | Toastmasters Intl. | Free, social | Asynchronous, instrumented, repeatable |

The strategic answer to **"Why not just use ChatGPT?"** is one sentence:
*Willab gives you the same number every time you measure the same behavior;
a chatbot does not.* Reproducibility is the moat.

---

## 6. Messaging architecture

### 6.1 Top-line message (homepage / one-liner)
> **A speech lab for coaches and L&D teams. Practice you can measure.**

### 6.2 Message house — for coaches
- **Headline:** "Homework your students will actually do — and you can grade."
- **Proof points:**
  - Wheel feedback while they record (no "did I sound okay?" anxiety loops)
  - Score that travels session-to-session
  - Admin: assign warm-ups, review recordings, send next homework
- **CTA:** Start a free coach account → add your first student.

### 6.3 Message house — for L&D
- **Headline:** "Communication training with a longitudinal score."
- **Proof points:**
  - Cohort dashboards: `performance_score_end` across teams over time
  - Research-backed: EBCP and NECP papers linked on the Science page
  - Slots into existing programs; no curriculum lift
- **CTA:** Book a 30-min pilot scoping call.

### 6.4 Talking-point library (reuse on every surface)
- "Two recordings, one score, every week."
- "We measure two things in real time: vocal strength and pace."
- "Coaches keep coaching. We handle the instrumentation."
- "Every session ends with a number, a report, and a chart of the last five."

### 6.5 Objection handling

| Objection | Response |
|---|---|
| "How accurate is the score?" | We publish what `performance_score_end` measures and what it does not. It is a behavioral signal, not a verdict on the speaker. See Science. |
| "Is this just another AI coach?" | No. The coach is the human. Willab is the lab — it records, measures, and reports. |
| "Privacy of recordings?" | Audio in Supabase Storage with row-level security; access scoped per session; deletion on request. (Expand once formal policy is published.) |
| "What if students hate it?" | The wheel gives an in-session reason to come back. We will publish completion-rate data from coach cohorts as it stabilizes. |
| "We already have a vendor." | Run Willab alongside for one cohort. Compare engagement and score deltas at 60 days. |

---

## 7. Go-to-market plan

### 7.1 Coach motion (PLG with light sales)

**Acquisition channels (ranked):**
1. **Direct outreach to coaches with public rosters.** Hand-curated list
   of 200–500 US-based executive/communication coaches with websites.
   Personalized email referencing their actual practice. Goal: 20–40
   coach activations in Q1.
2. **Coach communities.** ICF (International Coaching Federation) chapters,
   National Speakers Association, LinkedIn coach groups. Educational
   content, not selling.
3. **Content SEO** focused on coach problems: "homework for communication
   coaching", "how to measure coaching progress", "speech coach intake
   template." Each post ends with a soft CTA to the coach account.
4. **Referral.** Coaches refer coaches; build the referral mechanic
   (one month free per converted coach) into the dashboard in Q2.

**Activation funnel:**
- Sign up → onboard a fake student → assign one homework → review one
  report. If a coach reaches "review one report" inside 7 days, they
  convert at ~3–5x baseline (assumption to validate).

**Pricing posture for coaches:** Per-active-student monthly seat,
discounted at 10/25/50 student tiers. Free for the coach account itself.
First student free for 30 days. Final numbers determined after we have
10 paying coaches.

### 7.2 Corporate L&D motion (enterprise pilot-led)

**Acquisition channels (ranked):**
1. **Founder-led outbound** to ~50 named accounts per quarter.
   Buyer persona: Director/VP L&D, Sales Enablement, Leadership
   Development at US firms with a public communication-training line item
   (you can identify these from job postings and earnings calls).
2. **Warm intros via coach customers.** Coaches working with enterprise
   clients become the warmest possible referrers. Build an explicit
   "introduce us to your enterprise client" workflow.
3. **Conferences (sparingly).** ATD (Association for Talent Development),
   Training Industry, Sales Enablement Collective. Side-event hosted
   roundtables beat booths.
4. **Owned research drops.** One short, defensible study per quarter —
   e.g., "How `performance_score_end` moves across a 6-week coaching
   engagement (n=…)." Published on the Science page, gated nowhere,
   shared in outbound emails.

**Sales process:**
- 30-min discovery → 45-min product walkthrough with their data fields →
  60-day paid pilot (small, real) → annual contract.
- We do not run free pilots. Free pilots do not get champions; paid
  pilots do.

**Pricing posture for L&D:** Annual platform fee + per-seat. Pilot fee is
~10–15% of expected ARR, credited toward annual on conversion. Public
list pricing only at the seat tier; everything above is quoted.

### 7.3 Channel partners (Q3+)
- Coaching networks that resell technology to their members.
- Sales-training firms wanting an asynchronous measurement layer.
- Avoid LMS resellers in year one — they will absorb us as a feature.

---

## 8. Content & thought leadership

The Science page is the single highest-leverage marketing asset we have,
because it changes the conversation from "trust the product" to "read the
research." Treat it that way.

### 8.1 Content pillars
1. **Measurement.** What is `performance_score_end`, what it isn't, why
   reproducibility matters.
2. **Method.** EBCP and NECP — what they say, what they imply for
   training design.
3. **Practice design.** Warm-up selection, task difficulty, anti-repetition
   — useful even to coaches who don't use Willab.
4. **Field notes.** Anonymized cohort data: completion rates, score
   trajectories, common failure modes.

### 8.2 Cadence (Q1)
- 1 long-form research-style post per month (Science page).
- 1 coach-facing how-to per two weeks (blog).
- 1 buyer-facing one-pager per persona (PDF) — used in outbound.
- Founder-authored LinkedIn presence: 2 posts/week, technical not
  motivational.

### 8.3 Reusable assets to build first (in order)
1. **One-pager: "Willab for Speech Coaches."**
2. **One-pager: "Willab for L&D."**
3. **60-second demo video** of the homework flow ending on the
   score chart. (We already have `public/videos/founder-message.mp4`;
   reuse the founder framing.)
4. **Pilot scoping doc** for L&D buyers (success metrics, cohort
   definition, data handling).
5. **Public Science page expansion** with a "what the score is and is
   not" plain-language explainer.

---

## 9. Pricing & packaging implications

Branding decisions constrain pricing decisions. Two implications:

- **Lab tone means we can charge.** Buyers do not expect a measurement
  platform to be $9/month. Don't underprice and undercut the brand.
- **No "freemium for individuals."** It dilutes the coach motion (the
  coach's student is a free user we don't own) and the L&D motion
  (procurement asks "why are we paying if it's free elsewhere"). Free
  for the **coach account**, paid per active student, is correct.

Formal pricing is out of scope for this document. It should be set
after 10 paying coaches and 2 paid pilots.

---

## 10. Metrics & KPIs

Track quarterly; review monthly.

### 10.1 Brand / top of funnel
- Branded search volume ("willab", "willpower lab") — month over month.
- Direct traffic to `/science` (signal that the research framing lands).
- Replies-per-100 to founder outbound (coach and L&D, tracked separately).

### 10.2 Coach motion
- Coach signups → "first homework assigned" conversion (target: 40%).
- Coach signups → "first report reviewed" within 7 days (target: 25%).
- Paid coach retention at 90 days (target: 70%).
- Active students per paying coach (leading indicator of expansion).

### 10.3 L&D motion
- Qualified discoveries booked per quarter (target Q1: 12).
- Discoveries → paid pilot conversion (target: 25%).
- Pilot → annual conversion (target: 50%).
- ARR per closed deal (track to inform pricing).

### 10.4 Product-led signals (already in the data model)
- Distribution of `performance_score_end` across active users — flat is
  bad, rising is the marketing story.
- Session completion rate (started → step 5).
- Recordings per active student per week.

---

## 11. 90-day execution plan

### Days 0–30 — Foundation
- Lock messaging architecture in §6; update homepage and `/science`
  copy to match.
- Build the two persona one-pagers (coach, L&D).
- Stand up coach outbound list (200 names, hand-curated).
- Wire the score-distribution and completion-rate metrics so we can
  cite them externally within 60 days.

### Days 31–60 — Coach motion live
- Launch coach outbound. Target: 20 coach signups, 5 paying.
- Publish first research-style post on `/science` (something
  concrete from EBCP/NECP applied to a Willab cohort).
- First 5 founder-LinkedIn posts.
- Begin building L&D account list (50 named).

### Days 61–90 — L&D motion warm-up + coach repeatability
- Outbound to 50 L&D accounts; target 12 discoveries, 3 pilot
  conversations.
- Coach motion: aim for 40 total signups, 10–15 paying.
- Internal review: what did the data say about `performance_score_end`
  movement across the first cohorts? Use it in the next research post.

---

## 12. Risks & how we mitigate

| Risk | Mitigation |
|---|---|
| Score is perceived as a black box. | Publish a plain-language "what the score is and is not" page; show the inputs (strength, pace, metric answers, post-question reflections). |
| Coach motion saturates at low ARPU. | L&D motion is the ARPU lever; coach motion is the credibility and referral engine. Do not over-invest in coach paid acquisition. |
| L&D buyers want SOC2 / data residency on day one. | Prioritize a security posture page within 6 months; have a plain-English data handling doc by month 3. |
| AI tooling commoditizes. | Brand on **measurement and research**, not on AI capability. The papers and the score are durable; the model behind the report is replaceable. |
| Voice over-promises ("score that moves") and student variance dominates noise. | Always publish ranges and N. Never single-number testimonials. The lab voice survives uncertainty; a hype voice does not. |

---

## 13. Open questions (for the team, not assumptions)

These are decisions this document **does not** make. Resolve before
launching paid acquisition.

1. ~~**Final product name in market.**~~ **Resolved.** Legal /
   long-form: **WillpowerLab** (CamelCase wordmark). Verbal nickname:
   *Willab*. See §3.5.
2. ~~**Domain.**~~ **Resolved.** `willpowerlab.com` primary,
   `willab.io` short-form, `willonski.com` legacy redirect.
3. **Pricing tiers and trial length** for the coach motion.
4. **Public commitments on data handling** (retention, deletion,
   training-data use). Required before L&D outreach scales.
5. **Whether to name the score** ("WillpowerLab Score", "Performance
   Index", or just "performance score"). Naming it creates a
   brandable noun; not naming it keeps the lab tone.

---

**Owner of this document:** marketing lead (currently founder).
**Cadence:** revisit at end of each 90-day plan; rewrite, don't patch,
when the strategy shifts.
