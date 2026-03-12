import type {
  CWVMetrics,
  InteractionMetrics,
  AccessibilityMetrics,
  ReliabilityMetrics,
  PageDiagnostics,
  PageCoverage,
  PerRunMetrics,
} from "./metrics.js";

export interface Ranking {
  pageId: string;
  score: number;
  rank: number;
}

export interface RankFlip {
  pageId: string;
  cvvRank: number;
  compositeRank: number;
  rankChange: number;
}

export interface PageBenchmark {
  pageId: string;
  url: string;
  metrics: {
    cvv: CWVMetrics;
    interactionStability: InteractionMetrics;
    accessibility: AccessibilityMetrics;
    reliability: ReliabilityMetrics;
  };
  scores: {
    cvv: number;
    interactionStability: number;
    accessibility: number;
    reliability: number;
    composite: number;
    /** Raw composite before coverage penalty. */
    rawComposite: number;
    coverageFactor: number;
  };
  diagnostics: PageDiagnostics;
  coverage: PageCoverage;
}

export interface CoverageSummary {
  totalPages: number;
  pagesWithInteractionMetrics: number;
  pagesWithReliabilityMetrics: number;
  metricPopulation: Record<string, { populated: number; total: number; percentage: number }>;
  averageCoveragePercentage: number;
}

export interface BenchmarkReport {
  metadata: {
    timestamp: string;
    reportVersion: number;
    toolVersion: string;
    pages: string[];
    config: {
      compositeWeights: Record<string, number>;
      coveragePenaltyFactor: number;
      playwrightRuns: number;
    };
  };
  pages: PageBenchmark[];
  rankings: {
    cvv: Ranking[];
    composite: Ranking[];
    rankFlips: RankFlip[];
  };
  statistics: {
    correlation: number;
    rankFlipCount: number;
    rankFlipPercentage: number;
  };
  coverageSummary: CoverageSummary;
  /** Path to companion runs artifact file with per-run data. */
  runsArtifactPath: string | null;
}

export interface RunsArtifact {
  metadata: {
    timestamp: string;
    reportVersion: number;
  };
  pages: Array<{
    pageId: string;
    url: string;
    runs: PerRunMetrics[];
  }>;
}
