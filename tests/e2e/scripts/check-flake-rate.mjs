import fs from "node:fs";
import path from "node:path";

const resultsPathArg = process.argv[2] ?? "test-results/playwright-results.json";
const resultsPath = path.resolve(process.cwd(), resultsPathArg);
const thresholdPercent = Number.parseFloat(process.env.PLAYWRIGHT_FLAKE_THRESHOLD_PERCENT ?? "2");
const summaryPath = path.resolve(process.cwd(), "test-results/flake-summary.json");

if (!Number.isFinite(thresholdPercent) || thresholdPercent < 0) {
  console.error("PLAYWRIGHT_FLAKE_THRESHOLD_PERCENT must be a non-negative number.");
  process.exit(1);
}

if (!fs.existsSync(resultsPath)) {
  console.error(`Playwright results file not found at: ${resultsPath}`);
  process.exit(1);
}

const raw = fs.readFileSync(resultsPath, "utf8");
const parsed = JSON.parse(raw);

const fromStats = readStats(parsed);
const totals = fromStats.total > 0 ? fromStats : readFromSuites(parsed);
const flakeRatePercent = totals.total === 0 ? 0 : (totals.flaky / totals.total) * 100;

const summary = {
  generatedAt: new Date().toISOString(),
  thresholdPercent,
  totalTests: totals.total,
  flakyTests: totals.flaky,
  unexpectedTests: totals.unexpected,
  flakeRatePercent: Number(flakeRatePercent.toFixed(2)),
  status: flakeRatePercent <= thresholdPercent ? "pass" : "fail"
};

fs.mkdirSync(path.dirname(summaryPath), { recursive: true });
fs.writeFileSync(summaryPath, JSON.stringify(summary, null, 2));

console.log(
  `Flaky tests: ${summary.flakyTests}/${summary.totalTests} (${summary.flakeRatePercent}%), threshold: ${summary.thresholdPercent}%`
);
console.log(`Flake summary written to ${summaryPath}`);

if (flakeRatePercent > thresholdPercent) {
  console.error("Flaky rate threshold exceeded.");
  process.exit(1);
}

function readStats(report) {
  const stats = report?.stats ?? {};
  const expected = asCount(stats.expected);
  const unexpected = asCount(stats.unexpected);
  const flaky = asCount(stats.flaky);
  return {
    total: expected + unexpected + flaky,
    flaky,
    unexpected
  };
}

function readFromSuites(report) {
  let total = 0;
  let flaky = 0;
  let unexpected = 0;

  const stack = Array.isArray(report?.suites) ? [...report.suites] : [];
  while (stack.length > 0) {
    const suite = stack.pop();
    if (!suite) {
      continue;
    }

    if (Array.isArray(suite.suites)) {
      stack.push(...suite.suites);
    }

    if (!Array.isArray(suite.tests)) {
      continue;
    }

    for (const test of suite.tests) {
      total += 1;
      if (isFlaky(test)) {
        flaky += 1;
      }
      if (isUnexpected(test)) {
        unexpected += 1;
      }
    }
  }

  return { total, flaky, unexpected };
}

function isFlaky(test) {
  if (test?.outcome === "flaky" || test?.status === "flaky") {
    return true;
  }

  const results = Array.isArray(test?.results) ? test.results : [];
  if (results.length < 2) {
    return false;
  }

  const hasPass = results.some((result) => result?.status === "passed");
  const hasFailure = results.some((result) => {
    const status = result?.status;
    return status === "failed" || status === "timedOut" || status === "interrupted";
  });

  return hasPass && hasFailure;
}

function isUnexpected(test) {
  const status = test?.status;
  return status === "unexpected" || status === "failed" || status === "timedOut" || status === "interrupted";
}

function asCount(value) {
  const parsedValue = Number(value);
  return Number.isFinite(parsedValue) && parsedValue > 0 ? parsedValue : 0;
}
