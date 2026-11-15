#!/usr/bin/env bash
# Runs every browser scenario against a builder build that has test hooks.
#
#   NEXT_PUBLIC_TEST_HOOKS=1 npm run build && npx next start -p 3211   # in another terminal
#   tests/browser/run-all.sh [url] [log-file]
#
# Defaults: url http://localhost:3211/, log evidence/browser-tests.log
# Note: demo-sequence (1) and real-ai-edits (2) make small real Claude calls; everything else is free.
set -uo pipefail

URL="${1:-http://localhost:3211/}"
LOG="${2:-evidence/browser-tests.log}"
OUT="tests/browser/output"
RUN=(node tests/browser/cdp.mjs --url "$URL" --out "$OUT")
PROFILE="$(mktemp -d -t vs-profile)"
mkdir -p "$(dirname "$LOG")"

{
  echo "Vyohm Studio browser test run — $(date '+%Y-%m-%d %H:%M %Z')"
  echo "Builder: $URL (build with NEXT_PUBLIC_TEST_HOOKS=1), headless Chrome via tests/browser/cdp.mjs"
  echo
  echo "=== layout-and-inline ==="
  "${RUN[@]}" --script tests/browser/scenarios/layout-and-inline.js
  echo
  echo "=== mobile-override ==="
  "${RUN[@]}" --script tests/browser/scenarios/mobile-override.js
  echo
  echo "=== ai-failures (fake AI responses) ==="
  "${RUN[@]}" --script tests/browser/scenarios/ai-failures.js --fixture tests/browser/fixtures/generated-page.json
  echo
  echo "=== upload-persist (part 1) ==="
  "${RUN[@]}" --script tests/browser/scenarios/upload-persist.js --profile "$PROFILE"
  echo
  echo "=== after-reload (part 2: same browser profile = browser reopened) ==="
  "${RUN[@]}" --script tests/browser/scenarios/after-reload.js --profile "$PROFILE"
  echo
  echo "=== demo-sequence (one real Claude edit) ==="
  "${RUN[@]}" --script tests/browser/scenarios/demo-sequence.js
  echo
  echo "=== real-ai-edits (two real Claude edits) ==="
  "${RUN[@]}" --script tests/browser/scenarios/real-ai-edits.js
} > "$LOG" 2>&1

passed=$(grep -c '"pass": true' "$LOG")
failed=$(grep -c '"pass": false' "$LOG")
errors=$(grep -c 'scenario error' "$LOG")
echo "Checks passed: $passed, failed: $failed, scenario errors: $errors (log: $LOG)"
[ "$failed" -eq 0 ] && [ "$errors" -eq 0 ]
