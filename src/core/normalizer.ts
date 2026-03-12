import type { NormalizedMetrics } from "../types/metrics.js";
import { inverseNormalizeScore } from "../utils/math-utils.js";

export interface NormalizedScores {
  cvv: number;
  interactionStability: number;
  accessibility: number;
  reliability: number;
}

export interface CategoryScoreDetail {
  score: number;
  /** Number of metrics that contributed to this score. */
  availableMetrics: number;
  /** Total expected metrics for the category. */
  expectedMetrics: number;
  /** True when no metrics were available — score is null-equivalent. */
  insufficientData: boolean;
}

export interface DetailedNormalizedScores {
  cvv: CategoryScoreDetail;
  interactionStability: CategoryScoreDetail;
  accessibility: CategoryScoreDetail;
  reliability: CategoryScoreDetail;
}

export function normalizeMetrics(metrics: NormalizedMetrics): NormalizedScores {
  const detailed = normalizeMetricsDetailed(metrics);
  return {
    cvv: detailed.cvv.score,
    interactionStability: detailed.interactionStability.score,
    accessibility: detailed.accessibility.score,
    reliability: detailed.reliability.score,
  };
}

export function normalizeMetricsDetailed(
  metrics: NormalizedMetrics,
): DetailedNormalizedScores {
  return {
    cvv: normalizeCWV(metrics.cvv),
    interactionStability: normalizeInteractionStability(metrics.interactionStability),
    accessibility: normalizeAccessibility(metrics.accessibility),
    reliability: normalizeReliability(metrics.reliability),
  };
}

function normalizeCWV(cvv: NormalizedMetrics["cvv"]): CategoryScoreDetail {
  const scores: number[] = [];
  const expected = 3; // lcp, cls, inpProxy (we exclude deprecated fid and lab-only inp)

  if (cvv.lcp !== null) {
    scores.push(inverseNormalizeScore(cvv.lcp, 0, 4000));
  }

  if (cvv.inpProxy !== null) {
    scores.push(inverseNormalizeScore(cvv.inpProxy, 0, 500));
  } else if (cvv.inp !== null) {
    scores.push(inverseNormalizeScore(cvv.inp, 0, 500));
  } else if (cvv.fid !== null) {
    scores.push(inverseNormalizeScore(cvv.fid, 0, 300));
  }

  if (cvv.cls !== null) {
    scores.push(inverseNormalizeScore(cvv.cls, 0, 0.25));
  }

  return {
    score: scores.length > 0 ? mean(scores) : 0,
    availableMetrics: scores.length,
    expectedMetrics: expected,
    insufficientData: scores.length === 0,
  };
}

function normalizeInteractionStability(
  interaction: NormalizedMetrics["interactionStability"],
): CategoryScoreDetail {
  const scores: number[] = [];
  const expected = 4;

  if (interaction.layoutShiftDuringInteractions !== null) {
    scores.push(inverseNormalizeScore(interaction.layoutShiftDuringInteractions, 0, 0.25));
  }

  if (interaction.inputResponsiveness !== null) {
    scores.push(inverseNormalizeScore(interaction.inputResponsiveness, 0, 500));
  }

  if (interaction.frameDropRate !== null) {
    scores.push(inverseNormalizeScore(interaction.frameDropRate, 0, 100));
  }

  if (interaction.interactionLatency !== null) {
    scores.push(inverseNormalizeScore(interaction.interactionLatency, 0, 1000));
  }

  return {
    score: scores.length > 0 ? mean(scores) : 0,
    availableMetrics: scores.length,
    expectedMetrics: expected,
    insufficientData: scores.length === 0,
  };
}

function normalizeAccessibility(
  accessibility: NormalizedMetrics["accessibility"],
): CategoryScoreDetail {
  const scores: number[] = [];
  const expected = 4;

  if (accessibility.wcagComplianceScore !== null) {
    scores.push(accessibility.wcagComplianceScore);
  }

  if (accessibility.keyboardNavigationScore !== null) {
    scores.push(accessibility.keyboardNavigationScore);
  }

  if (accessibility.screenReaderCompatibility !== null) {
    scores.push(accessibility.screenReaderCompatibility);
  }

  if (accessibility.colorContrastRatio !== null) {
    scores.push(accessibility.colorContrastRatio);
  }

  return {
    score: scores.length > 0 ? mean(scores) : 0,
    availableMetrics: scores.length,
    expectedMetrics: expected,
    insufficientData: scores.length === 0,
  };
}

function normalizeReliability(
  reliability: NormalizedMetrics["reliability"],
): CategoryScoreDetail {
  const scores: number[] = [];
  const expected = 4;

  if (reliability.errorRate !== null) {
    scores.push(inverseNormalizeScore(reliability.errorRate, 0, 100));
  }

  if (reliability.networkFailureRecovery !== null) {
    scores.push(reliability.networkFailureRecovery);
  }

  if (reliability.resourceLoadSuccessRate !== null) {
    scores.push(reliability.resourceLoadSuccessRate);
  }

  if (reliability.serviceWorkerAvailable !== null) {
    scores.push(reliability.serviceWorkerAvailable ? 100 : 0);
  }

  return {
    score: scores.length > 0 ? mean(scores) : 0,
    availableMetrics: scores.length,
    expectedMetrics: expected,
    insufficientData: scores.length === 0,
  };
}

function mean(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((a, b) => a + b, 0) / values.length;
}
