# Independent 200-URL replication recipe

This directory contains the complete 200-URL manifest and a read-only collection recipe. It contains no study observations. The manuscript dataset is under `../combined-study/`.

The collector preserves all five browser attempts per URL, explicit failures, effective settings, environment, timestamps and executed source hashes. It refuses to overwrite an existing report and requires a recorded source commit. The wheel-command interval is not INP, perceived responsiveness or task completion.

From the repository root, with locked dependencies installed:

```sh
STUDY_SOURCE_COMMIT=<recorded-commit> STUDY_OUTPUT=<distinct-output-directory> npm run benchmark
```

The supplied Chrome path is for the recorded macOS environment. For another environment, record any protocol/source changes and commit them before collection. Preserve new observations as a separate replication; do not replace the supplied dataset or rerun selected URLs to improve outcomes.
