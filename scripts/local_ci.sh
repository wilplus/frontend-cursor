#!/usr/bin/env bash
#
# local_ci.sh — the frontend merge gate, run locally.
#
# WHY THIS EXISTS (2026-09-19). A commit merged to `main` with an
# `eslint-disable` naming a rule this repo does not configure. Every check the
# repo had was green — vitest, next lint, tsc, the BFF guard, the complexity
# ratchet — because `.github/workflows/tests.yml` runs exactly those five and
# NONE of them is `next build`. `next build` runs lint over the production
# entry graph and fails hard on an unknown rule inside a disable comment, so
# Vercel went red, `main` stopped deploying, and the fixes merged that hour
# never reached the product. The founder recorded a take against a bundle that
# did not contain them and reported, correctly, that nothing had changed.
#
# `tsc --noEmit` is not `next build`. That is the whole lesson: type-checking
# the sources is not the same as building the app Vercel serves, and the gate
# has to include the command the deploy actually runs or the deploy is an
# untested step.
#
# So this runs the `unit` job's five steps IN THE JOB'S ORDER, and then the
# production build. Anything green here is green on CI and deploys.
#
# NOT RUN HERE: the `e2e` job (Playwright + Chromium + a dev server). It is
# slower than the whole of the rest and it is not what broke. Run it with
# `npx playwright test` when touching the deck's DOM. One part of it is
# opt-in here: the shared screenshot harness (X7, e2e/screenshots/capture.mjs)
# with its AC-9 number scan, with WILLAB_SCREENSHOTS=1 — it needs Chromium.
#
# ALWAYS RUN HERE, as in the unit job: the design-lock guard (X5,
# scripts/check-design-lock.mjs) — a commit that changes a founder-locked
# screen's file without a `Founder-Approved:` trailer is red.
#
# Usage (on Node 22, the version CI runs; `nvm use` reads .nvmrc):
#   scripts/local_ci.sh              # the full gate
#   scripts/local_ci.sh --no-build   # skip the build (only when iterating)
#   WILLAB_SCREENSHOTS=1 scripts/local_ci.sh   # plus the screenshot harness

set -uo pipefail

cd "$(dirname "$0")/.." || exit 2

WITH_BUILD=1
[ "${1:-}" = "--no-build" ] && WITH_BUILD=0

FAILED=()
PASSED=()

bold() { printf '\033[1m%s\033[0m\n' "$1"; }
dim() { printf '\033[2m%s\033[0m\n' "$1"; }

# The Node the jobs run (`node-version` in .github/workflows/tests.yml) and
# .nvmrc names; scripts/localCiMirror.test.ts fails if the three disagree.
# An older Node gives a wrong verdict, not a slower one: under Node 20 every
# `@vitest-environment jsdom` suite dies at worker start
# (`webidl.util.markAsUncloneable is not a function`) and Vitest is red while
# every test passes (2026-10-06, the nvm default on the founder's Mac). So the
# gate stops before its first step.
NODE_MAJOR=22
node_version="$(node -v 2>/dev/null)"
node_major="${node_version#v}"
node_major="${node_major%%.*}"
case "$node_major" in ''|*[!0-9]*) node_major=0 ;; esac
if [ "$node_major" -lt "$NODE_MAJOR" ]; then
  bold "STOPPED — the gate needs Node ${NODE_MAJOR} or newer (CI runs ${NODE_MAJOR}); \`node -v\` here says ${node_version:-nothing}."
  echo "  On an older Node every jsdom test suite fails at start-up, so Vitest is red whatever the code does."
  echo "  Switch first (\`nvm use\` reads .nvmrc), then run the gate again."
  exit 2
fi

# A log of its own per run. The fixed /tmp/fe_ci_step.log was shared by every
# run on the machine, and parallel sessions run this gate at once: one run
# overwrote the failure tail another was about to print.
tmp_root="${TMPDIR:-/tmp}"
STEP_LOG="$(mktemp "${tmp_root%/}/fe_ci_step.XXXXXX")" || exit 2
trap 'rm -f "$STEP_LOG"' EXIT

step() {
  local name="$1"; shift
  bold "→ ${name}"
  if "$@" > "$STEP_LOG" 2>&1; then
    PASSED+=("$name")
  else
    FAILED+=("$name")
    tail -30 "$STEP_LOG"
  fi
}

# The six steps of the `unit` job, in its order.
step "Vitest" npm run test
step "Lint" npm run lint
step "Type-check" npx tsc --noEmit
step "BFF single-idiom guard" npm run check:bff
step "Complexity ratchet" npm run check:complexity
step "Design-lock guard" npm run check:design-lock

# The screenshot harness from the `e2e` job (X7): every locked screen at
# 390x844 and 1280x800, and no number but a count or a position on any of
# them (AC-9). Opt-in: it boots a dev server and needs Chromium.
if [ "${WILLAB_SCREENSHOTS:-0}" = 1 ]; then
  step "Design screenshots and the AC-9 number scan" npm run screenshots
else
  dim "  design screenshots: SKIPPED (set WILLAB_SCREENSHOTS=1 to run the harness)"
fi

# The step CI does not have and Vercel does. A green run without this proves
# the sources type-check; it does not prove the app builds.
if [ "$WITH_BUILD" = 1 ]; then
  step "Production build (what Vercel runs)" npm run build
else
  dim "  production build: SKIPPED (--no-build) — this run does NOT clear the gate"
fi

echo
bold "── local CI ──────────────────────────────────────────────"
# `${A[@]+"${A[@]}"}`, not `"${A[@]}"`: under `set -u`, bash 3.2 (macOS's
# /bin/bash) calls an empty array unbound, so the plain form killed the script
# at the FAILED loop exactly when every step had passed: exit 1, no GREEN
# (2026-10-06).
for name in ${PASSED[@]+"${PASSED[@]}"}; do printf '  pass %s\n' "$name"; done
for name in ${FAILED[@]+"${FAILED[@]}"}; do printf '  FAIL %s\n' "$name"; done
echo

if [ ${#FAILED[@]} -ne 0 ]; then
  bold "RED — ${#FAILED[@]} step(s) failed. Not mergeable."
  exit 1
fi

if [ "$WITH_BUILD" = 0 ]; then
  bold "INCOMPLETE — the production build was skipped. Re-run without --no-build."
  exit 1
fi

bold "GREEN — every gate CI runs, plus the build Vercel runs."
