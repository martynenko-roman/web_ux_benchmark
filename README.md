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

## Output

Reports are generated in JSON format in `data/reports/` with the following structure:

- **Metadata**: Timestamp, version, pages analyzed
- **Pages**: Per-page metrics and scores
- **Rankings**: CWV-only and composite rankings
- **Rank Flips**: Pages with different rankings
- **Statistics**: Correlation, rank flip counts

## Composite Scoring

The composite UX score is calculated as:

```
Composite UX Score = 
  (CWV_Score × 0.30) +
  (Interaction_Stability_Score × 0.25) +
  (Accessibility_Score × 0.25) +
  (Reliability_Score × 0.20)
```

Each category score is normalized to a 0-100 scale.

## License

Apache-2.0
