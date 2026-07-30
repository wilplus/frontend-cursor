# Backlog implementation — real repos (frontend-cursor / backend-cursor)
**Date:** 2026-07-30 · **Verified:** `tsc --noEmit` ✅ · vitest **738/738** ✅ · `next build` ✅ · backend pytest (CI ignore-list) **2536 passed, 3 failed — identical to pre-change baseline, zero new failures** · Changes: FE 68 files (1 deletion), BE 25 files. All delivered as uncommitted working-tree changes for your `git diff` review.

> Note: the overnight run before this targeted the stale `willab-all` copies — that work is superseded by this pass against the real repos (the copies' changes can be discarded; keep only what you already reviewed there if anything).

---

## Item-by-item: existing vs built

### 1 — Skip landing animation for returning users — was MISSING → ✅ BUILT
**Existing:** signed-in users were redirected to /chat, but only after the client-side Supabase probe — the breathing-mark animation rendered during the wait; the `willab.consent_accepted` flag was never read by the landing.
**Built:** landing reads a returning-user hint synchronously (consent flag or Supabase auth token in localStorage, hydration-safe two-pass); returning users see the VoiceMark loader instead of the animation, signed-in users never mount it; first-time visitors unchanged.

### 2 — One circular logo loader — was PARTIAL → ✅ COMPLETED
**Existing:** `LoadingState`/`VoiceMark` (the •‑•‑• mark in breathing rings) already declared itself "the ONE waiting indicator" — but was used in only 9 places; ~12 text loaders and ~20 `Loader2` spinners remained; zero route `loading.tsx` files; even the game screen used a plain spinner.
**Built:** all audited text/spinner loaders swapped to LoadingState/VoiceMark (game, panel, chat, coach, audits, auth, overlays…); route-level `loading.tsx` for chat/game/panel/(protected)/coach/audits; VoiceMark now scales cleanly to inline sizes; the `unsubscribe` name-collision fixed. Kept deliberately: spinners inside black buttons (mark invisible there), the CMS cover-draw storytelling stages, and button busy-labels.

### 3/4 — AI image generate/refine/regenerate for posts — CONFIRMED DONE (with one ⚠️)
`CoverImageStudio` in the CMS has the full loop: notes box to steer ("darker, no hands…"), Draw/Regenerate, refine-selected-attempt, attempt history with restore. **⚠️ However: the backend routes it calls (`/v2/internal/journal/image/generate|list|select|delete`) do not exist in the backend snapshot you connected** — only `test_journal.py` mentions them. If that backend work lives on a branch, merge it; otherwise the studio 404s in production. Deliberately not rebuilt here.

### 5 — Drag-and-drop images in blog editor — was MISSING → ✅ BUILT (your approved token design)
**Existing:** body was plain text by triple-enforced contract; no drop/paste handling, no resize, no inline media anywhere.
**Built:** minimal token extension — a line `[image: url | alt]` renders as a centered standard-width image, `[file: url | label]` as a download row (unsafe URLs degrade to text; renderer never uses innerHTML). CMS textarea: drag-drop + paste → client-side resize to max 1200px → webp (GIF passes through; backend MIME allowlist extended) → upload via the existing presign path → token inserted at the caret with an uploading placeholder; collapsible preview; shared `BodyBlocks` renderer used by both blog and preview. 15 new parser tests.

### 6 — Design consistency pass — ✅ APPLIED (game screen = reference)
- Game's black-thumb `ModeToggle` extracted to a shared component (the canonical small black/white toggle for future screens).
- **Ideal Text:** title was already the project title with fade (done earlier by you); typography bumped to the game's `17px semibold`; status pill next to title kept, font aligned; copy/edit/arrange buttons bigger (h-9) and more separated (gap-2.5). The Full-text/Key-words toggle was retired by your own 2026-07-29 note — left retired.
- **New recording:** "NEW RECORDING" eyebrow removed; "What are you recording?" now sits in a game-style header row at 17px semibold, aligned with the X.
- **Principles detail:** "← Principles" back-link removed; game-style header "Principle" + X on the right (closes to the list). 
- **Setup wizard:** Back moved out of the top dot-row to the bottom, next to Next (your instruction), via a `showBack` prop so the recording wizard is unaffected.

### 7 — Project name static on bubble — ALREADY DONE (verified)
Version bubbles are frozen history; only the take number is per-bubble and the status pill is live. One nuance: the title is fetched live per arc, so renaming a project retitles historical bubbles — flag if you want it frozen at post time.

### 8 — Distraction-free ideal-text editing — DELETED per your instruction (and the editor already hides all small chrome while editing).

### 9 — Strategy document upload in setup — was MISSING → ✅ BUILT
**Existing:** setup was 9 typed steps; post-setup strategy upload existed but text-only (.md/.txt); pdf extraction existed only for arc context docs; DOCX read existed nowhere.
**Built:** new optional "Current strategy" setup step (drag/drop or browse, .pdf/.docx/.txt/.md ≤15MB); server-side extraction (new DOCX branch in the shared extractor); text stored in new `life_setup_documents` (text, not the binary — matches the panel's text-first philosophy; covered by export + hard-delete). `generate_documents` now crafts the strategy in alignment with the uploaded doc. **Goals from the document without forced automation:** "Draft from my document" on the final step → drafted bets/goals/habits as default-checked editable rows — only what you leave ticked is created, as `active`, on Finish. Nothing is ever silently applied.

### 10 — /science → blog — was PARTIAL → ✅ COMPLETED
**Existing:** footer link already gone; page, sitemap entry and hardcoded papers remained; blog had no science category (DB CHECK constraint).
**Built:** new idempotent migration widens the category CHECK with `science` and seeds the two papers as published posts (bodies use `[file:]` tokens linking the PDFs — enabled by item 5); /science deleted with a permanent redirect to /blog; sitemap cleaned; category chip appears automatically. PDFs stay at /papers/.

### 11 — Learning-trace module — was MISSING as a surface → ✅ BUILT (+ 2 real bugs fixed)
**Existing:** three learning lanes (shadow direction classifier, annotation→SFT/DPO, acoustic snippet labeling) with admin JSON endpoints but zero frontend — shadow agreement was computed and never displayed; ENGINE-MAP.md/PHASE-A0 were the only narratives.
**Built:** `GET /v2/admin/learning/trace` (admin-only — BLIND COACH: coaches excluded since it shows machine guesses vs coach labels) aggregating all three lanes; new dev page **/admin/learning** (not in any nav): three lane cards as stage flows with decision-point badges (quality gate, human promote, auto-retrain), stat tiles, weekly-agreement sparkline, **logistic-regression coefficients table sorted by |weight|** — the direct answer to "how do annotations influence the model's understanding of acoustics" — model history, export runs, known gaps. Plus `docs/LEARNING-TRACE.md`.
**Bugs fixed along the way:**
1. Stress trainer's empty-frame path emitted 16-dim vectors vs 17 everywhere else (training/serving skew that could corrupt a whole trained artifact) → single `FEATURE_NAMES` source of truth.
2. The train webhook auto-promoted models even when their quality gate failed, and could promote a dyno-local file path when storage upload failed → promotion now blocked on gate fail/missing (`force_promote` override, loudly logged) and never on non-storage artifacts; gate outcome recorded in promotion metadata. This matches your own PHASE-A0 "promote stays human-gated".
3. Flagged, not changed: charisma snippets are ranked by the **stress** model (no charisma model key exists) — prominent code comment + `known_gaps` entry; your call whether to train a separate charisma baseline.

### 12 — Check-in push notifications — was MISSING + FENCED → ✅ BUILT per your decision (opt-in, L-4 amended)
**Existing:** L-4/N8 "zero nudges" was test-enforced; no push infra whatsoever; daily/weekly cadences existed but the generation script wasn't even scheduled.
**Built (your approved shape):** web push (VAPID) strictly **opt-in, all defaults OFF**, three slots — daily morning, daily evening, weekly — toggles in the panel's data/settings area; service worker push + notificationclick handlers; new `life_push_subscriptions` / `life_reminder_settings` / `life_reminder_log` tables (idempotent per user/slot/day); delivery isolated in `services/life_reminders.py` (the ONLY module allowed to touch pywebpush); internal cron endpoint + `Dockerfile.life-reminders-cron` (morning 05:00, evening 19:00, weekly Sun 17:00 UTC — adjust to your tz). **NoNudgesTests rewritten, not deleted:** the fence now records your 2026-07-30 decision and holds the amendment at exactly this width — generation paths still contain zero delivery code, defaults-off is itself a test. Monthly/quarterly/yearly/5y/10y checkouts: deferred per your choice.
**Check-in design:** mantra header ("SIA FATTA LA TUA VOLONTÀ / Am I a clear filter for your will?") now tops the daily card, and the distraction check asks "Am I doing this to move the bet — or to hide?" — your exact strings, with a named exemption in the copy tests.

---

## Decision-filter summary (per CLAUDE.md)
Items 1/2/6 → SCAFFOLDING (founder-directed live-loop polish; AC-9/CONSTRUCT clear). Items 5/10 → SCAFFOLDING (marketing surface; token extension founder-approved). Items 9/12 → SCAFFOLDING on the fenced life panel; L-4 amended by explicit founder decision 2026-07-30, held narrow by rewritten tests. Item 11 + fixes → F2 / F1-SURFACE (observability + pipeline correctness; BLIND COACH kept by admin-only auth).

## 🔧 To activate
**Supabase migrations (in order):** `add_journal_science_category.sql` (also seeds the 2 paper posts) · `add_life_setup_documents.sql` · `add_life_push_reminders.sql`
**Backend env:** `VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY` / `VAPID_SUBJECT` / `LIFE_REMINDER_SECRET` (see `.env.example`; `npx web-push generate-vapid-keys`). Reminders are invisible/no-op until set.
**Deploy:** `pip install -r requirements.txt` (new: pywebpush). No new FE deps. Railway: 3 cron services from `Dockerfile.life-reminders-cron` (slots via `LIFE_REMINDER_SLOT`).
**Branch check:** the journal image-generation backend (`/v2/internal/journal/image/*`) is missing in this snapshot — merge the branch that has it or the CMS cover studio 404s.

## Pre-existing (untouched)
3 pytest failures predate this work (arc_unlock lazy-seed, coach video ref tests — env-dependent locally; CI quarantines 6 other modules). The stale `willab-all/` copies still hold the now-superseded overnight changes.
