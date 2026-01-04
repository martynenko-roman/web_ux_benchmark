import type { NormalizedMetrics } from "../types/metrics.js";
import {
  normalizeScore,
  inverseNormalizeScore,
} from "../utils/math-utils.js";

export interface NormalizedScores {
  cvv: number;
  interactionStability: number;
  accessibility: number;
  reliability: number;
}

export function normalizeMetrics(metrics: NormalizedMetrics): NormalizedScores {
  const cvvScore = normalizeCWV(metrics.cvv);
  const interactionStabilityScore = normalizeInteractionStability(
    metrics.interactionStability
  );
  const accessibilityScore = normalizeAccessibility(metrics.accessibility);
  const reliabilityScore = normalizeReliability(metrics.reliability);

  return {
    cvv: cvvScore,
    interactionStability: interactionStabilityScore,
    accessibility: accessibilityScore,
    reliability: reliabilityScore,
  };
}

function normalizeCWV(cvv: NormalizedMetrics["cvv"]): number {
  const scores: number[] = [];

  if (cvv.lcp !== null) {
    const lcpScore = inverseNormalizeScore(cvv.lcp, 0, 4000);
    scores.push(lcpScore);
  }

  if (cvv.fid !== null) {
    const fidScore = inverseNormalizeScore(cvv.fid, 0, 300);
    scores.push(fidScore);
  }

  if (cvv.inp !== null) {
    const inpScore = inverseNormalizeScore(cvv.inp, 0, 500);
    scores.push(inpScore);
  }

  if (cvv.cls !== null) {
    const clsScore = inverseNormalizeScore(cvv.cls, 0, 0.25);
    scores.push(clsScore);
  }

  if (scores.length === 0) return 0;
  return mean(scores);
}

function normalizeInteractionStability(
  interaction: NormalizedMetrics["interactionStability"]
): number {
  const scores: number[] = [];

  if (interaction.layoutShiftDuringInteractions !== null) {
    const clsScore = inverseNormalizeScore(
      interaction.layoutShiftDuringInteractions,
      0,
      0.25
    );
    scores.push(clsScore);
  }

  if (interaction.inputResponsiveness !== null) {
    const inputScore = inverseNormalizeScore(
      interaction.inputResponsiveness,
      0,
      500
    );
    scores.push(inputScore);
  }

  if (interaction.animationSmoothness !== null) {
    const fpsScore = normalizeScore(
      interaction.animationSmoothness,
      0,
      60
    );
    scores.push(fpsScore);
  }

  if (interaction.interactionLatency !== null) {
    const latencyScore = inverseNormalizeScore(
      interaction.interactionLatency,
      0,
      1000
    );
    scores.push(latencyScore);
  }

  if (scores.length === 0) return 0;
  return mean(scores);
}

function normalizeAccessibility(
  accessibility: NormalizedMetrics["accessibility"]
): number {
  const scores: number[] = [];

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

  if (scores.length === 0) return 0;
  return mean(scores);
}

function normalizeReliability(
  reliability: NormalizedMetrics["reliability"]
): number {
  const scores: number[] = [];

  if (reliability.errorRate !== null) {
    const errorScore = inverseNormalizeScore(reliability.errorRate, 0, 100);
    scores.push(errorScore);
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

  if (scores.length === 0) return 0;
  return mean(scores);
}

function mean(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

