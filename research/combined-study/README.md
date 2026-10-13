# Two-batch 200-URL analysis

This directory contains the pooled analysis workflow for two separately recorded batches of 100 URLs each. The extension was selected after first-batch results. The additional content screen is documented in content-screening.json; it corrects recognized challenge-page observations without changing raw records.

Collection must finish in both batches before pooling or final analysis. From the repository root:

```sh
python scripts/combine-recorded-batches.py
python -m pip install -r research/combined-study/requirements-analysis.txt
python research/combined-study/reanalyze.py
python research/combined-study/check_analysis.py
```

Pooling retains exact original batch report/run snapshots, executed source hashes, batch labels, per-attempt times, unavailable measurements and raw browser/audit files. The analysis computes primary and sensitivity rank statistics, within-page conditional resampling, category distributions, and separate batch summaries. It cannot establish user-experience validity or population representativeness.

The raw recorded files are distributed as checksum-verified ZIP parts under recorded-data/. reanalyze.py restores them automatically when data/report.json is absent. To restore without analysis, run python research/combined-study/restore_data.py from the repository root. The 421 restored files preserve original bytes and all collection/source timestamps and hashes.
