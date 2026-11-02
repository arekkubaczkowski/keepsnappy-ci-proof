# Where this app comes from

`app/` is a copy of TesterArmy's example app `examples/with-expo` from https://github.com/tester-army/e2e
(commit `720947dcd7a3c49297344d2520ef337d63f2007c`, Apache License 2.0, `Copyright 2026 TesterArmy, Inc.`).
The license text is `../LICENSE` and the notice is `../NOTICE`, both copied unchanged from that repository.

What we changed (Apache-2.0 §4(b)):

- `package.json`: every version pinned exactly (`e2e` 0.22.0, `@e2e-dev/mobile` 0.12.5, Expo SDK 57.0.26, React Native 0.86.3);
  added `@keepsnappy/react-native` 0.1.0-alpha.21; removed the web target, `ai`, `zod` and `playwright`.
- `e2e.config.ts`: the web target and the agent model were removed.
- `app.json`: added the `keepsnappyproof` URL scheme and the `@keepsnappy/react-native` config plugin.
- `metro.config.js`: new, wraps the Metro config with `withKeepSnappy`.
- `tests/agentic.e2e.ts`: not copied. The tests here have no AI steps.
- `keepsnappy.yml`: new.

`App.tsx`, `index.ts`, `tsconfig.json`, `assets/` and `tests/deterministic.e2e.ts` are unchanged.
