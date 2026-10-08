# e2e specs — real-browser checks for what jsdom can't answer

Ten standalone Playwright scripts (not a test-runner suite): each boots
Chromium, drives a page, prints PASS/FAIL lines, and exits non-zero on any
failure.

| spec | harness page | default target |
| --- | --- | --- |
| `bets-reorder.spec.mjs` | `/dev/life-bets` | `BETS_URL` → `:3111` |
| `coach-panel.spec.mjs` | `/dev/coach-panel` | `PANEL_URL` → `:3111`; flow screenshots to `SHOTS_DIR` (default `e2e/artifacts/coach-panel`, gitignored) |
| `corpus.spec.mjs` | `/dev/corpus` | `CORPUS_URL` → `:3111` |
| `csp-violations.spec.mjs` | public routes (REAL surfaces) | `BASE_URL` → `:3140` |
| `deck.spec.mjs` | `/dev/deck` | `DECK_URL` → `:3111` — **stale, not in CI** (see below) |
| `feedback-walk.spec.mjs` | `/dev/feedback-walk` | `WALK_P1_URL` → `:3111`; flow video to `SHOTS_DIR` (default `e2e/artifacts/feedback-walk`, gitignored) |
| `ideal-text-canonical.spec.mjs` | `/dev/deck` | `DECK_URL` → `:3111` |
| `marked-editor.spec.mjs` | `/dev/marked-editor` | `MARKED_URL` → `:3123` |
| `record-flow.spec.mjs` | `/chat` (REAL surface) | `BASE_URL` → `:3142` |
| `recording-screens.spec.mjs` | `/dev/recording` | `RECORDING_URL` → `:3111`; the recording lock at 390x844 with touch and at 1180x860 (build plan D-RC-8) |
| `guest-first-visit.spec.mjs` | `/chat` as a brand-new guest (REAL surface) | `BASE_URL` → `:3142` |

The five `/dev/*` harness pages stub their own network, so no backend is
needed for them. **record-flow drives the real record flow at `/chat`** on a
PRODUCTION build; every read it makes is answered at the browser
(`ctx.route`) or by `e2e/_fixture-backend.mjs` behind the BFF, so it needs no
real backend either. Since Phase 2 (2026-09-14) it runs in the CI `csp` job on
the same production server, right after the CSP spec. The auth seed is keyed
on the build's Supabase project ref (`dummy` in CI; `SUPABASE_REF=<ref>`
for a local build).

**deck.spec.mjs is stale.** It pins the 2026-08-11 deck DOM (`data-status`
chunk states, a success tick, a two-grain rail); the surface moved on
2026-08-13/15 and five of its first nine checks fail on structure, not copy.
It is deliberately not in CI (audit Q-T6): the deck surface is pinned by the
rendered unit test `src/components/willab/TranscriptReviewDeck.f1.test.tsx`
until this spec is rewritten against the current harness or deleted.

The `/dev/*` harness pages ship in the production route tree and each
returns `null` under `NODE_ENV=production` (audit Q-A12: acceptable).

**csp-violations is the other exception, in the opposite direction.** It
needs no backend, but it must run against a PRODUCTION build (`next build`
+ `next start`) rather than `next dev` — `script-src` carries
`'unsafe-eval'` only in dev, and dev injects styles for HMR that production
never ships, so dev would miss the real policy and flag violations users
never meet. It has its own BLOCKING `csp` job in CI, separate from the
non-blocking `e2e` job, because the failure it guards against (#242) took
every route down while the build, the unit tier, and a hand audit of the
rendered HTML were all green.

## Run them

```sh
npm ci                            # playwright is a devDependency
npx playwright install chromium   # once per machine

# The env shape is part of the harness contract: the coach-walk fixture
# seeds an sb-dummy-* auth cookie, so the Supabase URL's project ref MUST
# be "dummy". These are placeholders — nothing ever connects to them.
NEXT_PUBLIC_SUPABASE_URL=https://dummy.supabase.co \
NEXT_PUBLIC_SUPABASE_ANON_KEY=dummy-anon-key \
npx next dev -p 3111              # in one terminal

node e2e/bets-reorder.spec.mjs    # in another
node e2e/corpus.spec.mjs
node e2e/ideal-text-canonical.spec.mjs
MARKED_URL=http://localhost:3111/dev/marked-editor node e2e/marked-editor.spec.mjs
```

Point a spec at a different port with its URL env var
(e.g. `WALK_URL=http://localhost:3000/dev/coach-walk`). Load the page
once in a browser (or curl it) before the first spec run — `next dev`
compiles on demand, and a spec navigating mid-compile races its own
selectors.

## The screenshot harness — `e2e/screenshots/` (build plan X7)

One script draws every founder-locked screen, for every area, instead of a
screenshot loop per spec:

```sh
npm run screenshots                       # boots the fixture backend + next dev, draws, stops them
npm run screenshots -- --area walk,consent
BASE_URL=http://localhost:3111 node e2e/screenshots/capture.mjs   # against a server you run
WILLAB_SCREENSHOTS=1 scripts/local_ci.sh  # the same, inside the local gate
```

- `manifest.mjs` — the screens, by area (`ideal-text`, `walk`, `coach-panel`,
  `recording`, `consent`). Its header says exactly what an entry holds. An
  area adds a screen by adding one entry; nothing else changes.
- `capture.mjs` — draws each entry at 390x844 (`phone`) and 1280x800
  (`desktop`) into `OUT_DIR` (default `e2e/artifacts/screenshots`, gitignored)
  as `<area>/<name>.<viewport>.png`, writes `index.html` to look through, and
  when an entry names a `reference` image of the locked prototype's frame,
  `<name>.<viewport>.vs-prototype.png` with the app and the prototype side by
  side. A missing reference is noted, not failed.
- `visibleNumbers.mjs` — AC-9 on the rendered text: every `speaker` or
  `coach` screen fails on a visible number that is not a count or a position
  (`Take 2`, `Slide 1 of 3`, `3 Takes`, `2 of 5`, `0:12`, a document's
  `Version 3.3` or date, a bare year). A percentage never passes. An entry's
  `allow` widens the list for its own legitimate numbers (the fixture's
  "Q3 Board pitch", the stand-in deck's "~3 points") — name each in the PR.

CI runs it in the `e2e` job (the pictures are the `design-screens` artifact);
the screens must be reachable with fixtures: the `/dev/*` harness pages, the
fixture backend behind the BFF, or an entry's own `prepare` routes.

## The design-lock guard — `scripts/check-design-lock.mjs` (build plan X5)

Not a browser check, but the other half of the same lock: a commit that
changes a file in `scripts/design-locked-files.txt` (the screens CLAUDE.md's
"Design lock" sections name) must carry a `Founder-Approved:` trailer, or
`npm run check:design-lock` fails — in the `unit` job and always in
`scripts/local_ci.sh`. The trailer goes at the end of the commit message
with the other trailers:

```
Founder-Approved: Navigation Panel GO-W1, 2026-10-07
```

## Browser resolution — no hardcoded paths

Every spec launches through `_launch.mjs`, never by naming a binary:

1. `PW_CHROMIUM=/path/to/chrome` — explicit override, wins if set;
2. otherwise Playwright's own registry (honours `PLAYWRIGHT_BROWSERS_PATH`
   and whatever `npx playwright install` put there).

The playwright *module* resolves from the project `node_modules` first,
then the global npm root.

History: these specs once hardcoded one machine's
`/opt/node22/.../playwright` module and a versioned
`chromium-1194` binary, so they ran nowhere else. Don't reintroduce a
path — if a spec needs a specific browser, pass `PW_CHROMIUM`.
