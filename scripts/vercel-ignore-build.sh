#!/usr/bin/env bash
#
# vercel-ignore-build.sh — Vercel's Ignored Build Step (`ignoreCommand` in
# vercel.json). Exit 0 skips the deployment; exit 1 builds it.
#
# WHY THIS EXISTS (2026-10-21). Every merge to main is a production
# deployment, and Vercel stores each one's output for the retention period
# (30 days on Hobby): 476 deployments in the 30 days to 2026-10-21. 31 of
# them changed nothing the app is built from (CLAUDE.md, a flow page, a test,
# a CI guard) and still stored a full copy of the app. This skips those, and
# only those. The live deployment stays the last one that built.
#
# WHEN UNSURE, IT BUILDS: no previous successful deployment to compare with,
# a redeploy of the same commit (that is on purpose, e.g. an env var
# changed), a base older than Vercel's 10-commit clone, or any git error.
#
# A path is skippable only if `next build` never turns it into anything
# Vercel serves. Anything not matched below builds, so a new kind of file is
# deployed until someone decides otherwise.
#
#   docs/, .taskmaster/, .claude/, .cursor/   pages and agent notes
#   .github/                                  CI (GitHub runs it, not Vercel)
#   cloudflare/                               the upload Worker, deployed by hand
#   AGENTS.md, CLAUDE.md, README.md           the root pages
#   scripts/ (not copy-pdf-worker.mjs)        CI guards and the local gate;
#                                             copy-pdf-worker.mjs runs on
#                                             install and feeds public/
#   *.test.ts(x|mjs), vitest.config.ts        tests
#
# A test-only commit is still linted and type-checked by CI before it merges
# (scripts/local_ci.sh also runs the build), so skipping its deploy loses no
# check that guarded production.

set -uo pipefail

build() { echo "vercel-ignore-build: building — $1"; exit 1; }
skip() { echo "vercel-ignore-build: skipped — $1"; exit 0; }

base="${VERCEL_GIT_PREVIOUS_SHA:-}"
head="$(git rev-parse HEAD 2>/dev/null)" || build "no git checkout"

[ -n "$base" ] || build "no previous successful deployment to compare with"
[ "$(git rev-parse "$base" 2>/dev/null)" != "$head" ] || build "a redeploy of the deployed commit"
git cat-file -e "${base}^{commit}" 2>/dev/null || build "the last deployed commit ${base:0:12} is not in the clone"

changed="$(git diff --name-only "$base" "$head")" || build "git diff failed"

ALWAYS_BUILT='^scripts/copy-pdf-worker\.mjs$'
NOT_BUILT='^(docs|\.taskmaster|\.claude|\.cursor|\.github|cloudflare|scripts)/|^(AGENTS|CLAUDE|README)\.md$|^vitest\.config\.ts$|\.test\.(ts|tsx|mjs)$'

built="$({
  printf '%s\n' "$changed" | grep -E "$ALWAYS_BUILT"
  printf '%s\n' "$changed" | grep -vE "$NOT_BUILT"
} | grep -v '^$')"

[ -z "$built" ] || build "$(printf '%s\n' "$built" | head -1) changed"
skip "nothing the app is built from changed since ${base:0:12}"
