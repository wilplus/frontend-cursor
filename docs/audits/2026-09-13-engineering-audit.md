# Engineering audit — frontend (`frontend-cursor`) — 2026-09-13

*Read-only audit, executed from the prompt kept in the backend repo at
`backend-cursor/docs/audits/2026-09-13-engineering-audit-prompt.md`. Raw tool
outputs are under [`raw/`](raw/). The founder's decision questions for BOTH
repos are in `backend-cursor/docs/audits/2026-09-13-audit-questions.md`.*

Commit audited: `0f88bd4` (2026-09-10). Node 22, `npm ci` from the lockfile.

---

## Executive summary

1. **The unit suite is healthy and cheap:** 142 files, 1,535 cases, all pass
   in 11.5 s. Nothing is skipped or `.only`'d.
2. **The suite tests mappers, not surfaces.** 455 of 565 source files
   (64,838 lines) are imported by no test: all 155 BFF `route.ts` files, all
   54 pages, and 152 of 176 components, including every F1 surface
   (`Lounge.tsx` 2,054 lines, `LabOverlay.tsx` 1,834, `DeckChunkModal.tsx`
   1,308, `IdealTextReadout.tsx` 1,283, `IdealTextOverlay.tsx` 1,255). What is
   tested is `src/services/api/*` and `src/lib/*` (the pure mapping layer) and
   a set of "grep the source" fence tests.
3. **One F1 e2e spec never runs.** `e2e/deck.spec.mjs` (transcript review
   deck, founder spec 2026-08-11) is in neither the CI job nor the README
   table. `record-flow.spec.mjs`, the only end-to-end check of the core
   record flow, runs by hand only.
4. **Complexity concentrates in five components and one file.**
   `DeckChunkModal` CC 121 (18 props, 79 state setters), `ReportCard` 68,
   `IdealTextOverlay` 52, `CoachReviewOverlay` 43, `Lounge` 38; and
   `src/services/api/idealText.ts` is 2,307 lines with 17 functions above
   CC 10. ESLint runs with no complexity rule, so nothing flags any of this.
5. **The BFF layer has three idioms and 8,164 lines of glue.** 154 routes:
   59 use `callBackend`, 8 use `proxyJson`, 81 fetch the backend directly
   (the ratchet baseline has 82 grandfathered entries). `proxyJson` itself
   is CC 47.
6. **Two ideal-text surfaces share copied code.** `IdealTextOverlay.tsx`
   and `IdealTextReadout.tsx` have three clone blocks between them;
   overall 5.4% of `.ts` lines are duplicated (88 clones).
7. **Retired constructs are still shipped.** Speaker-sex prompts in 15
   files (four prompt components), Best Presentation in 21 files including a
   476-line overlay, and a ~1,200-line "homework" client cluster whose only
   importer is `Lounge.tsx`.
8. **Repo hygiene:** an 83 MB `.mov` is tracked at the root, 13 handoff
   `.md` files sit beside `package.json`, `task-master-ai` and every `@types/*`
   package are in production `dependencies`.

---

## Method and limitations

| What | How | Where |
|---|---|---|
| Test inventory and imports | regex scan of 141 `*.test.ts(x)` + 8 e2e specs | `raw/module_to_tests.json`, `raw/test_classification.md` |
| Test run | local `vitest run` (JSON reporter) | `raw/vitest_summary.txt` |
| Ages | `git log` per file after `--unshallow` (1,478 commits) | `raw/test_file_ages.txt` |
| Complexity | ESLint `complexity` (>10), `max-lines-per-function` (>120), `max-depth`, `max-params` | `raw/eslint_complexity.txt` |
| Unused exports | `ts-prune`, then Next.js convention files removed | `raw/ts_prune_unused_exports.txt` |
| Duplication | `jscpd --min-lines 15 --min-tokens 100` on `src/` | `raw/jscpd.txt` |

Limitations. (1) The e2e and csp tiers were not run here (they need a dev
server and Chromium session; CI runs them). (2) "Tested" means "imported by a
test file"; a component rendered indirectly through a parent counts as
untested, which is accurate for this suite because almost nothing renders
components. (3) ESLint's `complexity` counts JSX branches, so React
components read high; the relative order is still right. (4) `ts-prune`
flags Next.js `default` exports of pages and routes; those were removed
before counting. (5) "Stale" means the subject's latest commit is in a later
month than the test's; all such tests currently pass.

---

## A. Test necessity

### A.1 Inventory

| | |
|---|---|
| Unit test files | 141 in `src/` (21,272 lines) + `cloudflare/upload-proxy/src/token.test.mjs` = 142 run by vitest |
| Cases | 1,535 (regex count 1,515; `it.each` accounts for the gap) |
| Run | 142 files pass, 1,535 pass, 0 fail, 0 skip, 11.5 s |
| e2e specs | 8 standalone Playwright scripts (`e2e/`) |
| CI | `unit` (vitest, `next lint`, `tsc --noEmit`, BFF ratchet), `e2e` (5 specs), `csp` (1 spec, production build) |
| Tiers | 55 F1-path, 56 scaffolding, 18 F2, 17 fence, 3 retired? (+8 e2e) |

### A.2 The gate

- **`e2e/deck.spec.mjs` is orphaned.** Not in `.github/workflows/tests.yml`,
  not in the README's seven-spec table, no `npm` script. It pins the
  transcript-review deck "wire, not the paint" and has run only when someone
  typed the command.
- **`e2e/record-flow.spec.mjs`** ("the record flow — the core of the app,
  end to end") needs a live backend and is excluded from CI by design. It is
  the only test of the LIVE LOOP from the user's side.

### A.3 What the tests protect

- **Mapper layer, well covered.** `src/services/api/idealText.ts` has 12
  test files; `readout.ts` 5; `stateRatings.ts` 5; `life.ts` 4. These are
  the F1 read/assembly contracts and they are the best-tested code in the
  repo.
- **10 test files import nothing from `src/`.** They read source files as
  text and assert on their contents: `noStarsOnUserSurfaces` (AC-9),
  `noTopBarEditing`, `lockAfterEdit`, `corpusFence`, `blinding`,
  `tierKeyFence`, `serviceWorkerPolicy`, `deckSurface` (21 cases),
  `recordingScreen` (15 cases), `processingJourney`. They are the fence
  tests. They are also the tests most likely to break on a rename with no
  behaviour change, and the ones that cannot tell a JSX branch from a
  comment.
- **Components are not rendered.** Only one `*.test.tsx` exists
  (`CoachInlineBlindExposureBoundary.test.tsx`, 2 cases). jsdom is installed
  but no component test uses it.
- **`getAuthToken` from `auth-client.ts` is mocked in 21 test files.** One
  function, 43 production importers, 21 `vi.mock` blocks: the auth seam is a
  global that every API test has to stub.

### A.4 Tests on retired constructs

| Test | Subject | Status |
|---|---|---|
| `src/services/api/userProfile.sex.test.ts` | `profile_sex` four-state field, `shouldAskSex` | Speaker-sex processing was retired 2026-08-29 (backend fence: 0 hits). The FE still ships `SpeakerSexPrompt`, `LoungeSpeakerSexPrompt`, `DashboardSpeakerSexPrompt`, `SpeakerSexQuestion`, `speakerSexAskGate`, and the field in `SignupForm`, `TokenPlanChips`, `planControls`, `trainingCorpus`. |
| `src/components/willab/speakerSexAskGate.test.ts` | the Lounge mount gate for that ask | same |
| `src/services/api/bestPresentation.test.ts` | `bestPresentation.ts` client | L1 retires Best Presentation; `BestPresentationOverlay.tsx` (476 lines, untested) and the BFF route are still live |

These are DECIDE, not DELETE: the tests are correct for the code that exists.
The question is whether the code should.

### A.5 Stale tests

26 test files are older than their subject's latest commit. The oldest gaps:

| Test | Test last touched | Subject last touched |
|---|---|---|
| `src/lib/funnel/loungeLocalThread.test.ts` | 2026-06-03 | 2026-08-26 |
| `src/components/willab/presentation.test.ts` | 2026-06-19 | 2026-08-25 |
| `src/components/willab/readout.back.test.ts` | 2026-06-20 | 2026-08-24 |
| `src/components/willab/readout.instantChunk.test.ts` | 2026-07-16 | 2026-08-24 |
| `src/components/willab/readout.sayItStronger.test.ts` | 2026-07-16 | 2026-08-24 |
| `src/components/willab/useWillabFlow.test.ts` | 2026-07-25 | 2026-08-18 |
| `src/services/api/arcFeedback.tokens.test.ts` | 2026-07-31 | 2026-08-22 |
| `src/services/api/idealText.pieces.test.ts` | 2026-08-03 | 2026-09-09 |

All pass. Full list: filter `raw/test_classification.md` for "subject moved".

### A.6 Fragmentation

- `idealText.ts` has 12 test files; `readout.ts` 5; `stateRatings.ts` 5.
  Not wrong, but "the test for fetchIdealText" is not findable by name.
- 13 files have ≤2 cases (`guestOwnerProcessing`, `clickNavigation`,
  `chatQuery`, `suggestionFeedback`, `tierKeyFence`, `ProcessingWait`, …).
  Merge candidates.

### A.7 What has no tests

| Lines | File | Tier |
|---|---|---|
| 2,054 | `src/components/willab/Lounge.tsx` | F1 surface (the record entry point) |
| 1,834 | `src/components/willab/LabOverlay.tsx` | F1 surface (record → Take) |
| 1,308 | `src/components/willab/DeckChunkModal.tsx` | F1 surface (per-slide transcript) |
| 1,291 | `src/components/willab/CoachStarVerdictOverlay.tsx` | F2 |
| 1,283 | `src/components/willab/IdealTextReadout.tsx` | F1 surface |
| 1,255 | `src/components/willab/IdealTextOverlay.tsx` | F1 surface |
| 1,244 | `src/app/coach/corpus/page.client.tsx` | F2 |
| 1,043 | `src/components/willab/LibraryOverlay.tsx` | scaffolding |
| 953 | `src/components/willab/TranscriptReviewDeck.tsx` | F1 surface (only `deck.spec.mjs`, which never runs) |
| 699 | `src/components/willab/ReportCard.tsx` | F1 surface (Feedback) |
| 590 | `src/components/willab/RecordingSetup.tsx` | F1 surface |
| 487 | `src/hooks/useDualCaptureMic.ts` | F1 (the microphone) |
| 476 | `src/components/willab/BestPresentationOverlay.tsx` | retired? |
| 574 / 474 | `src/lib/api/homework-client.ts`, `types-homework.ts` | legacy |

All 155 `route.ts` files and all 54 `page.tsx` files are untested; the
`csp` e2e spec is the only thing that loads a real route.

### A.8 Verdict table

Per-file table (149 rows) in [`raw/test_classification.md`](raw/test_classification.md).

| Verdict | Files |
|---|---|
| KEEP | 71 |
| KEEP (off-path) | 56 |
| KEEP (fence) | 17 |
| DECIDE | 4 (`userProfile.sex`, `speakerSexAskGate`, `bestPresentation`, `e2e/record-flow`) |
| FIX: add to CI or delete | 1 (`e2e/deck.spec.mjs`) |

No FE test is a delete candidate on its own merits; the deletions follow from
decisions about the code they cover.

---

## B. Cyclomatic complexity

### B.1 Distribution (ESLint `complexity`, tests excluded)

| CC | Functions |
|---|---|
| 11–20 | 162 |
| 21–30 | 37 |
| 31–50 | 16 |
| 51+ | 3 |

218 functions above 10; 86 functions longer than 120 lines; 7 nested deeper
than 4; 6 with more than 5 parameters. `.eslintrc.json` is
`next/core-web-vitals` only, so none of these is reported today.

### B.2 The worst 25

| CC | Function | Tier |
|---|---|---|
| 121 | `src/components/willab/DeckChunkModal.tsx:129 DeckChunkModal` | **F1 (per-slide transcript)** |
| 68 | `src/components/willab/ReportCard.tsx:83 ReportCard` | **F1 (Feedback)** |
| 52 | `src/components/willab/IdealTextOverlay.tsx:99 IdealTextOverlay` | **F1 (Ideal Text)** |
| 47 | `src/lib/api/bff.ts:72 proxyJson` | BFF glue |
| 43 | `src/components/willab/CoachReviewOverlay.tsx:65 CoachReviewOverlay` | F2 |
| 42 | `src/lib/api/types-homework.ts:76 deriveHomeworkStep` | legacy |
| 39 | `src/services/api/idealText.ts:1374 fetchIdealText` | **F1 (Ideal Text read)** |
| 39 | `src/lib/api/types-homework.ts:316 getStatusToHomeworkResponse` | legacy |
| 38 | `src/lib/api/bff.ts:277 proxyMultipart` | BFF glue |
| 38 | `src/components/willab/Lounge.tsx:135 Lounge` | **F1 (entry)** |
| 38 | `src/components/willab/CoachStarVerdictOverlay.tsx:156` | F2 |
| 36 | `src/components/willab/CoachGuidanceComposer.tsx:20` | F2 |
| 33 | `src/components/auth/UpdatePasswordForm.tsx:72` | scaffolding |
| 32 | `src/components/willab/LabOverlay.tsx:532` (arrow fn) | **F1 (record → Take)** |
| 32 | `src/components/willab/IdealTextReadout.tsx:100 IdealTextReadout` | **F1** |
| 32 | `src/app/cms/page.tsx:262 JournalAdminPage` | scaffolding |
| 31 | `src/middleware.ts:161 middleware` | infra (CSP + auth) |
| 31 | `src/components/willab/TranscriptReviewDeck.tsx:69` | **F1** |
| 31 | `src/components/willab/CoachConfidencePracticeReview.tsx:18` | F2 |
| 30 | `src/components/willab/Lounge.tsx:1785 Bubble` | F1 surface |
| 30 | `src/components/life/PanelUpload.tsx:53` | scaffolding |
| 30 | `src/app/coach/corpus/page.client.tsx:746` | F2 |
| 29 | `src/components/willab/readout.ts:495 mapFeedbackItem` | **F1 (Feedback mapping)** |
| 28 | `src/services/api/idealText.ts:1247 mapKeyMoment` | F1 |
| 28 | `src/lib/willab/deckChunks.ts:305 groupChunksBySlide` | **F1 (slide bucketing on the FE side)** |

Files with the most functions above 10: `services/api/idealText.ts` 17,
`app/coach/corpus/page.client.tsx` 6, `lib/api/homework-client.ts` 6,
`components/willab/IdealTextReadout.tsx` 5, `services/api/trainingCorpus.ts` 5.

### B.3 Why the F1 components are complex

| Component | File lines | props | `useState` | `useEffect` | `useCallback` | state setter calls | ternaries |
|---|---|---|---|---|---|---|---|
| `DeckChunkModal` | 1,308 | 18 | 8 | 2 | 0 | 79 | 63 |
| `ReportCard` | 699 | 7 | 1 | 2 | 0 | 3 | 42 |
| `IdealTextOverlay` | 1,255 | 5 | 8 | 4 | 12 | 89 | 26 |
| `IdealTextReadout` | 1,283 | 10 | 8 | 5 | 17 | 59 | 27 |
| `Lounge` | 2,054 | 9 | 8 | 14 | 4 | 75 | 48 |
| `LabOverlay` | 1,834 | 5 | 7 | 13 | 0 | 116 | 45 |
| `TranscriptReviewDeck` | 953 | 24 | 5 | 5 | 3 | 23 | 47 |
| `CoachStarVerdictOverlay` | 1,291 | 4 | 4 | 6 | 3 | 58 | 38 |

Three readings:

- **`DeckChunkModal` and `TranscriptReviewDeck` are configured, not composed:**
  18 and 24 props. The parent decides everything; the child branches on it
  (63 and 47 ternaries). That is a props-as-flags design, and CC 121 is what
  it costs.
- **`LabOverlay` and `Lounge` are state machines written as effects:** 13 and
  14 `useEffect`, 116 and 75 setter calls. `useWillabFlow.ts` already holds a
  `WillabState` union (the `speakerSexAskGate` test enumerates it by hand),
  so the machine exists; the components re-derive it.
- **`ReportCard` is pure branching** (1 state, 42 ternaries): a render tree
  over the three-lane Feedback payload. This is closest to inherent, and the
  place where an AC-9 slip would be a JSX branch nobody tests.

`src/services/api/idealText.ts` (2,307 lines, 90 ternaries, 29 awaits) is
the FE mirror of the backend's `explore_ideal_text.py`: one file that maps
every Ideal Text payload shape, with 12 test files pinning it.

---

## C. Tightness of abstractions and glue code

### C.1 The BFF: three idioms, one purpose

| Idiom | Helper | Route files |
|---|---|---|
| `proxyJson` / `proxyMultipart` | `src/lib/api/bff.ts` (431 lines; CC 47 and 38; one internal clone) | 8 |
| `callBackend` / `backendFetch` | `src/app/api/_lib/backend.ts` | 59 |
| direct `fetch(` of the backend URL | none (grandfathered) | 81 (ratchet baseline: 82 entries) |

154 `route.ts` files, 8,164 lines. 19 are ≤15 lines and forward one path
verbatim; four are catch-all proxies (`/v2/life/[...path]`,
`/v2/user/mlc3/[...path]`, `/v2/coach/mlc3/[...path]`,
`/v2/admin/ceo/work-items/[...path]`) that forward whatever the client sends.
The ratchet script (`scripts/check-bff-single-idiom.mjs`) stops growth but
the baseline has not shrunk: 81 of 154 routes are still on the idiom the
rule bans.

### C.2 Two client layers

`src/services/api/` (61 files, 14,273 lines) is what components import
(92 importers). `src/lib/api/` (10 files, 1,835 lines) is imported by 3
components and by 42 of the `services/api` files. The split is real
(services = product mappers, lib = transport), except that `lib/api` also
holds the legacy homework cluster and `bff.ts`, which is server-side BFF
code living next to client-side helpers.

`src/lib/api/auth-client.ts` exports one function, `getAuthToken`, imported
by 43 files and mocked in 21 tests. It is the FE's global.

### C.3 Copied surfaces

jscpd: 88 clones, 2,108 duplicated `.ts` lines (5.4%), 100 `.tsx` lines.
The pairs that matter:

- `IdealTextOverlay.tsx` ↔ `IdealTextReadout.tsx`: three clone blocks
  (lines 854–869/619–634, 876–898/766–788, 1012–1027/1110–1125). Two
  1,250-line components rendering the same document with copied handlers.
- `bff.ts` 176–191 ↔ 346–360: `proxyJson` and `proxyMultipart` share their
  error path by copy.
- `types-homework.ts` 161–187 ↔ 254–282: legacy.

### C.4 Retired and legacy code still shipped

| Cluster | Files | Lines (approx.) | Importers |
|---|---|---|---|
| Speaker sex | `SpeakerSexPrompt`, `LoungeSpeakerSexPrompt`, `DashboardSpeakerSexPrompt`, `SpeakerSexQuestion`, `speakerSexAskGate`, plus the field in `SignupForm`, `TokenPlanChips`, `planControls`, `restoredSetup`, `trainingCorpus`, `Lounge` | ~600 | `Lounge.tsx`, dashboard, signup |
| Best Presentation | `BestPresentationOverlay.tsx` (476), `services/api/bestPresentation.ts`, BFF route, strings in 21 files | ~700 | `Lounge`, `WillabSurface`, `LibraryOverlay`, `CoachIdealTextPanel`, `CoachSnippetReviewCard`, `loungeReports`, `chat/page` |
| Homework | `homework-client.ts` (574), `types-homework.ts` (474), `homework-mock.ts`, `homework-task-fields.ts` | ~1,200 | only `Lounge.tsx`; 14 of the 40 real unused exports are here |
| charisma / stress strings | 7 / 13 files (copy in `WelcomeConsent`, `waitingTips`, `privacy/page`; CSP and coaching routes) | — | copy fence: user-facing text mentioning the retired construct |

The backend's CI ignore list still names `test_homework_regressions.py`; the
homework flow is retired on both sides and deleted on neither.

### C.5 Dead exports

`ts-prune` after removing Next.js convention files: **40 unused exports** in
30 files. 14 are the homework cluster; the rest are one-offs
(`raw/ts_prune_unused_exports.txt`).

### C.6 Dev harness pages in the production tree

`src/app/dev/{corpus,deck,life-bets,marked-editor,recording,star-verdicts}`
are the e2e harnesses. They are real Next.js routes in the production
build, each returning `null` when `NODE_ENV === "production"`. They ship,
they are reachable, and they render nothing.

### C.7 Repository hygiene

- `IMG_1681.mov`, **83 MB**, tracked since 2026-05-02 ("Hide sniper UI for
  guest recordings"). Every clone pays for it.
- 13 handoff/summary `.md` files at the repo root; 142 more under `docs/`.
- `cache/config.json` (task-master telemetry state) is tracked.
- `dependencies` contains `task-master-ai` (a CLI), `typescript`,
  `@types/node`, `@types/react`, `autoprefixer`, `postcss`, `tailwindcss`.
  These are build/dev tools; production installs pull them all.
- `.eslintrc.json` has no project rules at all.

### C.8 Ranked buckets

**Delete (dead glue)**
1. Homework cluster (~1,200 lines, one importer) once `Lounge.tsx` drops it.
2. Speaker-sex prompts and field plumbing (retired construct; 15 files).
3. `IMG_1681.mov`, `cache/`, root handoff files; dev-tool packages out of `dependencies`.
4. 26 one-off unused exports.

**Collapse**
1. Three BFF idioms → one (`callBackend`); then `bff.ts` (CC 47/38) goes away or shrinks to the multipart case.
2. `IdealTextOverlay` + `IdealTextReadout` → one document renderer with two modes.
3. Best Presentation overlay + client + route → whatever L1 says it is now (question).

**Tighten**
1. `DeckChunkModal` (18 props) and `TranscriptReviewDeck` (24 props): replace prop flags with a chunk-state model; add a rendered test (jsdom is already installed).
2. `LabOverlay` / `Lounge`: move the effect-driven state machine into `useWillabFlow`.
3. `deck.spec.mjs` into CI; a fixture-backed way to run `record-flow.spec.mjs`.
4. A `complexity` rule in ESLint at a ratchet threshold so the number cannot grow silently.

---

*Filter stamp:* `FILTER: JUSTIFIED-SCAFFOLDING — cat {SCAFFOLDING (read-only audit)} — fences {clear} — locks {clear} — redirect: findings ranked by F1 proximity; every cleanup is filtered separately via the question set.`
