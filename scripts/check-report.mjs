// The "no AI steps" rule from plan 88, applied to e2e's report.json (schemaVersion report-1):
// the run is refused (exit 1, a named reason) when the report is missing, has another schema version,
// holds an agent step or a model event, or a test needed more than one attempt (a retry).
// Usage: node check-report.mjs <path to report.json>
import { readFileSync } from 'node:fs';

const path = process.argv[2];
const refuse = (reason) => {
  console.error(`keepsnappy-proof: run refused: ${reason}`);
  process.exit(1);
};

let report;
try {
  report = JSON.parse(readFileSync(path, 'utf8'));
} catch (e) {
  refuse(`no readable report at ${path} (${e.code ?? e.message})`);
}
if (report.schemaVersion !== 'report-1') refuse(`unknown report schema ${JSON.stringify(report.schemaVersion)}`);

const results = report.run?.results;
if (!Array.isArray(results) || results.length === 0) refuse('the report has no test results');

for (const result of results) {
  const title = (result.titlePath ?? []).join(' > ');
  const attempts = result.attempts ?? [];
  if (attempts.length > 1) refuse(`test "${title}" ran ${attempts.length} attempts (a retry)`);
  for (const attempt of attempts) {
    for (const step of attempt.steps ?? []) {
      if (step.kind === 'agent') refuse(`AI step in "${title}": ${step.api} ${JSON.stringify(step.label)}`);
      for (const event of step.events ?? []) {
        if (event.kind === 'model') refuse(`model call in "${title}" (step ${step.api})`);
      }
    }
  }
}
console.log(`keepsnappy-proof: report ok: ${results.length} tests, no AI step, no retry`);
