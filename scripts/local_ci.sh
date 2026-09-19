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
# `npx playwright test` when touching the deck's DOM.
#
# Usage:
#   scripts/local_ci.sh              # the full gate
#   scripts/local_ci.sh --no-build   # skip the build (only when iterating)

set -uo pipefail

cd "$(dirname "$0")/.." || exit 2

WITH_BUILD=1
[ "${1:-}" = "--no-build" ] && WITH_BUILD=0

FAILED=()
PASSED=()

bold() { printf '\033[1m%s\033[0m\n' "$1"; }
dim() { printf '\033[2m%s\033[0m\n' "$1"; }

step() {
  local name="$1"; shift
  bold "→ ${name}"
  if "$@" > /tmp/fe_ci_step.log 2>&1; then
    PASSED+=("$name")
  else
    FAILED+=("$name")
    tail -30 /tmp/fe_ci_step.log
  fi
}

# The five steps of the `unit` job, in its order.
step "Vitest" npm run test
step "Lint" npm run lint
step "Type-check" npx tsc --noEmit
step "BFF single-idiom guard" npm run check:bff
step "Complexity ratchet" npm run check:complexity

# The step CI does not have and Vercel does. A green run without this proves
# the sources type-check; it does not prove the app builds.
if [ "$WITH_BUILD" = 1 ]; then
  step "Production build (what Vercel runs)" npm run build
else
  dim "  production build: SKIPPED (--no-build) — this run does NOT clear the gate"
fi

echo
bold "── local CI ──────────────────────────────────────────────"
for name in "${PASSED[@]}"; do printf '  pass %s\n' "$name"; done
for name in "${FAILED[@]}"; do printf '  FAIL %s\n' "$name"; done
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
