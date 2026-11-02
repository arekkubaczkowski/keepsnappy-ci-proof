// One Android emulator session in push mode. `keepsnappy run` has no Android emulator path yet (plan 88 §1b), so this
// script does what the farm does with the published CLI: `keepsnappy farm open` (run set + one run token per iteration),
// then per iteration: activate the SDK with its token through a link, run TesterArmy's own command, send the flush link and
// wait for the SDK's answer in logcat; then `keepsnappy farm close --wait` for the verdict.
// Usage: node android-session.mjs --repeat 3 --upload|--no-upload --out <dir> [--branch B --commit SHA]
// Run from the app directory with an emulator attached (adb) and the app installed.
import { spawn, execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync, mkdirSync, existsSync, unlinkSync, appendFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { parseArgs } from 'node:util';

const { values: a } = parseArgs({
  options: {
    repeat: { type: 'string', default: '3' }, out: { type: 'string', default: 'keepsnappy-out' },
    upload: { type: 'boolean', default: false }, branch: { type: 'string' }, commit: { type: 'string' },
    'base-commit': { type: 'string' }, api: { type: 'string' },
    pkg: { type: 'string', default: 'dev.e2e.examples.expo' }, scheme: { type: 'string', default: 'keepsnappyproof://' },
    journey: { type: 'string', default: 'deterministic' },
  },
});
const repeat = Number(a.repeat);
const out = resolve(a.out);
mkdirSync(out, { recursive: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const adb = (...args) => execFileSync('adb', args, { encoding: 'utf8', maxBuffer: 64 << 20 });
const sh = (cmd) => adb('shell', cmd);
const q = (s) => `'${s.replaceAll("'", "'\\''")}'`;
const route = `${a.scheme}devtools/keepsnappy`;
const log = (m) => console.log(`[android-session] ${m}`);
const run = (cmd, args, env = process.env) => new Promise((done) => {
  const child = spawn(cmd, args, { stdio: 'inherit', env });
  child.on('error', () => done(127));
  child.on('exit', (code) => done(code ?? 1));
});

const serial = adb('devices').split('\n').map((l) => l.split('\t')).find((p) => p[1] === 'device')?.[0];
if (!serial) { console.error('no emulator attached'); process.exit(2); }
const model = sh('getprop ro.product.model').trim();
const osVersion = sh('getprop ro.build.version.release').trim();
log(`device ${serial}: ${model}, Android ${osVersion}`);

let tokens = null;
const state = join(out, 'farm-state.json');
const tokensFile = join(out, 'tokens.js');
if (a.upload) {
  const open = ['farm', 'open', '--branch', a.branch, '--commit', a.commit, '--device-id', serial,
    '--device-model', model, '--device-os', osVersion, '--device-provider', 'emulator', '--platform', 'android',
    '--journeys', a.journey, '--repeat', String(repeat), '--tokens-js', tokensFile, '--state', state,
    ...(a.api ? ['--api', a.api] : []), ...(a['base-commit'] ? ['--base-commit', a['base-commit']] : [])];
  if (await run('keepsnappy', open)) process.exit(1);
  // tokens.js is `output.keepsnappyTokens = {"<journey>": ["pl_rt_...", ...]};`, ES5 assignments only.
  const m = /output\.keepsnappyTokens = (\{.*\});/.exec(readFileSync(tokensFile, 'utf8'));
  tokens = JSON.parse(m[1])[a.journey];
  if (!tokens || tokens.length !== repeat) { console.error('farm open gave no tokens for the journey'); process.exit(1); }
}

const runs = [];
let code = 0;
try {
  for (let i = 1; i <= repeat; i++) {
    const id = String(i).padStart(3, '0') + '-A';
    const dir = join(out, id);
    mkdirSync(dir, { recursive: true });
    adb('logcat', '-c');
    sh(`am force-stop ${a.pkg}`);
    if (tokens) {
      // Activation takes effect from the next launch: send the link, then stop the process, so the test's own launch is the measured one.
      const link = `${route}?activate=1&ttl=3600&profile=1&diag=1&runToken=${tokens[i - 1]}`;
      sh(`am start -a android.intent.action.VIEW -d ${q(link)} ${a.pkg}`);
      await sleep(4000);
      sh(`am force-stop ${a.pkg}`);
    }
    const t0 = Date.now();
    const exit = await run('bash', [resolve(import.meta.dirname, 'run-e2e-no-ai.sh'), 'android']);
    const t1 = Date.now();
    let flushed = 'not-sent';
    if (tokens) {
      sh(`am start -a android.intent.action.VIEW -d ${q(`${route}?flush=1&activate=0&ack=${i}`)} ${a.pkg}`);
      const deadline = Date.now() + 340_000;
      flushed = 'not acknowledged';
      while (Date.now() < deadline) {
        const hit = /KEEPSNAPPY flushed (\w+)[^\n]*ack=(\S+)/.exec(adb('logcat', '-d', '-s', 'KEEPSNAPPY', 'ReactNativeJS', '*:S')) ?? /KEEPSNAPPY flushed (\w+)[^\n]*ack=(\S+)/.exec(adb('logcat', '-d'));
        if (hit && hit[2] === String(i)) { flushed = hit[1]; break; }
        await sleep(1000);
      }
    }
    const t2 = Date.now();
    // The SDK's own lines for this iteration (activation, push, flush), kept with the run and printed: the proof of what the app did.
    const sdkLines = adb('logcat', '-d').split('\n').filter((l) => /KEEPSNAPPY/i.test(l)).map((l) => l.replace(/runToken=\S+|pl_rt_\w+/g, 'runToken=<hidden>'));
    writeFileSync(join(dir, 'sdk-logcat.txt'), sdkLines.join('\n') + '\n');
    log(`${id} SDK lines: ${sdkLines.length}\n${sdkLines.slice(-25).join('\n')}`);
    const valid = exit === 0 && (!tokens || flushed === 'ok');
    const reason = exit !== 0 ? `test-failed: exit ${exit}` : tokens && flushed !== 'ok' ? `flush: ${flushed}` : '';
    runs.push({ run_id: id, arm: 'A', block: i - 1, t0, t1, exit_code: exit, valid, invalid_reason: reason, flushed, flush_ms: t2 - t1 });
    log(`${id} ${valid ? 'valid' : `INVALID (${reason})`} test ${((t1 - t0) / 1000).toFixed(1)} s, flush ${((t2 - t1) / 1000).toFixed(1)} s`);
    writeFileSync(join(dir, 'run.json'), JSON.stringify(runs.at(-1)) + '\n');
  }
} finally {
  writeFileSync(join(out, 'runs.ndjson'), runs.map((r) => JSON.stringify(r)).join('\n') + '\n');
  if (tokens) {
    code = await run('keepsnappy', ['farm', 'close', '--state', state, '--settle-seconds', '60', '--wait', '--out', out]);
    if (existsSync(tokensFile)) unlinkSync(tokensFile);
  }
}
if (!runs.some((r) => r.valid)) code ||= 1;
process.exit(code);
