import type {
  CWVMetrics,
  InteractionMetrics,
  AccessibilityMetrics,
  ReliabilityMetrics,
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
  };
}

export interface BenchmarkReport {
  metadata: {
    timestamp: string;
    version: string;
    pages: string[];
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
}

