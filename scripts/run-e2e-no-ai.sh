#!/usr/bin/env bash
# The command `keepsnappy run` wraps: TesterArmy's own engine, then the no-AI check on its report.
# Usage: run-e2e-no-ai.sh ios|android   (from the app directory)
set -uo pipefail
platform="${1:?platform ios|android}"
here="$(cd "$(dirname "$0")" && pwd)"
rm -f .e2e/report.json
npx e2e run --target "$platform" --retries 0 --strict-cache
code=$?
node "$here/check-report.mjs" .e2e/report.json || exit 1
exit "$code"
