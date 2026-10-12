# Web UX Benchmark

Source code and archived observations for studying automated web-quality measurements, missing-data policies, and ranking behavior.

This repository contains the **legacy benchmark implementation** and the March 2026 website archive. Its composite is a configurable technical score. The archive does not establish that the score measures user satisfaction, overall user experience, accessibility conformance, or successful task completion.

## Relationship to the manuscript

The revised manuscript, **Measurement Coverage and Timing Semantics in Automated Web Quality Rankings**, uses this repository as evidence for an implementation audit and a retrospective reanalysis.

The inspected source snapshot is [`c5ad219de2074ac51a84824b032e653b8b8c0a8d`](https://github.com/martynenko-roman/web_ux_benchmark/tree/c5ad219de2074ac51a84824b032e653b8b8c0a8d). The March 5 report identifies report schema 2 and tool version 2.0.0, but does not identify the generating Git commit. The inspected snapshot must therefore be distinguished from the unknown historical generating revision. The package and CLI still declare version 1.0.0; these version labels are not interchangeable.

The revised manuscript makes three uses of evidence:

| Evidence | Location | Interpretation |
|---|---|---|
| Historical collection and legacy analysis | `src/`, `scripts/`, `config/`, `public_data/` in this repository | Inspect the original implementation and reproduce the legacy summary. |
| Eligibility-based reanalysis, sensitivity results, conditional bootstrap, and incomplete-score bounds | Accompanying manuscript supplement: `reanalyze.py`, `reanalysis.json`, eligibility tables, metric dictionary, and input hashes | Recompute the revised paper's results from the fixed archive. These files are not currently in this repository. |
| New controlled browser experiment | Accompanying manuscript supplement: `controlled-validation/` | Examine the recorded protocol, fixture, collector, runtime metadata, and 103 logged observations. These files are not currently in this repository. |

Running `npm run analyze` reproduces the **legacy** analysis. It does not implement the revised paper's complete-evidence score, bounds, conditional bootstrap, or new experiment. The revised results require the accompanying supplement. No public release or archive DOI for that supplement is asserted here.

## Archived data

| File | Contents |
|---|---|
| [Main report](public_data/reports/report-2026-03-05T06-42-16-058Z.json) | 100 configured page entries, metrics, legacy scores, rankings, diagnostics, and coverage. |
| [Run records](public_data/reports/report-2026-03-05T06-42-16-058Z-runs.json) | Five retained Playwright runs for each of 99 pages. This is not five repeated Lighthouse audits. |
| [Legacy summary](public_data/summary/report-2026-03-05T06-42-16-058Z-analysis.json) | Ranking comparison, weight perturbations, and category ablation. |
| [Page manifest](config/pages.json) | URLs, IDs, archetype labels, and expected patterns for the 100-page benchmark. |
| [Benchmark configuration](config/benchmark.json) | Declared collection options and category weights. |

SHA-256 hashes of the archived report bytes:

```text
Main report  f2ce990e1df5d2e410a9f7404d6d9b6c97e5ca56cac4a52aba02cfdc39758fa2
Run records  834da1dcaf281aa560dee90d850eea7905c620a603b289316bed0c301fd0776f
```

The legacy summary reports Pearson correlation 0.309, Spearman correlation 0.382, Kendall tau-b 0.277, and 98 pages with a changed ordinal rank. The 98% figure counts pages that move at least one position; it is not a percentage of reversed page pairs or evidence that a composite ranking is closer to users' judgments. The archive's actual `inp` field is null for all 100 pages.

The revised paper analyzes 60 eligible pages and excludes 40 with recorded reasons. Its Spearman correlation of 0.545 and 27.7% reversal among comparable page pairs come from the separate supplement; they must not be substituted into the preserved legacy report.

## Reproduce the legacy summary without collecting websites

Use a recent supported Node.js installation compatible with the locked dependencies. Node.js **24.19.0** was used for the verification below. The lock includes Vite 7.3.1, which requires Node 20.19+ or 22.12+; very old Node versions are unsuitable.

```sh
git clone https://github.com/martynenko-roman/web_ux_benchmark.git
cd web_ux_benchmark
npm ci --ignore-scripts
npm run analyze -- public_data/reports/report-2026-03-05T06-42-16-058Z.json
```

The generated summary is:

```text
data/summary/report-2026-03-05T06-42-16-058Z-analysis.json
```

Compare that output with the archived summary in `public_data/summary/`. Pass the report path explicitly: the script's default search uses `data/reports/`, whereas the committed historical report is in `public_data/reports/`.

For an inspection of the exact source cited in the paper, use `git checkout c5ad219de2074ac51a84824b032e653b8b8c0a8d` after cloning. That immutable revision contains the earlier README; the present README corrects its descriptions without changing the historical code or data.

## What the legacy fields actually measure

Field names below are retained for schema compatibility. Their names sometimes imply stronger interpretations than their implementations support.

| Field or group | Executable meaning and limitation |
|---|---|
| `cvv.lcp`, `cvv.cls` | Lighthouse load-audit observations. Recorded CLS is not a reconstructed full-session interaction experiment. |
| `cvv.inpProxy` | Mean synthetic event-dispatch-to-animation-frame delay from Playwright. A requestAnimationFrame callback is not a verified paint timestamp. The proxy is not INP; its event set also includes scrolling. |
| `inputResponsiveness`, `interactionLatency` | The same pooled Playwright action-command duration stored under two names and normalized with different bounds. They are not independent response endpoints. |
| `layoutShiftDuringInteractions` | Sum of buffered layout-shift entries; the collector does not establish an interaction-only window or apply the full CLS session/input exclusions. |
| `frameDropRate` | Estimate from CDP frame counters with a task-duration/elapsed-time fallback. It does not sample RAF cadence and is not a validated dropped-frame percentage. |
| `wcagComplianceScore` | Overall Lighthouse accessibility category score, not WCAG conformance. |
| `keyboardNavigationScore`, `screenReaderCompatibility` | Overlapping subsets of automated Lighthouse audits; the keyboard value can fall back to the overall accessibility score. No participant or assistive-technology task test is performed. |
| `colorContrastRatio` | Lighthouse contrast-audit score scaled to 0–100, not a measured contrast ratio. |
| `errorRate` | Console-error messages divided by all console messages, not failed-task rate or all client-side exceptions. |
| `resourceLoadSuccessRate` | Successful recorded requests divided by all recorded requests. Requests are not classified by task importance. |
| `networkFailureRecovery` | Legacy calculation lacks recorded retry evidence; it is 100 for all 99 measured pages. It does not establish recovery from failures. |
| `serviceWorkerAvailable` | Browser API availability (`"serviceWorker" in navigator`), not active registration, offline behavior, or recovery. |

Definitions are implemented in [Lighthouse collection](src/collectors/lighthouse-runner.ts), [Playwright collection](src/collectors/playwright-runner.ts), [metric aggregation](src/core/metrics-collector.ts), and [normalization](src/core/normalizer.ts).

## Legacy scoring and missingness

Category scores average available normalized fields. When an entire category is unavailable, the composite redistributes its weight across categories with data.

Default category weights are 0.30 for `cvv`, 0.25 for `interactionStability`, 0.25 for `accessibility`, and 0.20 for `reliability`. The composite's coverage exponent defaults to 0.5 when `coveragePenaltyFactor` is omitted.

```text
rawComposite = sum(weight[c] * categoryScore[c]) / sum(weight[c])
               over available categories

z = coverage.overall.percentage / 100
coverageFactor = max(z, 0.01) ** gamma   when gamma > 0
                 1                    otherwise

composite = rawComposite * coverageFactor
```

The implementation returns zero when there are no available categories or their total weight is zero, and rounds the returned composite to two decimal places. See [composite-engine.ts](src/core/composite-engine.ts).

The coverage penalty applies to the composite, **not** to the legacy `cvv` reference. Missing LCP and CLS can therefore leave a favorable proxy-only reference score. Empty or failed Playwright runs can also produce a zero layout-shift value that is normalized as perfect, and a returned stage can be labeled successful despite failed interactions. Coverage and diagnostics must be inspected together; the penalty alone does not guarantee comparable measurements.

The revised supplement addresses these interpretation problems by requiring a common set of retained measurements and sufficient recorded actions before comparison. That retrospective correction does not repair this repository's live collector.

## Optional collection of new observations

Fresh collection is a separate experiment. The archive cannot guarantee that current websites will have the same content, timings, consent layers, or bot defenses.

Install Playwright's Chromium browser and a Chrome/Chromium installation discoverable by `chrome-launcher` for Lighthouse. For example:

```sh
npx playwright install chromium

# One configured page; omit CrUX
npm run benchmark -- --page wikipedia-web-performance --skip-crux --output data/new-observations

# A sample manifest; omit CrUX
npm run benchmark -- --pages-config config/pages_sample.json --skip-crux --output data/new-observations
```

Lighthouse uses `chrome-launcher`; installing Playwright Chromium alone does not establish that Lighthouse can locate a suitable browser. Confirm local browser discovery before collection.

The default Playwright workflow selects available visible inputs/buttons and scrolls. Archetype labels do not select representative tasks or verify semantic completion. Each configured Playwright run uses a fresh context; the legacy workflow does not record a discarded warm-up or a cold-versus-warm cache experiment. Lighthouse runs once per page. Although `config/benchmark.json` declares preset and throttling values, those two settings are not passed through by the Lighthouse runner.

CrUX is optional and uses `CRUX_API_KEY`. Its collector queries origin-level data and a legacy FID field; it does not collect current INP. Inspect and update that integration before relying on field CWV comparisons.

New research collection should record the generating commit, actual runtime/tool/browser versions, effective settings, observation windows, task completion predicates, failed endpoints, and exclusion reasons. Preserve the committed historical observations.

## Build, tests, and verification

```sh
npm run build
npm test -- src/__tests__
node dist/cli/index.js benchmark --help
npm audit
```

Passing `src/__tests__` avoids counting emitted `dist/__tests__` copies again after a build. The 22 source tests cover normalization, coverage aggregation, and composite calculation. They do not validate browser measurements or perceived UX.

Verification on **12 October 2026**, using the cited snapshot, its dependency lock, and Node.js 24.19.0:

| Check | Result |
|---|---|
| Dependency installation with `npm ci --ignore-scripts` | Passed. |
| `npm run build` | Passed. |
| `npm test -- src/__tests__` | 22 tests passed in three files. |
| Compiled benchmark command help | Passed. |
| Analysis of the committed March 5 report | All JSON fields matched the archived summary. |
| GitHub Actions and commit status checks at the audited snapshot | No workflow runs or reported status checks were present. |
| `npm audit` on the locked dependencies | 51 affected dependency entries: 2 critical, 27 high, and 22 moderate. These counts include transitive dependencies and are not counts of independently confirmed exploits. |

The critical-rated entries include `basic-ftp` and `vitest`; exposure depends on the affected feature and its use. Dependency updates need review and regression testing before this tool is treated as maintained for new collection. No dependency fix or live website collection was performed as part of this documentation verification.

## Repository layout

```text
config/             Page manifests and declared benchmark settings
src/cli/            Benchmark, report, and comparison commands
src/collectors/     Browser, Lighthouse, CrUX, and auxiliary collectors
src/core/           Aggregation, normalization, scoring, ranking, reporting
src/__tests__/      Source unit tests
scripts/            Legacy report-analysis script
public_data/        Committed historical reports and summary
data/               Generated local outputs
```

The `report` subcommand is a placeholder. The `compare` subcommand prints summaries of two reports; it does not run the revised manuscript's reanalysis.

## Citation and license

When citing the inspected implementation, identify the repository and full source revision `c5ad219de2074ac51a84824b032e653b8b8c0a8d`. Identify the March 5 report separately and do not claim that its generating revision or historical runtime is known.

Source code is licensed under [Apache-2.0](LICENSE). Third-party websites and assets referenced in the manifests remain subject to their own terms.
