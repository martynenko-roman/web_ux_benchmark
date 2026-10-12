# Measurement Coverage and Timing Semantics in Automated Web Quality Rankings

Research repository for the manuscript **Measurement Coverage and Timing Semantics in Automated Web Quality Rankings**.

The study examines how missing observations and different timing endpoints affect automated web-quality rankings. It combines an implementation audit, analysis of a fixed website archive, and a controlled browser experiment. The composite score represents declared technical preferences; the study does not claim to validate user satisfaction, accessibility conformance, or overall user experience.

## Study materials

| Material | Location | Purpose |
|---|---|---|
| Website observations and per-run records | [public_data/reports/](public_data/reports/) | Inspect the 100-page archive and recorded browser actions. |
| Report arithmetic | [scripts/analyze-report.ts](scripts/analyze-report.ts), [public_data/summary/](public_data/summary/) | Reproduce the archived report's summary statistics. |
| Page manifest and collection settings | [config/](config/) | Inspect URLs, archetype labels, and declared settings. |
| Collection, aggregation, and scoring implementation | [src/](src/) | Inspect the measurement and missing-data mechanisms investigated in the manuscript. |
| Eligibility-based analysis, sensitivity calculations, conditional bootstrap, and incomplete-score bounds | Accompanying manuscript supplement | Reproduce the manuscript's complete-evidence analysis. |
| Controlled timing experiment: protocol, fixture, collector, raw observations, and reconstruction | Accompanying manuscript supplement, `controlled-validation/` | Inspect the 103 recorded observations and reproduce the experiment's summaries. |

The manuscript supplement is a required part of the research materials. Its analysis and controlled-experiment files are not currently hosted in this repository. No archive DOI is asserted.

## Research design and findings

The website archive contains 100 specified URLs grouped into eight archetypes. Requiring LCP, load-audit CLS, an accessibility audit score, a pooled recorded action duration, a pooled request-success ratio, and sufficient recorded actions leaves 60 eligible pages and 40 excluded pages.

On the eligible cohort, the equal-weight illustrative composite has Spearman correlation 0.545 with the loading-and-layout reference and 27.7% reversal among comparable page pairs. These results describe the fixed archive and declared scoring choices; they do not determine which ranking agrees with users' judgments.

The controlled experiment records 96 observations across eight synchronous-processing, asynchronous-completion, and readiness conditions, six failure controls, and one excluded warm-up. For the asynchronous 700-ms condition, median click-command duration is 41.3 ms while the page records 701.4 ms to update its result. The experiment distinguishes command success, task completion, and unavailable endpoints. It is not a participant study.

The complete calculations, exclusions, raw experimental records, and interpretation limits are supplied with the manuscript.

## Data provenance

The website report is dated **5 March 2026**. Its individual-run artifact contains five retained Playwright runs for each of 99 pages; this is not five repeated Lighthouse audits.

The inspected implementation is pinned to [`c5ad219de2074ac51a84824b032e653b8b8c0a8d`](https://github.com/martynenko-roman/web_ux_benchmark/tree/c5ad219de2074ac51a84824b032e653b8b8c0a8d). The report does not identify its generating commit. Source inspection establishes behavior of the inspected implementation; it does not establish that every inspected source line generated the archived observations.

| File | SHA-256 |
|---|---|
| [Report](public_data/reports/report-2026-03-05T06-42-16-058Z.json) | `f2ce990e1df5d2e410a9f7404d6d9b6c97e5ca56cac4a52aba02cfdc39758fa2` |
| [Run records](public_data/reports/report-2026-03-05T06-42-16-058Z-runs.json) | `834da1dcaf281aa560dee90d850eea7905c620a603b289316bed0c301fd0776f` |

The controlled experiment was recorded on **11 October 2026 in America/New_York, 12 October UTC**. Its protocol was saved before collection. The supplied raw record contains source hashes, runtime metadata, timestamps, and all observations and exceptions.

## Reproduce the archive arithmetic

The following commands require Node.js compatible with the dependency lock. Verification used **Node.js 24.19.0**.

```sh
git clone https://github.com/martynenko-roman/web_ux_benchmark.git
cd web_ux_benchmark
npm ci --ignore-scripts
npm run analyze -- public_data/reports/report-2026-03-05T06-42-16-058Z.json
```

Output:

```text
data/summary/report-2026-03-05T06-42-16-058Z-analysis.json
```

Compare the output with the committed [summary](public_data/summary/report-2026-03-05T06-42-16-058Z-analysis.json). The explicit input path is necessary because the script's default search uses `data/reports/`.

The archive arithmetic gives Pearson correlation 0.309, Spearman correlation 0.382, Kendall tau-b 0.277, and 98 pages whose ordinal position changes. The 98% value counts moved pages, not reversed page pairs. These calculations are part of the artifact audit and differ from the manuscript's complete-evidence analysis.

## Reproduce the manuscript analyses

Extract the accompanying supplement and run its Python analyses. The retrospective analysis requires Python 3 and NumPy; the supplied environment records **NumPy 2.3.5**.

From the supplement directory:

```sh
python reanalyze.py
```

This reconstructs `reanalysis.json`, `eligible-pages.csv`, `excluded-pages.csv`, and `data-hashes.json`. The conditional run bootstrap uses 2000 replicates with seed 20261011; the 1000 raw-weight scenarios use seed 20261012.

To reconstruct the controlled experiment's summary and CSV from its recorded observations:

```sh
cd controlled-validation
python analyze.py
```

Neither command collects websites or generates experimental observations. The Python analysis is separate from the repository's TypeScript report-summary command.

The experimental collector can also execute a replication with a separately named output file. Follow the supplement's environment and browser instructions; different machines or browser versions can produce different timing observations.

## Measurement definitions and interpretation

Schema names are retained in the data. Use the executable definitions when interpreting them.

| Field or group | Meaning and limitation |
|---|---|
| `cvv.lcp`, `cvv.cls` | Lighthouse load-audit observations; recorded CLS is not a reconstructed full-session interaction measurement. |
| `cvv.inpProxy` | Mean synthetic event-dispatch-to-animation-frame delay. It is not INP or a verified paint timestamp, and its event set includes scrolling. Actual `inp` is absent for all 100 archived pages. |
| `inputResponsiveness`, `interactionLatency` | The same pooled Playwright action-command duration recorded twice and normalized with different bounds. |
| `layoutShiftDuringInteractions` | Sum of buffered entries without an established interaction-only window or full CLS exclusions. |
| `frameDropRate` | CDP frame-counter estimate with a task-duration/elapsed-time fallback; it is not RAF-cadence sampling or a validated dropped-frame percentage. |
| Accessibility fields | Overall Lighthouse category score and overlapping audit subsets. They do not establish WCAG conformance, keyboard task success, or screen-reader usability. |
| `colorContrastRatio` | Scaled contrast-audit score, not a measured contrast ratio. |
| `errorRate` | Console-error messages divided by all console messages. |
| `resourceLoadSuccessRate` | Successful recorded requests divided by all recorded requests; task importance is not classified. |
| `networkFailureRecovery` | Lacks recorded retry evidence and is constant at 100 for the 99 measured pages. |
| `serviceWorkerAvailable` | Browser API availability, not page registration, offline behavior, or recovery. |

See [Lighthouse collection](src/collectors/lighthouse-runner.ts), [Playwright collection](src/collectors/playwright-runner.ts), [aggregation](src/core/metrics-collector.ts), and [normalization](src/core/normalizer.ts).

Missing observations require explicit treatment. The TypeScript composite averages available fields, redistributes unavailable-category weights, and applies a coverage factor:

```text
rawComposite = sum(weight[c] * categoryScore[c]) / sum(weight[c])
               over available categories

z = coverage.overall.percentage / 100
coverageFactor = max(z, 0.01) ** gamma   when gamma > 0
                 1                    otherwise

composite = rawComposite * coverageFactor
```

The default category weights are 0.30, 0.25, 0.25, and 0.20; the coverage exponent defaults to 0.5. This penalty does not apply to the `cvv` reference and does not guarantee comparable measurements. Empty or failed runs can also create favorable zero-valued observations. These mechanisms are investigated in the manuscript. The complete-evidence Python analysis instead requires common retained measurements and explicitly records exclusions.

## Scope and reproducibility limits

The archive is a purposive benchmark of specified URLs, not a probability sample of websites or users. Historical runtime and collection metadata are incomplete. Recorded action duration does not establish semantic task completion.

The collection implementation runs Lighthouse once per page and uses fresh Playwright contexts. It does not record a discarded warm-up or a cold-versus-warm cache experiment for the website archive. Declared Lighthouse preset and throttling settings are not passed through by the runner. CrUX collection uses origin-level data and a FID field; it does not collect current INP.

The conditional bootstrap holds Lighthouse observations fixed and resamples recorded action/request runs. It does not account for website sampling, repeated load audits, user differences, or device diversity. The controlled experiment characterizes timing endpoints in one fixture environment; it does not estimate the prevalence of those mechanisms across websites.

Repeating the archive calculations and collecting present-day website behavior are different research tasks.

## Software verification

```sh
npm run build
npm test -- src/__tests__
node dist/cli/index.js benchmark --help
npm audit
```

Passing `src/__tests__` avoids counting compiled test copies in `dist/__tests__` after a build.

Checks on **12 October 2026**, using the pinned implementation and lock file:

| Check | Result |
|---|---|
| Locked dependency installation | Passed with `npm ci --ignore-scripts`. |
| TypeScript build | Passed. |
| Source tests | 22 tests passed across three files. |
| Compiled benchmark command help | Passed. |
| Archive arithmetic | Every generated JSON field matched the committed summary. |
| Dependency audit | 51 affected entries: 2 critical, 27 high, 22 moderate. Counts include transitive dependencies and do not establish exploit reachability. |

The critical-rated dependency entries include `basic-ftp` and `vitest`. Review and test dependency updates before new collection. GitHub Actions/status checks were not configured at the inspected snapshot. Build and unit-test success do not validate browser measurements or perceived UX.

## Citation and license

Cite the manuscript for the study's findings. For implementation provenance, cite this repository with the full inspected source commit; identify the March 5 report separately. Do not attribute an unrecorded generating revision or historical runtime to the archive.

Code is licensed under [Apache-2.0](LICENSE). Third-party sites and assets referenced in the manifests retain their own terms.
