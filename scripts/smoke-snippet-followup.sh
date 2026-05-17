#!/usr/bin/env bash
# Smoke-test for POST /v2/chat/snippet-followup.
#
# Backend Prompt 0.2 ships this endpoint. FE Prompt 0 calls this script to
# confirm the contract is live before FE Prompt 3 wires it. Run after a
# fresh backend deploy:
#
#   BACKEND_URL=https://api.willonski.com \
#   TEST_JWT=<your-test-user-jwt> \
#   SNIPPET_ID=<a-real-snippet-uuid> \
#   ./scripts/smoke-snippet-followup.sh
#
# Pass criteria:
#   1. Both calls (user_label=true and =false) return HTTP 200.
#   2. Both responses have non-empty `followup_text`.
#   3. The two responses differ (confirms backend is using the bool input,
#      not returning a cached static).
#
# Use the diff to PIN the user_label semantic in docs/PANEL-STATE-MATRIX.md:
#   - If the `true` reply reads "you agreed with my read" → AGREEMENT semantic.
#   - If it reads "you classified as charisma" → TYPE semantic.
# Update the matrix's "Pinned semantics" section accordingly before merging
# FE Prompt 3.

set -euo pipefail

: "${BACKEND_URL:?BACKEND_URL must be set}"
: "${TEST_JWT:?TEST_JWT must be set}"
: "${SNIPPET_ID:?SNIPPET_ID must be set}"

echo "→ POST /v2/chat/snippet-followup with user_label=true"
RESP_TRUE=$(curl -sS -X POST "$BACKEND_URL/v2/chat/snippet-followup" \
  -H "Authorization: Bearer $TEST_JWT" \
  -H "Content-Type: application/json" \
  -d "{\"snippet_id\": \"$SNIPPET_ID\", \"user_label\": true}")
echo "$RESP_TRUE" | jq .

echo ""
echo "→ POST /v2/chat/snippet-followup with user_label=false"
RESP_FALSE=$(curl -sS -X POST "$BACKEND_URL/v2/chat/snippet-followup" \
  -H "Authorization: Bearer $TEST_JWT" \
  -H "Content-Type: application/json" \
  -d "{\"snippet_id\": \"$SNIPPET_ID\", \"user_label\": false}")
echo "$RESP_FALSE" | jq .

TRUE_TEXT=$(echo "$RESP_TRUE"  | jq -r '.followup_text // empty')
FALSE_TEXT=$(echo "$RESP_FALSE" | jq -r '.followup_text // empty')

if [ -z "$TRUE_TEXT" ] || [ -z "$FALSE_TEXT" ]; then
  echo "FAIL: empty followup_text on at least one response."
  exit 1
fi

if [ "$TRUE_TEXT" = "$FALSE_TEXT" ]; then
  echo "FAIL: both responses are identical — backend likely ignoring user_label."
  exit 1
fi

echo ""
echo "OK: endpoint live, contract matches, bool input is being used."
echo ""
echo "Now PIN the user_label semantic in docs/PANEL-STATE-MATRIX.md based on"
echo "which response reads as 'you agreed' vs 'you classified.'"
