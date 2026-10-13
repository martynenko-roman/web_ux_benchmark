# Measurement Coverage and Timing Semantics in Automated Web Quality Rankings

Research materials for **Measurement Coverage and Timing Semantics in Automated Web Quality Rankings**: a recorded 200-URL web study and a controlled experiment on timing endpoints.

The web dataset retains **200 distinct URLs and 1,000 browser attempts**, collected in two separately recorded batches. It contains 144 eligible URLs and 56 excluded URLs under the declared complete-evidence rule and documented content screen. The score represents stated technical preferences; it does not validate user satisfaction, accessibility conformance, or overall user experience.

## Materials

| Material | Location |
|---|---|
| Complete 200-URL manifest | [config/pages.json](config/pages.json) |
| Recorded data and per-attempt metadata | [checksum-verified recorded-data archive](research/combined-study/recorded-data/) |
| Exact batch report/run snapshots, executed sources and protocols | [research/combined-study/recorded-batches/](research/combined-study/recorded-batches/) |
| Eligibility and exclusion exports | [eligible-pages.csv](research/combined-study/eligible-pages.csv), [excluded-pages.csv](research/combined-study/excluded-pages.csv) |
| Rank statistics, sensitivity, conditional resampling and batch summaries | [reanalysis.json](research/combined-study/reanalysis.json) |
| Input hashes and independent checks | [data-hashes.json](research/combined-study/data-hashes.json), [validation.json](research/combined-study/validation.json) |
| Additional content-screen rule | [content-screening.json](research/combined-study/content-screening.json) |
| Controlled experiment, all 103 records and reconstruction | [research/controlled-validation/](research/controlled-validation/) |
| Separate 200-URL replication recipe | [research/replication-study/](research/replication-study/) |

## Recorded results

On the 144 eligible URLs, the equal-weight composite has Spearman correlation **0.718** with a loading-and-layout reference and **22.9%** reversal among comparable page pairs. These are descriptive comparisons on the same retained cohort. The composite includes its performance reference, so their association is partly structural.

| Batch | Attempted URLs | Eligible | Excluded | Within-batch Spearman |
|---|---:|---:|---:|---:|
| first | 100 | 66 | 34 | 0.746 |
| extension | 100 | 78 | 22 | 0.650 |

The separate controlled experiment contains 96 observations across eight conditions, six failure controls and one excluded warm-up. With a nominal 700-ms asynchronous result delay, median click-command duration is 41.3 ms while the page records 701.4 ms to update its result. No human participants were recruited.

## Provenance

Each batch's protocol, manifest and source were recorded before its collection. The extension was selected after first-batch results were available. Measurement definitions, time budgets, weights and resampling settings match across batches. Collection is sequential and read-only; failed URLs are retained without replacement or outcome-targeted reruns.

| Batch | Started UTC | Completed UTC | Executed source commit |
|---|---|---|---|
| first | 2026-10-12T19:09:14.981Z | 2026-10-12T20:13:13.204Z | `d4151c4d4cfc92a472c769296b4246f624e7a373` |
| extension | 2026-10-13T00:39:05.481Z | 2026-10-13T01:42:17.925Z | `3232efbde1c6e2e861e0d01b508cbd50e6953560` |

Executed file hashes, environment and effective audit settings accompany the raw records. The environment used Node.js 24.19.0, Playwright 1.57.0, Lighthouse 12.8.2, Chrome 155.0.8059.40, a 1920×1080 desktop viewport, and an Apple M2 Pro on Darwin 25.6.0. Both source snapshots are preserved; no generating revision is inferred from later files.

An additional content screen was recorded after the first batch and five extension URLs when PyPI returned an unrecognized `Client Challenge` page. It applies the same title rules to both batches. It recognizes 40 challenge/error attempts; original collector flags and observations remain unchanged. Final title review also excluded the five Patagonia routing-document runs after an initial pooled calculation. Original collector eligibility is 146 URLs; final analysis eligibility is 144. Title checks cannot detect every interstitial.

The first batch had one audit hard timeout that left its isolated browser running until the session ended. Background effects were not quantified and observations were not selectively rerun. The extension and replication recipe use verified timeout cleanup. See [operational-events.json](research/combined-study/operational-events.json). Different times, purposive selection and this cleanup change can confound between-batch differences.

## Reproduce the analysis

From a checkout of the repository:

```sh
python -m pip install -r research/combined-study/requirements-analysis.txt
python research/combined-study/reanalyze.py
python research/combined-study/check_analysis.py
python research/controlled-validation/analyze.py
```

Raw records and original batch reports are stored in lossless ZIP parts to support repository transfer. The analysis automatically restores them to their original paths and verifies every part, the complete archive and all 421 recorded-file hashes. It does not generate observations. NumPy 2.3.5 is pinned. The web analysis reconstructs the JSON, eligibility/exclusion CSVs and hash manifest from recorded observations; it does not collect websites or generate measurements. The independent checker verifies both protocols, executed source hashes, exact pooling, all 200 URLs/1000 attempts, raw audit values, pooled endpoints, correlations and tie-aware pair counts.

The 2,000 bootstrap replicates use seed 20261012 and resample whole eligible browser-run records within URL while holding the single Lighthouse audit fixed. The 1,000 raw-weight scenarios use seed 20261013. Intervals exclude repeated-audit, temporal, sampling, device and participant uncertainty. Original batch reports/runs can also be pooled again with `python scripts/combine-recorded-batches.py`.

## Collect a separate replication

```sh
npm ci --ignore-scripts
npm run benchmark -- --help
STUDY_SOURCE_COMMIT=<recorded-commit> STUDY_OUTPUT=<distinct-output-directory> npm run benchmark
```

The command uses the full 200-URL manifest, five fresh browser contexts per URL and one conditional audit. The recorded Chrome path is for macOS; record and commit any environment/protocol changes before collection. The collector requires a source commit and refuses to overwrite an existing report. A replication is a separate dataset; do not replace the supplied observations to obtain more favorable outcomes.

## Measurement definitions

| Endpoint | Definition and limit |
|---|---|
| LCP and CLS | One desktop Lighthouse load audit per measurable URL; not repeated load observations or full-session interaction CLS. |
| Wheel-command duration | Node monotonic time around each of two wheel calls. It is not INP, scroll completion, paint time or semantic task completion. |
| Accessibility score | Lighthouse category score, not WCAG conformance or assistive-technology task success. |
| Request success | Finished HTTP 200–399 requests without failure divided by all requests started through the fixed observation window. Pending requests remain in the denominator. |
| Eligibility | At least three valid browser runs and common finite load, command, audit and request observations, after the documented content screen. Unavailable endpoints stay null. |

The primary composite gives four categories weight 0.25 each. LCP, CLS and command duration use bounded inverse linear transforms with upper bounds 4,000 ms, 0.25 and 500 ms. The command bound is analyst-selected; alternative weights, category ablations and doubled bounds are reported. Tight incomplete-evidence bounds describe possible full scores without imputing missing values.

The sample is purposive and measures specified URLs under one recorded setup. Archetype labels describe intended entry points. Redirects can change the observed page form; final URLs are retained. Labels do not establish representative tasks or service-wide quality. No login, form submission, cookie acceptance, overlay removal or access-control bypass is performed.

## Software checks

```sh
npm run build
npm test -- src/__tests__
npm run test:study
npm audit
```

The TypeScript utilities under `src/` are additional implementation tools; the manuscript's collection uses the recorded research collectors and its analysis uses Python. Build/unit-test success does not validate user experience. The dependency audit of the recorded lock on 12 October 2026 reported 51 affected entries: 2 critical, 27 high and 22 moderate, including transitive dependencies. The current lock was updated after collection, and an unused lint dependency chain was removed. Its audit reports 0 critical, 9 high and 19 moderate affected entries. The updated TypeScript build, 22 source tests and four collection-semantic tests pass; remaining ratings are not represented as resolved. Software changes do not change the environment of already recorded observations.

## Citation and license

Cite the manuscript for scientific findings and the exact repository commit for the dataset and implementation used. Recorded source commits and raw collection timestamps distinguish execution provenance from later analysis files. No archive DOI is asserted.

Code is licensed under [Apache-2.0](LICENSE). Third-party pages and assets retain their own terms.
