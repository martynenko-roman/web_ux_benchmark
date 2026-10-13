# First recorded 100-URL batch

This directory preserves the first batch manifest, protocol and collection source. All 100 URLs and 500 browser attempts are included in the pooled dataset under ../combined-study/. The exact generating commit and executed source hashes are retained there.

The batch uses five fresh read-only browser contexts per URL and one conditional audit. Only wheel commands are issued; command duration is not INP or task completion. Unavailable measurements remain null.

The recorded worker had a timeout-cleanup limitation documented in the pooled operational events. Use ../replication-study/ for a separate collection with the current cleanup implementation and full 200-URL manifest. The recorded source remains available for inspection; later corrections do not change its provenance.
