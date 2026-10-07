#!/usr/bin/env bash
#
# screenshots.sh — the shared screenshot harness (X7), self-contained.
#
# Starts the fixture backend and `next dev` with the e2e placeholders, runs
# e2e/screenshots/capture.mjs against them, and stops both. Needs Chromium
# where Playwright finds it (PLAYWRIGHT_BROWSERS_PATH, or `npx playwright
# install chromium` once per machine; never in a cloud session, where it is
# preinstalled).
#
#   scripts/screenshots.sh                      # every screen, both viewports
#   scripts/screenshots.sh --area walk,consent  # one or more areas
#   OUT_DIR=/tmp/shots scripts/screenshots.sh   # elsewhere (default e2e/artifacts/screenshots)
#
# scripts/local_ci.sh runs this when WILLAB_SCREENSHOTS=1; the CI e2e job runs
# capture.mjs on its own dev server.

set -uo pipefail
cd "$(dirname "$0")/.." || exit 2

PORT="${SCREENSHOTS_PORT:-3111}"
FIXTURE_PORT="${FIXTURE_PORT:-3999}"
LOG_DIR="${TMPDIR:-/tmp}"

export NEXT_PUBLIC_SUPABASE_URL="${NEXT_PUBLIC_SUPABASE_URL:-https://dummy.supabase.co}"
export NEXT_PUBLIC_SUPABASE_ANON_KEY="${NEXT_PUBLIC_SUPABASE_ANON_KEY:-dummy-anon-key}"
export NEXT_PUBLIC_API_URL="${NEXT_PUBLIC_API_URL:-http://127.0.0.1:${FIXTURE_PORT}}"
export OPENAI_API_KEY="${OPENAI_API_KEY:-sk-dummy-never-called}"

# Each server in its own process group (setsid), so stopping it stops the
# children `npx` and `next dev` fork, not only the wrapper.
FIXTURE_PORT="$FIXTURE_PORT" setsid node e2e/_fixture-backend.mjs > "$LOG_DIR/fixture-backend.log" 2>&1 &
FIXTURE_PID=$!
setsid npx next dev -p "$PORT" > "$LOG_DIR/nextdev-screenshots.log" 2>&1 &
NEXT_PID=$!
trap 'kill -- -$NEXT_PID -$FIXTURE_PID 2>/dev/null; wait $NEXT_PID $FIXTURE_PID 2>/dev/null' EXIT

for _ in $(seq 1 60); do
  curl -sf -o /dev/null "http://localhost:$PORT/" && break
  sleep 2
done
if ! curl -sf -o /dev/null "http://localhost:$PORT/"; then
  echo "next dev did not come up on :$PORT" >&2
  tail -30 "$LOG_DIR/nextdev-screenshots.log" >&2
  exit 1
fi

BASE_URL="http://localhost:$PORT" node e2e/screenshots/capture.mjs "$@"
