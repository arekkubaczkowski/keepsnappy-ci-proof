// Spread inside one session: reads <out>/runs.ndjson and <out>/metrics.csv (written by `keepsnappy run`)
// and prints, as markdown, the wall time of each run and the run-to-run spread per metric kind.
// Spread = coefficient of variation (stdev / mean) over the valid runs, and (max - min) / median.
// Usage: node session-stats.mjs <out dir> [label]
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const dir = process.argv[2];
const label = process.argv[3] ?? dir;
const runs = readFileSync(join(dir, 'runs.ndjson'), 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l));
const valid = runs.filter((r) => r.valid);
const lines = [`### ${label}`, '', `Runs: ${runs.length}, valid: ${valid.length}${runs.length - valid.length ? ` (invalid: ${runs.filter((r) => !r.valid).map((r) => `${r.run_id} ${r.invalid_reason}`).join('; ')})` : ''}`];
lines.push('', '| run | wall s | valid |', '|---|---|---|', ...runs.map((r) => `| ${r.run_id} | ${((r.t1 - r.t0) / 1000).toFixed(1)} | ${r.valid} |`));

const csv = readFileSync(join(dir, 'metrics.csv'), 'utf8').split('\n').slice(1).filter(Boolean);
const cells = (line) => {
  const out = [];
  let cur = '', q = false;
  for (const ch of line) {
    if (ch === '"') q = !q;
    else if (ch === ',' && !q) { out.push(cur); cur = ''; } else cur += ch;
  }
  out.push(cur);
  return out;
};
const validIds = new Set(valid.map((r) => r.run_id));
const byMetric = new Map();
for (const line of csv) {
  const [runId, , , metric, value] = cells(line);
  if (!validIds.has(runId) || value === '' || !Number.isFinite(Number(value))) continue;
  if (!byMetric.has(metric)) byMetric.set(metric, []);
  byMetric.get(metric).push(Number(value));
}
const mean = (xs) => xs.reduce((a, b) => a + b, 0) / xs.length;
const median = (xs) => { const v = [...xs].sort((a, b) => a - b); const m = v.length >> 1; return v.length % 2 ? v[m] : (v[m - 1] + v[m]) / 2; };
const quant = (xs, p) => { const v = [...xs].sort((a, b) => a - b); return v[Math.min(v.length - 1, Math.floor(p * v.length))]; };
const spread = [];
for (const [metric, xs] of byMetric) {
  if (xs.length < 2 || mean(xs) <= 0) continue;
  const sd = Math.sqrt(xs.reduce((a, x) => a + (x - mean(xs)) ** 2, 0) / (xs.length - 1));
  const med = median(xs);
  spread.push({ metric, kind: metric.split('.').pop(), n: xs.length, cv: sd / mean(xs), range: med > 0 ? (Math.max(...xs) - Math.min(...xs)) / med : NaN, med });
}
const kinds = new Map();
for (const s of spread) { if (!kinds.has(s.kind)) kinds.set(s.kind, []); kinds.get(s.kind).push(s); }
lines.push('', '| metric kind | metrics | median CV | p90 CV | share CV > 30 % | median range/median |', '|---|---|---|---|---|---|');
for (const [kind, xs] of [...kinds].sort((a, b) => b[1].length - a[1].length).slice(0, 14)) {
  const cvs = xs.map((x) => x.cv);
  const ranges = xs.map((x) => x.range).filter(Number.isFinite);
  lines.push(`| ${kind} | ${xs.length} | ${(100 * median(cvs)).toFixed(1)} % | ${(100 * quant(cvs, 0.9)).toFixed(1)} % | ${(100 * cvs.filter((c) => c > 0.3).length / cvs.length).toFixed(0)} % | ${ranges.length ? (100 * median(ranges)).toFixed(1) + ' %' : '-'} |`);
}
console.log(lines.join('\n'));
