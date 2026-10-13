# Recorded 100-URL extension

This batch extends the completed 100-URL study with 100 distinct URLs, for a total of 200. The manifest and protocol are recorded before extension collection. The extension was requested after first-batch results were available.

Each URL receives five isolated, read-only browser attempts and one conditional Lighthouse audit. Failed, blocked and unavailable measurements are retained. Page types are purposive labels; the protocol does not test human task success.

Run with the locked root dependencies and the Chrome executable recorded in `protocol.json`:

```sh
STUDY_SOURCE_COMMIT=<recorded-source-commit> node research/extension-study/collect.mjs
```

The collector refuses to overwrite an existing output report. The executed source hashes, environment, start and completion times are recorded with results. The worker includes verified timeout cleanup; measurement definitions match the first batch.
