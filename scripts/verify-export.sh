#!/usr/bin/env bash
# Checks an exported website.zip the same way the evaluator does:
# extract into a fresh folder, check its contents, then npm ci + npm run build.
#
# Usage: scripts/verify-export.sh ~/Downloads/website.zip
set -euo pipefail

if [ $# -ne 1 ] || [ ! -f "$1" ]; then
  echo "Usage: $0 path/to/website.zip" >&2
  exit 1
fi

ZIP="$(cd "$(dirname "$1")" && pwd)/$(basename "$1")"
DIR="$(mktemp -d -t website-export)"
cd "$DIR"
unzip -q "$ZIP"
echo "Extracted to $DIR"

for file in package.json package-lock.json tsconfig.json app/page.tsx app/layout.tsx data/page.json README.md; do
  [ -f "$file" ] || { echo "FAIL: missing $file" >&2; exit 1; }
done
if ls -a | grep -q '^\.env'; then echo "FAIL: .env file found in export" >&2; exit 1; fi
if grep -rq "sk-ant" . ; then echo "FAIL: something that looks like an API key was found" >&2; exit 1; fi
if grep -Eq '"(asset:|blob:)' data/page.json; then echo "FAIL: editor-only image references in data/page.json" >&2; exit 1; fi
echo "Contents OK ($(find public/assets -type f ! -name .gitkeep | wc -l | tr -d ' ') uploaded image(s))"

npm ci --no-audit --no-fund
npm run build

echo
echo "PASS: the export installs and builds."
echo "To view it: cd \"$DIR\" && npm run start"
