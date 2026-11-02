# keepsnappy-ci-proof

A scratch repository for one question: **can a KeepSnappy verdict be trusted when the test runs on a free GitHub runner?**

## What this is

- A small Expo app (TesterArmy's own example, copied under its Apache-2.0 license, see `app/UPSTREAM.md`) with three end-to-end tests that use no AI.
- TesterArmy's engine (`e2e` and `@e2e-dev/mobile`, versions pinned) drives the tests.
- The KeepSnappy SDK (`@keepsnappy/react-native`, pinned) is built into the app, and the KeepSnappy CLI (`@keepsnappy/agent`, pinned) wraps TesterArmy's command and sends what the app measured to KeepSnappy.
- One GitHub Actions workflow, `.github/workflows/proof.yml`, with two jobs:
  - **ios**: `macos-latest`, an iPhone simulator, a Release build. `keepsnappy run --upload --wait -- …` (the command is in `app/keepsnappy.yml`).
  - **android**: `ubuntu-latest` with KVM, an x86_64 Android emulator (`reactivecircus/android-emulator-runner`), a Release build. The CLI has no Android emulator path in `keepsnappy run` yet, so `scripts/android-session.mjs` does what the CLI's farm mode does: open a run set, activate the SDK per run with a link, run TesterArmy's command, flush, close the run set.

## Result (2 November 2026)

**Short version:** on free GitHub runners the whole path works for both iOS and Android, and the identical-build ("A/A") session on each platform came back as "No change", not as a false "Worse". That is one sample per platform, so it is encouraging, not proof of a low false-alarm rate.

- **8 sessions, 24 of 24 runs valid.** Per platform: 3 main sessions and 1 A/A session, 3 runs each.
- **iOS:** `macos-latest`, iPhone 17 Pro simulator, iOS 26.5. Sessions: [main 1](https://github.com/arekkubaczkowski/keepsnappy-ci-proof/actions/runs/41410597039), [main 2](https://github.com/arekkubaczkowski/keepsnappy-ci-proof/actions/runs/41410606657), [main 3](https://github.com/arekkubaczkowski/keepsnappy-ci-proof/actions/runs/41410615978), [A/A](https://github.com/arekkubaczkowski/keepsnappy-ci-proof/actions/runs/41417432690). Whole jobs took 9.5–20.4 minutes; one test run took 26–78 seconds.
- **Android:** `ubuntu-latest` with KVM, Android 16 emulator (x86_64, software GPU). Sessions: [main 1](https://github.com/arekkubaczkowski/keepsnappy-ci-proof/actions/runs/41417343200), [main 2](https://github.com/arekkubaczkowski/keepsnappy-ci-proof/actions/runs/41417353509), [main 3](https://github.com/arekkubaczkowski/keepsnappy-ci-proof/actions/runs/41417364226), [A/A](https://github.com/arekkubaczkowski/keepsnappy-ci-proof/actions/runs/41420250448). Whole jobs took 9.5–12.9 minutes; one test run took 12.5–32.5 seconds.
- **Verdicts.** Both A/A sessions: **No change**, computed about 2.5 minutes after each session closed. The six main sessions: **Can't tell**, because a main session is compared with the three before it and these had 0, 1 and 2. That is the expected warm-up; a fourth main session per platform would get a real comparison.
- **Spread on iOS** (three runs of one session): touch response varied by 22.6–37.9 % (coefficient of variation) and the longest frame gap by 17.8–50.6 %. Single runs on a shared runner are noisy, which is why a verdict needs several runs.
- **Spread on Android is unknown.** The Android sessions upload their data but their output has no per-run metrics file, so the spread could not be computed. That is a gap in what the job saves, not a sign of zero noise. It matters because the spread decides how often a customer would see "Can't tell" or a false "Worse".

### A note on `--wait`

The job logs and result files in the iOS runs say `Verdict not computed yet`. That is not a missing verdict: the published `keepsnappy run --wait` returns when the runs are processed, and the judge computes the verdict about three minutes later. The saved file is never updated. Making `--wait` wait for the verdict is a fix in progress on the KeepSnappy side; until then, read the verdict from KeepSnappy a few minutes after the job.

### What this shows, and what it does not

- Shows: the engine, the SDK, the upload and the judge work together on a free iOS runner and a free Android emulator; an identical build was not called worse on either.
- Does not show: a false-alarm rate (that needs several A/A sessions per platform); that a real slowdown is caught (no deliberate slowdown was tested); how noisy Android is; or a main-to-main comparison.
- Next, all on free runners: more A/A sessions, a fourth main session, saving Android's per-run metrics, and a session with a deliberate slowdown.

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
- It does not show that a free runner is as quiet as a quiet Mac. It shows how noisy these runners were on the days we ran them (2 November 2026, the iOS spread above). Shared runners vary by hour and by day.
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
