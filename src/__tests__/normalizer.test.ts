import { describe, it, expect } from "vitest";
import { normalizeMetrics, normalizeMetricsDetailed } from "../core/normalizer.js";
import type { NormalizedMetrics } from "../types/metrics.js";

function makeMetrics(overrides: Partial<NormalizedMetrics> = {}): NormalizedMetrics {
  return {
    cvv: { lcp: null, fid: null, inp: null, cls: null, inpProxy: null },
    interactionStability: {
      layoutShiftDuringInteractions: null,
      inputResponsiveness: null,
      frameDropRate: null,
      interactionLatency: null,
    },
    accessibility: {
      wcagComplianceScore: null,
      keyboardNavigationScore: null,
      screenReaderCompatibility: null,
      colorContrastRatio: null,
    },
    reliability: {
      errorRate: null,
      networkFailureRecovery: null,
      resourceLoadSuccessRate: null,
      serviceWorkerAvailable: null,
    },
    raw: {},
    ...overrides,
  };
}

describe("normalizeMetrics", () => {
  it("returns 0 for all categories when all metrics are null", () => {
    const scores = normalizeMetrics(makeMetrics());
    expect(scores.cvv).toBe(0);
    expect(scores.interactionStability).toBe(0);
    expect(scores.accessibility).toBe(0);
    expect(scores.reliability).toBe(0);
  });

  it("uses available-metric mean for partial CWV data", () => {
    const metrics = makeMetrics({
      cvv: { lcp: 2000, fid: null, inp: null, cls: null, inpProxy: null },
    });
    const scores = normalizeMetrics(metrics);
    // LCP 2000ms → inverseNormalize(2000, 0, 4000) = 50
    expect(scores.cvv).toBe(50);
  });

  it("scores CWV correctly with perfect metrics", () => {
    const metrics = makeMetrics({
      cvv: { lcp: 0, fid: null, inp: null, cls: 0, inpProxy: 0 },
    });
    const scores = normalizeMetrics(metrics);
    expect(scores.cvv).toBe(100);
  });

  it("scores CWV correctly with worst metrics", () => {
    const metrics = makeMetrics({
      cvv: { lcp: 4000, fid: null, inp: null, cls: 0.25, inpProxy: 500 },
    });
    const scores = normalizeMetrics(metrics);
    expect(scores.cvv).toBe(0);
  });

  it("prefers inpProxy over inp and fid", () => {
    const metricsWithProxy = makeMetrics({
      cvv: { lcp: 1000, fid: 100, inp: 200, cls: 0.05, inpProxy: 50 },
    });
    const metricsWithoutProxy = makeMetrics({
      cvv: { lcp: 1000, fid: 100, inp: 200, cls: 0.05, inpProxy: null },
    });
    const scoresProxy = normalizeMetrics(metricsWithProxy);
    const scoresNoProxy = normalizeMetrics(metricsWithoutProxy);
    // inpProxy of 50ms scores 90 → higher than inp of 200ms scoring 60
    expect(scoresProxy.cvv).toBeGreaterThan(scoresNoProxy.cvv);
  });

  it("handles interaction stability with frameDropRate", () => {
    const metrics = makeMetrics({
      interactionStability: {
        layoutShiftDuringInteractions: 0,
        inputResponsiveness: 100,
        frameDropRate: 10,
        interactionLatency: 200,
      },
    });
    const scores = normalizeMetrics(metrics);
    expect(scores.interactionStability).toBeGreaterThan(0);
    expect(scores.interactionStability).toBeLessThanOrEqual(100);
  });

  it("computes accessibility from available metrics only", () => {
    const metrics = makeMetrics({
      accessibility: {
        wcagComplianceScore: 80,
        keyboardNavigationScore: null,
        screenReaderCompatibility: null,
        colorContrastRatio: 100,
      },
    });
    const scores = normalizeMetrics(metrics);
    expect(scores.accessibility).toBe(90);
  });

  it("computes reliability with error rate inverse normalization", () => {
    const metrics = makeMetrics({
      reliability: {
        errorRate: 0,
        networkFailureRecovery: 100,
        resourceLoadSuccessRate: 95,
        serviceWorkerAvailable: false,
      },
    });
    const scores = normalizeMetrics(metrics);
    // errorRate 0 → 100, recovery 100, resourceLoad 95, serviceWorker false → 0
    // mean = (100 + 100 + 95 + 0) / 4 = 73.75
    expect(scores.reliability).toBeCloseTo(73.75);
  });
});

describe("normalizeMetricsDetailed", () => {
  it("marks insufficient data correctly", () => {
    const detailed = normalizeMetricsDetailed(makeMetrics());
    expect(detailed.cvv.insufficientData).toBe(true);
    expect(detailed.interactionStability.insufficientData).toBe(true);
    expect(detailed.accessibility.insufficientData).toBe(true);
    expect(detailed.reliability.insufficientData).toBe(true);
  });

  it("reports correct available/expected counts", () => {
    const metrics = makeMetrics({
      cvv: { lcp: 1500, fid: null, inp: null, cls: 0.1, inpProxy: null },
    });
    const detailed = normalizeMetricsDetailed(metrics);
    expect(detailed.cvv.availableMetrics).toBe(2);
    expect(detailed.cvv.expectedMetrics).toBe(3);
    expect(detailed.cvv.insufficientData).toBe(false);
  });

  it("counts inpProxy as one metric slot alongside inp/fid", () => {
    const metrics = makeMetrics({
      cvv: { lcp: 1000, fid: 50, inp: 100, cls: 0.05, inpProxy: 30 },
    });
    const detailed = normalizeMetricsDetailed(metrics);
    // lcp + inpProxy + cls = 3 available out of 3 expected
    expect(detailed.cvv.availableMetrics).toBe(3);
  });
});
