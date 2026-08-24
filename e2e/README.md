# e2e specs — real-browser checks for what jsdom can't answer

Seven standalone Playwright scripts (not a test-runner suite): each boots
Chromium, drives a page, prints PASS/FAIL lines, and exits non-zero on any
failure.

| spec | harness page | default target |
| --- | --- | --- |
| `bets-reorder.spec.mjs` | `/dev/life-bets` | `BETS_URL` → `:3111` |
| `corpus.spec.mjs` | `/dev/corpus` | `CORPUS_URL` → `:3111` |
| `csp-violations.spec.mjs` | public routes (REAL surfaces) | `BASE_URL` → `:3140` |
| `deck.spec.mjs` | `/dev/deck` | `DECK_URL` → `:3111` |
| `marked-editor.spec.mjs` | `/dev/marked-editor` | `MARKED_URL` → `:3123` |
| `record-flow.spec.mjs` | `/chat` (REAL surface) | `BASE_URL` → `:3142` |
| `star-verdicts.spec.mjs` | `/dev/star-verdicts` | `STARS_URL` → `:3111` |

The five `/dev/*` harness pages stub their own network, so no backend is
needed for them. **record-flow is the exception**: it drives the real
record flow at `/chat`, which calls the backend through the BFF — it needs
the full local stack (backend up + real env) and is therefore not part of
the CI e2e job.

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

# The env shape is part of the harness contract: the star-verdicts fixture
# seeds an sb-dummy-* auth cookie, so the Supabase URL's project ref MUST
# be "dummy". These are placeholders — nothing ever connects to them.
NEXT_PUBLIC_SUPABASE_URL=https://dummy.supabase.co \
NEXT_PUBLIC_SUPABASE_ANON_KEY=dummy-anon-key \
npx next dev -p 3111              # in one terminal

node e2e/bets-reorder.spec.mjs    # in another
node e2e/corpus.spec.mjs
node e2e/star-verdicts.spec.mjs
node e2e/deck.spec.mjs
MARKED_URL=http://localhost:3111/dev/marked-editor node e2e/marked-editor.spec.mjs
```

Point a spec at a different port with its URL env var
(e.g. `STARS_URL=http://localhost:3000/dev/star-verdicts`). Load the page
once in a browser (or curl it) before the first spec run — `next dev`
compiles on demand, and a spec navigating mid-compile races its own
selectors.

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
