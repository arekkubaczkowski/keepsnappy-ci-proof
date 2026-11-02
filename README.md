# keepsnappy-ci-proof

A scratch repository for one question: **can a KeepSnappy verdict be trusted when the test runs on a free GitHub runner?**

## What this is

- A small Expo app (TesterArmy's own example, copied under its Apache-2.0 license, see `app/UPSTREAM.md`) with three end-to-end tests that use no AI.
- TesterArmy's engine (`e2e` and `@e2e-dev/mobile`, versions pinned) drives the tests.
- The KeepSnappy SDK (`@keepsnappy/react-native`, pinned) is built into the app, and the KeepSnappy CLI (`@keepsnappy/agent`, pinned) wraps TesterArmy's command and sends what the app measured to KeepSnappy.
- One GitHub Actions workflow, `.github/workflows/proof.yml`, with two jobs:
  - **ios**: `macos-latest`, an iPhone simulator, a Release build. `keepsnappy run --upload --wait -- …` (the command is in `app/keepsnappy.yml`).
  - **android**: `ubuntu-latest` with KVM, an x86_64 Android emulator (`reactivecircus/android-emulator-runner`), a Release build. The CLI has no Android emulator path in `keepsnappy run` yet, so `scripts/android-session.mjs` does what the CLI's farm mode does: open a run set, activate the SDK per run with a link, run TesterArmy's command, flush, close the run set.

## What it measures

For each platform, 3 "main" sessions and 1 "A/A" session of 3 runs each:

- the verdict KeepSnappy gives for each session;
- the spread between the runs of one session (coefficient of variation and min–max of the metrics the judge uses);
- the wall time of each run and of each job.

An A/A session is a session of a build that is identical to main's. A trustworthy judge says "No change" for it. The numbers are compared with KeepSnappy's own simulator sessions on a Mac.

## How to run it

The workflow starts only by hand (**Actions → proof → Run workflow**), so nobody else can start it and no secret reaches a pull request.

1. Dry run (no secret needed, nothing is sent anywhere): leave *Send the runs to KeepSnappy* off.
2. Real session: needs the repository secret `KEEPSNAPPY_KEY` (a run-scope key of a KeepSnappy test app, never a customer's). Android also needs the secret `EXPO_PUBLIC_KEEPSNAPPY_KEY` (ingest scope, built into the APK, which never leaves the runner) and the repository variable `KEEPSNAPPY_API` (the public API URL). Turn *Send the runs to KeepSnappy* on.
3. Main session: run it on `main`. A/A session: run it on a branch that differs from `main` only by an empty commit.

The AI rule: `scripts/run-e2e-no-ai.sh` runs `e2e run --retries 0 --strict-cache`, then `scripts/check-report.mjs` reads `.e2e/report.json` (`report-1`) and fails the run when it holds an agent step, a model call, a retry, an unknown schema version, or no report at all. A failed command makes that run invalid in KeepSnappy.

## What it does NOT prove

- It says nothing about your app. The example is a one-screen greeting form: a short journey, so few measured windows.
- It does not show that a free runner is as quiet as a quiet Mac. It shows how noisy these runners were on the days we ran them. Shared runners vary by hour and by day.
- It does not cover real phones, a physical device farm, or TesterArmy's AI steps (those are refused).
- Android runs on a software-rendered emulator without a GPU. The spread there says nothing about a real Android phone.
- A handful of sessions is a handful of sessions: it is evidence for or against a verdict being usable, not a calibration.

## Layout

```
.github/workflows/proof.yml   the two jobs
app/                          the app, its tests, e2e.config.ts, keepsnappy.yml
scripts/check-report.mjs      the no-AI rule on e2e's report.json
scripts/run-e2e-no-ai.sh      TesterArmy's command + the rule (what keepsnappy wraps)
scripts/session-stats.mjs     spread and wall times of one session
scripts/android-session.mjs   one Android emulator session in push mode
scripts/android-job.sh        what runs inside the emulator action
```

## License

TesterArmy's example files are Apache-2.0 (`LICENSE`, `NOTICE`, `app/UPSTREAM.md`). Files written for this repository (workflow, scripts, README) are offered under the same license.
