import type { NormalizedScores } from "./normalizer.js";
import type { CompositeWeights } from "../types/config.js";

export interface CompositeScores {
  cvv: number;
  interactionStability: number;
  accessibility: number;
  reliability: number;
  composite: number;
}

export function calculateCompositeScore(
  normalizedScores: NormalizedScores,
  weights: CompositeWeights
): CompositeScores {
  const composite =
    normalizedScores.cvv * weights.cvv +
    normalizedScores.interactionStability * weights.interactionStability +
    normalizedScores.accessibility * weights.accessibility +
    normalizedScores.reliability * weights.reliability;

  return {
    cvv: normalizedScores.cvv,
    interactionStability: normalizedScores.interactionStability,
    accessibility: normalizedScores.accessibility,
    reliability: normalizedScores.reliability,
    composite: Math.round(composite * 100) / 100,
  };
}

export function validateWeights(weights: CompositeWeights): boolean {
  const total =
    weights.cvv +
    weights.interactionStability +
    weights.accessibility +
    weights.reliability;

  return Math.abs(total - 1.0) < 0.001;
}

