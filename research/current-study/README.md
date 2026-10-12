# Prospective web quality study

This directory contains the recorded protocol and collection code for **Measurement Coverage and Timing Semantics in Automated Web Quality Rankings**.

The protocol covers the fixed 100-URL manifest. It prescribes five isolated, read-only browser runs per URL and one Lighthouse audit when at least one browser run returns eligible content. The collector records every attempt, failure, HTTP/access challenge, effective audit setting, source hash, timestamp, and runtime version.

The only actions are two wheel commands. The measured command duration is not INP, paint time, perceived responsiveness, or semantic task completion. No arbitrary form or button action is performed. Invalid or unavailable measurements remain null.

From the repository root, install the locked dependencies with `npm ci --ignore-scripts`, then run:

```sh
node --test research/current-study/measurements.test.mjs
node research/current-study/collect.mjs
```

The protocol records the Chrome executable path used for the collection. A replication on another system must record its own executable and environment. To preserve a distinct replication, set `STUDY_OUTPUT` to an unused directory. The collector refuses to overwrite an existing report. `STUDY_SOURCE_COMMIT` records the commit containing the collection code.

The protocol is saved before collection. Outcome-dependent replacement attempts or alternative URLs are not part of the study. Successful completion means all configured URLs were attempted; it does not mean that all were measurable or eligible.
