# Web UX Benchmark

Benchmarking Web UX Beyond Core Web Vitals

A comprehensive benchmarking system that evaluates web UX using a composite framework extending beyond Core Web Vitals (CWV). The system connects lab metrics to real user impact, enabling controlled experiments on representative pages/patterns to demonstrate rank flips between "CWV winners" and "UX winners."

## Features

- **Core Web Vitals**: LCP, CLS, and INP proxy measurement
- **Interaction Stability**: Layout shifts during interactions, input responsiveness, frame drop rate, interaction latency
- **Accessibility**: WCAG compliance, keyboard navigation, screen reader compatibility, color contrast
- **Reliability**: Error rates, network failure recovery, resource load success
- **Composite Scoring**: Unified UX score with coverage-aware weighting
- **Ranking Comparison**: Identify rank flips between CWV-only and composite rankings
- **Coverage Tracking**: Per-page and global metric coverage diagnostics
- **Per-Run Data**: Stored separately for confidence interval computation

## Report Versions

| Version | Description |
|---------|-------------|
| **v1** | Original schema. `animationSmoothness` (always null), no coverage tracking, no diagnostics, missing data → 0 score. |
| **v2** (current) | `frameDropRate` replaces `animationSmoothness`. `inpProxy` replaces always-null INP. Coverage penalty, diagnostics, per-run artifact. Weight redistribution for missing categories. |

### What Changed in v2

- **`animationSmoothness`** → **`frameDropRate`**: RAF-cadence based measurement (0–100%, lower is better) that actually works, replacing the always-null FPS lookup.
- **`inp`** → **`inpProxy`**: Playwright-based event-to-paint delay proxy metric, replacing the always-null Lighthouse INP.
- **`keyboardNavigationScore`**: Fixed Lighthouse audit IDs to use real audit names. Falls back to overall accessibility score.
- **Error rate**: Now properly computed as `consoleErrors / totalConsoleMessages` instead of `errors / errors`.
- **Layout shift**: `0` is preserved as a valid value (good score) instead of being set to `null`.
- **Scoring**: Categories with no data get their weight redistributed (not scored as 0). A configurable coverage penalty prevents incomplete pages from scoring artificially high.
- **Coverage**: Per-page and global coverage summaries included in report.
- **Diagnostics**: Per-page stage statuses (success/failure + reason) for lighthouse, playwright, crux.
- **Per-run data**: Companion `*-runs.json` artifact stores per-run values for CI computation.
- **Cookie/modal dismissal**: Generic handler for common consent banners before interactions.

## How the System Works

### Architecture Overview

1. **Data Collection** → 2. **Metrics Normalization** → 3. **Composite Scoring** → 4. **Ranking Comparison** → 5. **Report Generation**

### Stage 1: Data Collection

#### Lighthouse Integration
- Captures Core Web Vitals (LCP, CLS) and accessibility metrics
- Extracts keyboard navigation, screen reader, and color contrast scores from specific audits

#### Playwright Integration
- Navigates to each page and performs automated interactions
- **Cookie/modal dismissal**: Tries common cookie banner selectors before interactions
- **INP Proxy**: Measures event dispatch → next paint delay via `requestAnimationFrame`
- **Frame Drop Rate**: Samples RAF cadence during interactions, reports dropped frame percentage
- **Per-run storage**: Each run's metrics are preserved for statistical analysis
- **Interaction failure tracking**: Records explicit reasons when interactions fail

#### CrUX Integration (Optional)
- Fetches real user data from Google's Chrome User Experience Report API
- Requires `CRUX_API_KEY` environment variable

### Stage 2: Metrics Normalization

Metrics are normalized to 0–100 scores. The normalizer uses **available-metric mean**: if a category has 2 out of 4 metrics, it averages only the 2 that exist instead of penalizing with zeros.

### Stage 3: Composite Scoring

```
rawComposite = weighted average of available categories (weight redistribution)
coverageFactor = (coveragePercentage) ^ coveragePenaltyFactor
composite = rawComposite × coverageFactor
```

**Default weights** (configurable in `config/benchmark.json`):
- CWV: 30%
- Interaction Stability: 25%
- Accessibility: 25%
- Reliability: 20%

**Coverage penalty** (`coveragePenaltyFactor`, default 0.5):
- `0` = no penalty
- `0.5` = moderate (square root)
- `1.0` = linear

When a category has zero available metrics, its weight is redistributed proportionally among categories that have data.

### Stage 4: Ranking Comparison

Creates CWV-only and composite rankings, identifies rank flips, and computes correlation.

### Stage 5: Report Generation

Outputs:
- Main report JSON (`report-<timestamp>.json`)
- Per-run artifact (`report-<timestamp>-runs.json`)
- Console summary with coverage statistics

## Installation

```bash
npm install
npx playwright install chromium
```

## Configuration

### Benchmark Configuration (`config/benchmark.json`)

```json
{
  "lighthouse": {
    "preset": "desktop",
    "categories": ["performance", "accessibility"],
    "throttling": "default"
  },
  "playwright": {
    "headless": true,
    "runs": 5,
    "timeout": 30000,
    "viewport": { "width": 1920, "height": 1080 }
  },
  "compositeWeights": {
    "cvv": 0.30,
    "interactionStability": 0.25,
    "accessibility": 0.25,
    "reliability": 0.20
  },
  "coveragePenaltyFactor": 0.5
}
```

## Environment Variables

- `CRUX_API_KEY`: Chrome UX Report API key (optional)

## Usage

```bash
# Benchmark all configured pages
npm run benchmark

# Benchmark specific page
npm run benchmark -- --page wikipedia-web-performance

# Skip CrUX collection (most common, no API key needed)
npm run benchmark -- --skip-crux

# Compare two reports
npm run compare -- --baseline data/reports/report-v1.json --current data/reports/report-v2.json

# Run tests
npm test
```

## Report Schema (v2)

### Top-Level Structure

```json
{
  "metadata": {
    "timestamp": "2026-03-04T...",
    "reportVersion": 2,
    "toolVersion": "2.0.0",
    "pages": ["page-1", "page-2"],
    "config": {
      "compositeWeights": { "cvv": 0.3, "interactionStability": 0.25, "accessibility": 0.25, "reliability": 0.2 },
      "coveragePenaltyFactor": 0.5,
      "playwrightRuns": 5
    }
  },
  "pages": [ /* PageBenchmark[] */ ],
  "rankings": {
    "cvv": [ /* Ranking[] */ ],
    "composite": [ /* Ranking[] */ ],
    "rankFlips": [ /* RankFlip[] */ ]
  },
  "statistics": {
    "correlation": 0.85,
    "rankFlipCount": 12,
    "rankFlipPercentage": 15.0
  },
  "coverageSummary": {
    "totalPages": 80,
    "pagesWithInteractionMetrics": 72,
    "pagesWithReliabilityMetrics": 78,
    "metricPopulation": {
      "cvv.lcp": { "populated": 80, "total": 80, "percentage": 100 },
      "cvv.inpProxy": { "populated": 65, "total": 80, "percentage": 81.25 },
      "interactionStability.frameDropRate": { "populated": 78, "total": 80, "percentage": 97.5 }
    },
    "averageCoveragePercentage": 82.5
  },
  "runsArtifactPath": "data/reports/report-...-runs.json"
}
```

### Page Object

```json
{
  "pageId": "wikipedia-web-performance",
  "url": "https://en.wikipedia.org/wiki/Web_performance",
  "metrics": {
    "cvv": {
      "lcp": 1234.5,
      "fid": null,
      "inp": null,
      "cls": 0.02,
      "inpProxy": 45.3
    },
    "interactionStability": {
      "layoutShiftDuringInteractions": 0.01,
      "inputResponsiveness": 120,
      "frameDropRate": 5.2,
      "interactionLatency": 120
    },
    "accessibility": {
      "wcagComplianceScore": 92,
      "keyboardNavigationScore": 88,
      "screenReaderCompatibility": 95,
      "colorContrastRatio": 100
    },
    "reliability": {
      "errorRate": 1.5,
      "networkFailureRecovery": 100,
      "resourceLoadSuccessRate": 98.5,
      "serviceWorkerAvailable": false
    }
  },
  "scores": {
    "cvv": 85.2,
    "interactionStability": 78.5,
    "accessibility": 93.75,
    "reliability": 74.25,
    "composite": 77.8,
    "rawComposite": 83.1,
    "coverageFactor": 0.94
  },
  "diagnostics": {
    "stages": [
      { "stage": "lighthouse", "success": true, "durationMs": 15000 },
      { "stage": "playwright", "success": true, "durationMs": 45000 },
      { "stage": "crux", "success": false, "failureReason": "No CrUX data available", "durationMs": 200 }
    ],
    "coverage": { "..." : "same as coverage below" }
  },
  "coverage": {
    "overall": { "available": 14, "expected": 15, "percentage": 93.3, "missing": ["reliability.serviceWorkerAvailable"] },
    "cvv": { "available": 3, "expected": 3, "percentage": 100, "missing": [] },
    "interactionStability": { "available": 4, "expected": 4, "percentage": 100, "missing": [] },
    "accessibility": { "available": 4, "expected": 4, "percentage": 100, "missing": [] },
    "reliability": { "available": 3, "expected": 4, "percentage": 75, "missing": ["reliability.serviceWorkerAvailable"] }
  }
}
```

## How Missing Data Is Handled

| Situation | v1 Behavior | v2 Behavior |
|-----------|-------------|-------------|
| All metrics null in a category | Score = 0, dragging composite down | Weight redistributed to other categories |
| Some metrics null in a category | Mean of available + zeros | Mean of available only (no zeros) |
| INP not measurable | `null` everywhere | `inpProxy` from Playwright (event→paint delay) |
| Animation smoothness | `null` everywhere (no FPS in CDP) | `frameDropRate` from RAF cadence sampling |
| Keyboard navigation | `null` (wrong Lighthouse audit IDs) | Fixed audit IDs + fallback to a11y category score |
| Error rate | Binary 0%/100% (errors÷errors) | Proper ratio (errors÷totalMessages) |
| Layout shift = 0 | Treated as null (missing) | Preserved as 0 (good score) |
| Low coverage overall | Not visible | Coverage penalty reduces composite; coverage % shown |

## How to Verify Improvements

After running a benchmark:

```bash
npm run benchmark -- --skip-crux
```

Check the generated report for:

1. **`inpProxy` populated**: `jq '.pages[] | .metrics.cvv.inpProxy' report.json` — most pages should have a number, not null.
2. **`frameDropRate` populated**: `jq '.pages[] | .metrics.interactionStability.frameDropRate' report.json` — should have numbers.
3. **No zero-scored categories from missing data**: `jq '.pages[] | select(.scores.interactionStability == 0) | .pageId' report.json` — if any, check `coverage.interactionStability.available == 0` to confirm it's genuinely no data (weight gets redistributed).
4. **Coverage summary**: `jq '.coverageSummary' report.json` — shows per-metric population percentages.
5. **Diagnostics**: `jq '.pages[0].diagnostics' report.json` — shows stage success/failure with reasons.
6. **Per-run data**: Check companion `*-runs.json` file exists with per-run arrays.

## Running Tests

```bash
npm test
```

Tests cover:
- Normalizer: available-metric mean, insufficient data marking, metric priority (inpProxy > inp > fid)
- Composite engine: weight redistribution, coverage penalty, edge cases
- Metrics collector: coverage computation, missing field identification

## License

Apache-2.0
