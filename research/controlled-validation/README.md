# Controlled browser timing experiment

This directory contains actual measurements collected on 11 October 2026 in America/New_York (12 October UTC). It complements the separately recorded two-batch 200-URL web study, which has its own protocol and runtime metadata. There are 96 experimental observations, six failure controls and one excluded warm-up, for 103 raw records. No participant study was performed.

`protocol.json` was written before collection. It defines eight conditions, twelve shuffled blocks, three observations per failure condition, a fixed seed, endpoint definitions, timeouts and a stopping rule. `fixture.html` implements synchronous processing, asynchronous completion, delayed actionability, absent controls and absent feedback. `collect.mjs` executes trusted browser clicks and preserves command, page-response and completion endpoints independently. Failed endpoints are null; failure elapsed time is diagnostic only.

`observations.json` is the immutable recorded session, including exceptions, source hashes, timestamps and runtime metadata. `observations.csv` is a convenient export of selected columns; use JSON for all metadata and error details. `summary.json` contains all measured medians and empirical ranges. `analyze.py` recreates the summary and CSV from the raw record and checks its stopping rule and source hashes. It does not run a browser or manufacture measurements.

## Reproduce recorded calculations

```sh
python analyze.py
python ../../qa/check_browser_records.py
```

The second command independently verifies the raw endpoints, fixed-seed block order, every reported median/range, failure semantics and CSV consistency. Its output is written to the package's QA directory.

## Repeat the experiment

Requires Node.js and Playwright. The recorded session used Node.js 24.19.0, Playwright 1.62.1 and Chrome 155.0.8059.40. Install Playwright in this directory or set `BENCHMARK_NODE_MODULES` to a directory containing the Playwright package. Use `BENCHMARK_CHROME` for an installed compatible Chromium-family executable, or let Playwright use its managed Chromium. A different browser or machine is a replication condition and must be documented.

```sh
BENCHMARK_OUTPUT=replication-observations.json node collect.mjs
```

This command writes a **new** raw record and preserves the reported observations. It launches an isolated headless browser, serves fixtures only on localhost, creates a fresh context per observation and closes the browser/server at completion. Timing results can change with machine load and browser version. Do not expect exact timing reproduction or replace the supplied session with a favorable rerun. `analyze.py` uses the supplied observations by default; analyze replications separately and preserve their source/protocol provenance.

`figure.py` draws the fifth manuscript figure from measured summaries, using ReportLab, pdf2image/Poppler and a configurable local font path. The graph shows medians and full observed ranges, not confidence intervals. Host click-command and page handler-to-result durations delimit different intervals. A result element being updated or detected is not proof of the actual paint time or of perceived usability. Event Timing entries are recorded as raw diagnostics and are not labeled as INP.
