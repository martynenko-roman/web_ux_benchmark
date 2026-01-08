# Web UX Benchmark

Benchmarking Web UX Beyond Core Web Vitals

A comprehensive benchmarking system that evaluates web UX using a composite framework extending beyond Core Web Vitals (CWV). The system connects lab metrics to real user impact, enabling controlled experiments on representative pages/patterns to demonstrate rank flips between "CWV winners" and "UX winners."

## Features

- **Core Web Vitals**: LCP, FID/INP, CLS measurement
- **Interaction Stability**: Layout shifts during interactions, input responsiveness, animation smoothness
- **Accessibility**: WCAG compliance, keyboard navigation, screen reader compatibility
- **Reliability**: Error rates, network failure recovery, resource load success
- **Composite Scoring**: Unified UX score combining all metrics
- **Ranking Comparison**: Identify rank flips between CWV-only and composite rankings

## How the System Works

### Architecture Overview

The benchmarking system follows a multi-stage pipeline:

1. **Data Collection** → 2. **Metrics Normalization** → 3. **Composite Scoring** → 4. **Ranking Comparison** → 5. **Report Generation**

### Stage 1: Data Collection

The system collects metrics from multiple sources:

#### Lighthouse Integration
- **Purpose**: Captures Core Web Vitals (LCP, FID/INP, CLS) and accessibility metrics
- **How it works**: 
  - Launches Chrome browser programmatically
  - Runs Lighthouse audits on each configured page
  - Extracts performance, accessibility, and CWV metrics
  - Stores raw Lighthouse results for reference
- **Metrics collected**:
  - LCP (Largest Contentful Paint): Time to render main content
  - FID (First Input Delay): Deprecated, replaced by INP
  - INP (Interaction to Next Paint): Responsiveness of user interactions
  - CLS (Cumulative Layout Shift): Visual stability score
  - Accessibility scores: WCAG compliance, ARIA implementation, keyboard navigation

#### Playwright Integration
- **Purpose**: Captures interaction stability and reliability metrics
- **How it works**:
  - Launches Chromium browser (local, no API needed)
  - Navigates to each page and performs automated interactions
  - Measures layout shifts during interactions
  - Captures network requests and console errors
  - Performs multiple test runs for reliability
- **Metrics collected**:
  - Layout shifts during interactions: CLS measured while user interacts
  - Input responsiveness: Time from user input to visual feedback
  - Animation smoothness: FPS during animations
  - Interaction latency: Time between user action and system response
  - Error rates: Percentage of console errors vs. total messages
  - Network failure recovery: Ability to recover from failed requests
  - Resource load success rate: Percentage of successful resource loads
  - Service worker availability: Offline capability indicator

#### CrUX Integration (Optional)
- **Purpose**: Collects real user metrics from Google's Chrome User Experience Report
- **How it works**:
  - Queries Google's CrUX API (requires API key)
  - Fetches real user data (75th percentile values)
  - Merges with lab metrics for validation
- **Note**: Not all sites have CrUX data available

### Stage 2: Metrics Normalization

Raw metrics from different tools are normalized to a unified format:

- **Unit conversion**: All metrics converted to common units (milliseconds, percentages, scores)
- **Scale normalization**: Metrics normalized to 0-100 scale for comparison
- **Missing data handling**: Missing metrics set to `null` (handled gracefully in scoring)
- **Data validation**: Checks for data completeness and flags missing critical metrics

**Normalization rules**:
- CWV metrics: Inverse normalization (lower is better → higher score is better)
  - LCP: 0-4000ms → 0-100 score (inverse)
  - FID/INP: 0-300ms (FID) or 0-500ms (INP) → 0-100 score (inverse)
  - CLS: 0-0.25 → 0-100 score (inverse)
- Interaction stability: Average of normalized sub-metrics
- Accessibility: Direct score (already 0-100)
- Reliability: Percentage-based (0-100)

### Stage 3: Composite Scoring

Category scores are calculated and combined using weighted formula:

```
Composite UX Score = 
  (CWV_Score × 0.30) +
  (Interaction_Stability_Score × 0.25) +
  (Accessibility_Score × 0.25) +
  (Reliability_Score × 0.20)
```

**Default weights** (configurable in `config/benchmark.json`):
- CWV: 30% - Foundational web performance metrics
- Interaction Stability: 25% - User interaction quality
- Accessibility: 25% - Inclusive design compliance
- Reliability: 20% - Error handling and robustness

Each category score is first normalized to 0-100, then weighted and summed.

### Stage 4: Ranking Comparison

The system creates two rankings:

1. **CWV-only ranking**: Pages ranked by CWV score alone (LCP, FID/INP, CLS)
2. **Composite ranking**: Pages ranked by composite UX score

**Rank flip detection**:
- Compares positions between the two rankings
- Identifies pages that rank differently
- Calculates rank change magnitude (e.g., +3 positions, -2 positions)
- Sorts rank flips by absolute change (largest flips first)

**Statistical analysis**:
- Correlation coefficient between CWV scores and composite scores
- Rank flip count: Number of pages with different rankings
- Rank flip percentage: Percentage of pages that flipped ranks

### Stage 5: Report Generation

Final JSON reports are generated with:

- **Metadata**: Timestamp, version, list of pages analyzed
- **Per-page data**: All metrics, normalized scores, and category scores
- **Rankings**: CWV-only and composite rankings with scores
- **Rank flips**: Detailed list of pages with rank changes
- **Statistics**: Correlation, flip counts, and percentages

Reports are saved to `data/reports/` with timestamp-based filenames.

## Installation

```bash
npm install
npx playwright install chromium
```

Note: Playwright requires browser binaries. Run `npx playwright install chromium` after installing dependencies.

## Configuration

### Pages Configuration (`config/pages.json`)

Define the pages you want to benchmark:

```json
{
  "pages": [
    {
      "id": "page-1",
      "name": "E-commerce Product Page",
      "url": "https://example.com/product",
      "category": "ecommerce",
      "expectedPattern": "product-detail"
    }
  ]
}
```

### Benchmark Configuration (`config/benchmark.json`)

Configure tool settings and composite weights:

```json
{
  "lighthouse": {
    "preset": "desktop",
    "categories": ["performance", "accessibility"],
    "throttling": "default"
  },
  "playwright": {
    "headless": true,
    "runs": 3,
    "timeout": 30000,
    "viewport": {
      "width": 1920,
      "height": 1080
    }
  },
  "compositeWeights": {
    "cvv": 0.30,
    "interactionStability": 0.25,
    "accessibility": 0.25,
    "reliability": 0.20
  }
}
```

## Environment Variables

- `CRUX_API_KEY`: Chrome UX Report API key (optional, for real user metrics)

Note: Playwright runs locally and doesn't require any API keys or paid services.

## Usage

### Run Benchmark

```bash
# Benchmark all configured pages
npm run benchmark

# Benchmark specific page
npm run benchmark -- --page page-1

# Use custom config
npm run benchmark -- --config custom-config.json

# Skip Playwright tests (faster, but less interaction/reliability data)
npm run benchmark -- --skip-playwright

# Skip CrUX collection
npm run benchmark -- --skip-crux
```

### Compare Reports

```bash
npm run compare -- --baseline data/reports/report-1.json --current data/reports/report-2.json
```

## Understanding Reports

### Report Structure

Reports are generated in JSON format in `data/reports/` with the following structure:

```json
{
  "metadata": {
    "timestamp": "2026-01-04T19:03:08.384Z",
    "version": "1.0.0",
    "pages": ["page-1", "page-2", "page-3"]
  },
  "pages": [...],
  "rankings": {...},
  "statistics": {...}
}
```

### Per-Page Metrics

Each page entry contains:

#### Core Web Vitals (cvv)
- **lcp** (number | null): Largest Contentful Paint in milliseconds
  - Good: < 2500ms, Needs improvement: 2500-4000ms, Poor: > 4000ms
- **fid** (number | null): First Input Delay in milliseconds (deprecated)
  - Good: < 100ms, Needs improvement: 100-300ms, Poor: > 300ms
- **inp** (number | null): Interaction to Next Paint in milliseconds
  - Good: < 200ms, Needs improvement: 200-500ms, Poor: > 500ms
- **cls** (number | null): Cumulative Layout Shift (0-1 scale, lower is better)
  - Good: < 0.1, Needs improvement: 0.1-0.25, Poor: > 0.25

#### Interaction Stability (interactionStability)
- **layoutShiftDuringInteractions** (number | null): CLS measured during user interactions
- **inputResponsiveness** (number | null): Time from input to visual feedback (ms)
- **animationSmoothness** (number | null): FPS during animations (0-60)
- **interactionLatency** (number | null): Time between user action and response (ms)

#### Accessibility (accessibility)
- **wcagComplianceScore** (number | null): Overall WCAG compliance (0-100)
- **keyboardNavigationScore** (number | null): Keyboard accessibility score (0-100)
- **screenReaderCompatibility** (number | null): ARIA/accessibility implementation (0-100)
- **colorContrastRatio** (number | null): Color contrast compliance (0-100)

#### Reliability (reliability)
- **errorRate** (number | null): Percentage of console errors (0-100, lower is better)
- **networkFailureRecovery** (number | null): Recovery rate from failed requests (0-100, higher is better)
- **resourceLoadSuccessRate** (number | null): Percentage of successful resource loads (0-100)
- **serviceWorkerAvailable** (boolean | null): Whether service worker is registered

#### Scores

Each page has normalized scores (0-100 scale, higher is better):

- **cvv**: Composite CWV score (LCP, FID/INP, CLS combined)
- **interactionStability**: Interaction stability composite score
- **accessibility**: Accessibility composite score
- **reliability**: Reliability composite score
- **composite**: Overall UX score (weighted combination of all categories)

### Rankings

The report includes two rankings:

#### CWV Rankings (`rankings.cvv`)
Pages ranked by CWV score alone (traditional Core Web Vitals approach):
```json
{
  "pageId": "page-1",
  "score": 71.77,
  "rank": 1
}
```

#### Composite Rankings (`rankings.composite`)
Pages ranked by composite UX score (includes all metrics):
```json
{
  "pageId": "page-1",
  "score": 76.07,
  "rank": 1
}
```

### Rank Flips

The `rankings.rankFlips` array identifies pages with different rankings:

```json
{
  "pageId": "page-2",
  "cvvRank": 3,
  "compositeRank": 1,
  "rankChange": 2
}
```

- **cvvRank**: Position in CWV-only ranking
- **compositeRank**: Position in composite ranking
- **rankChange**: Difference (cvvRank - compositeRank)
  - Positive: Ranked better in composite (improved)
  - Negative: Ranked worse in composite (declined)
  - Zero: Same rank in both (no flip)

**Example interpretation**:
- `rankChange: +2` means the page ranked 2 positions better in composite ranking
- This indicates the page performs well in accessibility/reliability/interaction stability, but may have lower CWV scores

### Statistics

The `statistics` object provides summary metrics:

- **correlation** (number): Pearson correlation coefficient between CWV scores and composite scores
  - Range: -1 to 1
  - Close to 1: Strong positive correlation (CWV predicts composite well)
  - Close to 0: Weak correlation (CWV doesn't predict composite well)
  - Close to -1: Strong negative correlation (inverse relationship)
- **rankFlipCount** (number): Number of pages with different rankings
- **rankFlipPercentage** (number): Percentage of pages that flipped ranks

**Interpretation**:
- **High correlation (> 0.7)**: CWV-only ranking is a good predictor of overall UX
- **Low correlation (< 0.5)**: CWV doesn't capture the full picture; composite ranking reveals different winners
- **High rank flip percentage (> 50%)**: Many pages rank differently, indicating CWV misses important UX factors

### Missing Data

Some metrics may be `null` in reports. This is normal and expected:

- **FID/INP null**: No user interactions occurred during Lighthouse run
- **Input responsiveness null**: No successful interactions in Playwright tests
- **Animation smoothness null**: No animations detected or measured
- **Error rate null**: No console messages were captured
- **CLS = 0**: No layout shifts occurred (this is good!)

The system handles missing metrics by:
- Using available metrics for scoring
- Setting missing metrics to `null` (treated as 0 in normalization)
- Warning about incomplete data but continuing with available metrics

## Composite Scoring

The composite UX score is calculated as:

```
Composite UX Score = 
  (CWV_Score × 0.30) +
  (Interaction_Stability_Score × 0.25) +
  (Accessibility_Score × 0.25) +
  (Reliability_Score × 0.20)
```

Each category score is normalized to 0-100 scale before weighting.

### Why This Formula?

The weights reflect the relative importance of each category:

1. **CWV (30%)**: Foundation of web performance, widely recognized
2. **Interaction Stability (25%)**: Critical for user engagement and perceived performance
3. **Accessibility (25%)**: Essential for inclusive design and legal compliance
4. **Reliability (20%)**: Important but less directly visible to users

These weights are configurable in `config/benchmark.json` and can be adjusted based on your research needs or use case.

## Research Use Cases

This tool is designed for research purposes, particularly:

- **Comparing CWV-only vs. composite UX rankings**: Demonstrates when CWV doesn't capture the full picture
- **Identifying rank flips**: Shows pages that perform differently in composite vs. CWV-only rankings
- **Statistical analysis**: Correlation coefficients help quantify the relationship between CWV and overall UX
- **Academic research**: Generate data for papers (e.g., IEEE Access) showing CWV limitations

### Example Research Questions

1. **Do CWV winners also win in composite UX?**
   - Check correlation coefficient
   - Low correlation suggests CWV misses important factors

2. **Which pages rank differently in composite vs. CWV-only?**
   - Review `rankFlips` array
   - Pages with large `rankChange` values are interesting case studies

3. **How much does accessibility/reliability affect overall UX?**
   - Compare CWV scores vs. composite scores
   - Large differences indicate non-CWV factors are significant

## License

Apache-2.0
