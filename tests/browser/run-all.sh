#!/usr/bin/env bash
# Runs every browser scenario against a builder build that has test hooks.
#
#   NEXT_PUBLIC_TEST_HOOKS=1 npm run build && npx next start -p 3211   # in another terminal
#   tests/browser/run-all.sh [base-url] [log-file]
#
# Defaults: base http://localhost:3211 (landing "/", chat "/start", editor "/editor"),
# log evidence/browser-tests.log.
# Note: demo-sequence (1) and real-ai-edits (4) make small real Claude calls; everything else is free.
set -uo pipefail

BASE="${1:-http://localhost:3211}"
BASE="${BASE%/}"
# ?sample=1 opens the sample page when nothing is saved (a fresh test browser); see editor-welcome for /editor itself.
EDITOR="$BASE/editor?sample=1"
LOG="${2:-evidence/browser-tests.log}"
OUT="tests/browser/output"
RUN=(node tests/browser/cdp.mjs --out "$OUT")
FIXTURE=(--fixture tests/browser/fixtures/generated-page.json)
PROFILE="$(mktemp -d -t vs-profile)"
mkdir -p "$(dirname "$LOG")"

{
  echo "Vyohm Studio browser test run — $(date '+%Y-%m-%d %H:%M %Z')"
  echo "Builder: $BASE (build with NEXT_PUBLIC_TEST_HOOKS=1), headless Chrome via tests/browser/cdp.mjs"
  echo
  echo "=== landing (desktop 1440px) ==="
  "${RUN[@]}" --url "$BASE/" --script tests/browser/scenarios/landing.js --width 1440 --wait 3000
  echo
  echo "=== landing (phone 390px) ==="
  "${RUN[@]}" --url "$BASE/" --script tests/browser/scenarios/landing.js --width 390 --height 844 --wait 3000
  echo
  echo "=== start-flow (chat -> build animation -> preview -> editor; fake AI response) ==="
  "${RUN[@]}" --url "$BASE/start" --script tests/browser/scenarios/start-flow.js "${FIXTURE[@]}" --wait 3000
  echo
  echo "=== editor-welcome (no saved page -> choice, then blank page) ==="
  "${RUN[@]}" --url "$BASE/editor" --script tests/browser/scenarios/editor-welcome.js
  echo
  echo "=== editor-sample-choice ==="
  "${RUN[@]}" --url "$BASE/editor" --script tests/browser/scenarios/editor-sample-choice.js
  echo
  LEGACY="$(mktemp -d -t vs-legacy)"
  echo "=== legacy-sample (an old auto-saved sample must not open by itself; 3 steps, same browser) ==="
  "${RUN[@]}" --url "$BASE/start" --script tests/browser/scenarios/legacy-sample-setup.js "${FIXTURE[@]}" --profile "$LEGACY" --wait 2500
  "${RUN[@]}" --url "$BASE/editor" --script tests/browser/scenarios/legacy-sample-check.js "${FIXTURE[@]}" --profile "$LEGACY" --wait 4000
  "${RUN[@]}" --url "$BASE/editor" --script tests/browser/scenarios/legacy-sample-reload.js --profile "$LEGACY" --wait 5000
  echo
  echo "=== layout-and-inline ==="
  "${RUN[@]}" --url "$EDITOR" --script tests/browser/scenarios/layout-and-inline.js
  echo
  echo "=== drag-and-drop (REAL mouse drags: allowed move + refused drops with feedback) ==="
  "${RUN[@]}" --url "$EDITOR" --script tests/browser/scenarios/drag-and-drop.js
  echo
  echo "=== design-options ==="
  "${RUN[@]}" --url "$EDITOR" --script tests/browser/scenarios/design-options.js
  echo
  echo "=== image-crop (drop a photo, crop, crop again from the original, undo/redo, image links) ==="
  "${RUN[@]}" --url "$EDITOR" --script tests/browser/scenarios/image-crop.js
  echo
  echo "=== mobile-override ==="
  "${RUN[@]}" --url "$EDITOR" --script tests/browser/scenarios/mobile-override.js
  echo
  echo "=== ai-failures (fake AI responses) ==="
  "${RUN[@]}" --url "$EDITOR" --script tests/browser/scenarios/ai-failures.js "${FIXTURE[@]}"
  echo
  echo "=== upload-persist (part 1) ==="
  "${RUN[@]}" --url "$EDITOR" --script tests/browser/scenarios/upload-persist.js --profile "$PROFILE"
  echo
  echo "=== after-reload (part 2: same browser profile = browser reopened) ==="
  "${RUN[@]}" --url "$EDITOR" --script tests/browser/scenarios/after-reload.js --profile "$PROFILE"
  echo
  echo "=== demo-sequence (one real Claude edit) ==="
  "${RUN[@]}" --url "$EDITOR" --script tests/browser/scenarios/demo-sequence.js
  echo
  echo "=== real-ai-edits (four real Claude edits) ==="
  "${RUN[@]}" --url "$EDITOR" --script tests/browser/scenarios/real-ai-edits.js
} > "$LOG" 2>&1

passed=$(grep -c '"pass": true' "$LOG")
failed=$(grep -c '"pass": false' "$LOG")
errors=$(grep -c 'scenario error' "$LOG")
echo "Checks passed: $passed, failed: $failed, scenario errors: $errors (log: $LOG)"
[ "$failed" -eq 0 ] && [ "$errors" -eq 0 ]
