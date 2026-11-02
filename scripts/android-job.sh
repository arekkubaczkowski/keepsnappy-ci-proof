#!/usr/bin/env bash
# Runs inside the emulator action (its `script:` lines each run in their own shell, so this is one script).
set -euo pipefail
adb install -r "$APK_PATH"
adb shell pm list packages | grep dev.e2e.examples.expo
args=(--repeat "$REPEAT" --out keepsnappy-out --branch "$GITHUB_REF_NAME" --commit "$GITHUB_SHA")
if [ "${UPLOAD:-false}" = "true" ]; then args+=(--upload); [ -n "${KEEPSNAPPY_API:-}" ] && args+=(--api "$KEEPSNAPPY_API"); fi
# One warm call so the first measured run does not pay for the engine's first start.
npx e2e run --target android --retries 0 --strict-cache || true
node ../scripts/android-session.mjs "${args[@]}"
