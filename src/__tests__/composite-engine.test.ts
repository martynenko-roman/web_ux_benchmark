import { describe, it, expect } from "vitest";
import { calculateCompositeScore, validateWeights } from "../core/composite-engine.js";
import type { NormalizedScores } from "../core/normalizer.js";
import type { CompositeWeights } from "../types/config.js";
import type { PageCoverage, CategoryCoverage } from "../types/metrics.js";

const defaultWeights: CompositeWeights = {
  cvv: 0.3,
  interactionStability: 0.25,
  accessibility: 0.25,
  reliability: 0.2,
};

function makeCoverage(overrides: Partial<{
  cvv: number;
  interaction: number;
  accessibility: number;
  reliability: number;
}> = {}): PageCoverage {
  const cat = (avail: number, expected: number): CategoryCoverage => ({
    available: avail,
    expected,
    percentage: expected > 0 ? (avail / expected) * 100 : 0,
    missing: [],
  });

  const cvvAvail = overrides.cvv ?? 3;
  const intAvail = overrides.interaction ?? 4;
  const accAvail = overrides.accessibility ?? 4;
  const relAvail = overrides.reliability ?? 4;
  const totalAvail = cvvAvail + intAvail + accAvail + relAvail;
  const totalExpected = 3 + 4 + 4 + 4;

  return {
    overall: cat(totalAvail, totalExpected),
    cvv: cat(cvvAvail, 3),
    interactionStability: cat(intAvail, 4),
    accessibility: cat(accAvail, 4),
    reliability: cat(relAvail, 4),
  };
}

describe("calculateCompositeScore", () => {
  it("computes full composite when all data is available", () => {
    const scores: NormalizedScores = {
      cvv: 80,
      interactionStability: 70,
      accessibility: 90,
      reliability: 60,
    };
    const result = calculateCompositeScore(scores, defaultWeights, makeCoverage(), 0);
    // 80*0.3 + 70*0.25 + 90*0.25 + 60*0.2 = 24 + 17.5 + 22.5 + 12 = 76
    expect(result.rawComposite).toBe(76);
    expect(result.composite).toBe(76);
    expect(result.coverageFactor).toBe(1);
  });

  it("applies coverage penalty when data is partially missing", () => {
    const scores: NormalizedScores = {
      cvv: 80,
      interactionStability: 70,
      accessibility: 90,
      reliability: 60,
    };
    // 50% coverage → penalty factor = sqrt(0.5) ≈ 0.707
    const coverage = makeCoverage({ cvv: 1, interaction: 2, accessibility: 2, reliability: 2 });
    // 1+2+2+2 = 7 out of 15 → ~46.7%
    const result = calculateCompositeScore(scores, defaultWeights, coverage, 0.5);
    expect(result.coverageFactor).toBeLessThan(1);
    expect(result.composite).toBeLessThan(result.rawComposite);
  });

  it("redistributes weight when a category has no data", () => {
    const scores: NormalizedScores = {
      cvv: 80,
      interactionStability: 0, // no data
      accessibility: 90,
      reliability: 60,
    };
    const coverage = makeCoverage({ interaction: 0 });

    const result = calculateCompositeScore(scores, defaultWeights, coverage, 0);

    // interactionStability excluded, weights redistributed:
    // cvv: 0.3/(0.3+0.25+0.2) = 0.4
    // accessibility: 0.25/0.75 = 0.333
    // reliability: 0.2/0.75 = 0.267
    // raw = 80*0.4 + 90*0.333 + 60*0.267 = 32 + 30 + 16 = 78
    expect(result.rawComposite).toBeCloseTo(78, 0);
  });

  it("returns 0 when all categories have no data", () => {
    const scores: NormalizedScores = {
      cvv: 0,
      interactionStability: 0,
      accessibility: 0,
      reliability: 0,
    };
    const coverage = makeCoverage({ cvv: 0, interaction: 0, accessibility: 0, reliability: 0 });
    const result = calculateCompositeScore(scores, defaultWeights, coverage, 0.5);
    expect(result.rawComposite).toBe(0);
  });

  it("does not apply penalty when factor is 0", () => {
    const scores: NormalizedScores = {
      cvv: 80,
      interactionStability: 70,
      accessibility: 90,
      reliability: 60,
    };
    const coverage = makeCoverage({ cvv: 1, interaction: 1, accessibility: 1, reliability: 1 });
    const result = calculateCompositeScore(scores, defaultWeights, coverage, 0);
    expect(result.coverageFactor).toBe(1);
    expect(result.composite).toBe(result.rawComposite);
  });
});

describe("validateWeights", () => {
  it("validates correct weights", () => {
    expect(validateWeights(defaultWeights)).toBe(true);
  });

  it("rejects incorrect weights", () => {
    expect(validateWeights({ cvv: 0.5, interactionStability: 0.5, accessibility: 0.5, reliability: 0.5 })).toBe(false);
  });
});
