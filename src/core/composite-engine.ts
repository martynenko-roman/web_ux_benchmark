import type { NormalizedScores } from "./normalizer.js";
import type { CompositeWeights } from "../types/config.js";
import type { PageCoverage } from "../types/metrics.js";

export interface CompositeScores {
  cvv: number;
  interactionStability: number;
  accessibility: number;
  reliability: number;
  composite: number;
  rawComposite: number;
  coverageFactor: number;
}

/**
 * coveragePenaltyFactor controls how strongly missing metrics penalize the score.
 * formula: coverageFactor = coveragePercentage ^ penaltyFactor
 * - 0    → no penalty (coverageFactor always 1)
 * - 0.5  → moderate penalty (sqrt)
 * - 1    → linear penalty
 */
export function calculateCompositeScore(
  normalizedScores: NormalizedScores,
  weights: CompositeWeights,
  coverage: PageCoverage,
  coveragePenaltyFactor: number = 0.5,
): CompositeScores {
  const rawComposite = computeWeightedComposite(normalizedScores, weights, coverage);

  const coverageRatio = coverage.overall.percentage / 100;
  const coverageFactor =
    coveragePenaltyFactor > 0
      ? Math.pow(Math.max(coverageRatio, 0.01), coveragePenaltyFactor)
      : 1;

  const composite = rawComposite * coverageFactor;

  return {
    cvv: normalizedScores.cvv,
    interactionStability: normalizedScores.interactionStability,
    accessibility: normalizedScores.accessibility,
    reliability: normalizedScores.reliability,
    rawComposite: round(rawComposite),
    coverageFactor: round(coverageFactor),
    composite: round(composite),
  };
}

/**
 * When a category has insufficient data, redistribute its weight proportionally
 * among categories that have data rather than contributing 0.
 */
function computeWeightedComposite(
  scores: NormalizedScores,
  weights: CompositeWeights,
  coverage: PageCoverage,
): number {
  const categories: Array<{
    key: keyof CompositeWeights;
    score: number;
    hasSufficientData: boolean;
  }> = [
    { key: "cvv", score: scores.cvv, hasSufficientData: coverage.cvv.available > 0 },
    {
      key: "interactionStability",
      score: scores.interactionStability,
      hasSufficientData: coverage.interactionStability.available > 0,
    },
    {
      key: "accessibility",
      score: scores.accessibility,
      hasSufficientData: coverage.accessibility.available > 0,
    },
    {
      key: "reliability",
      score: scores.reliability,
      hasSufficientData: coverage.reliability.available > 0,
    },
  ];

  const availableCategories = categories.filter((c) => c.hasSufficientData);
  if (availableCategories.length === 0) return 0;

  const totalAvailableWeight = availableCategories.reduce(
    (sum, c) => sum + weights[c.key],
    0,
  );

  if (totalAvailableWeight === 0) return 0;

  let composite = 0;
  for (const cat of availableCategories) {
    const redistributedWeight = weights[cat.key] / totalAvailableWeight;
    composite += cat.score * redistributedWeight;
  }

  return composite;
}

export function validateWeights(weights: CompositeWeights): boolean {
  const total =
    weights.cvv +
    weights.interactionStability +
    weights.accessibility +
    weights.reliability;

  return Math.abs(total - 1.0) < 0.001;
}

function round(value: number): number {
  return Math.round(value * 100) / 100;
}
