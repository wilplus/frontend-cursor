#!/usr/bin/env bash
#
# vercel-ignore-build.sh — Vercel's Ignored Build Step (`ignoreCommand` in
# vercel.json). Exit 0 skips the build, exit 1 builds.
#
# WHY THIS EXISTS (2026-10-27). Every merge to `main` is a production
# deployment, and Vercel keeps each one's Function bundles for the retention
# period. 555 merges in 30 days filled the Hobby team's 10 GB of Functions
# Storage with no users at all, and a team over the limit can be blocked from
# deploying. 78 of those 555 changed only docs, Markdown or tests: nothing the
# site serves. Those are skipped now; everything else builds as before.
#
# A fix must never be skipped (see local_ci.sh: a fix that never deployed is
# a fix the founder can't see). So it builds whenever it can't be sure:
#   - no previous deployment to compare with (first deploy, CLI, deploy hook);
#   - the same commit as the previous deployment: that is a Redeploy, usually
#     after an environment variable changed;
#   - the previous deployment's commit is not in Vercel's shallow clone;
#   - any git error.
# VERCEL_GIT_PREVIOUS_SHA is the last SUCCESSFUL deployment's commit, so a code
# change whose build failed is still built by the next docs-only merge.
#
# A skipped build shows as Canceled and still counts toward the deployments a
# day, but it stores no Function bundles.

base="${VERCEL_GIT_PREVIOUS_SHA:-}"
head="$(git rev-parse HEAD 2>/dev/null)" || exit 1

[ -n "$base" ] || exit 1
git cat-file -e "${base}^{commit}" 2>/dev/null || exit 1
[ "$(git rev-parse "$base")" != "$head" ] || exit 1

git diff --quiet "$base" HEAD -- . \
  ':(exclude)docs' \
  ':(exclude)*.md' \
  ':(exclude)*.test.ts' \
  ':(exclude)*.test.tsx' \
  ':(exclude)*.golden.json' \
  ':(exclude).github'
case $? in
  0) echo "Only docs, Markdown or tests changed since ${base:0:12}: skipping the build."; exit 0 ;;
  *) exit 1 ;;
esac
