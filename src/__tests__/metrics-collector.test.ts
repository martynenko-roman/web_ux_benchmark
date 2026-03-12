import { describe, it, expect } from "vitest";
import { computePageCoverage } from "../core/metrics-collector.js";
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

describe("computePageCoverage", () => {
  it("reports 0% coverage for all-null metrics", () => {
    const coverage = computePageCoverage(makeMetrics());
    expect(coverage.overall.percentage).toBe(0);
    expect(coverage.overall.available).toBe(0);
    expect(coverage.overall.expected).toBe(15);
    expect(coverage.overall.missing.length).toBe(15);
  });

  it("computes correct coverage for partial data", () => {
    const metrics = makeMetrics({
      cvv: { lcp: 1500, fid: null, inp: null, cls: 0.1, inpProxy: 50 },
      accessibility: {
        wcagComplianceScore: 85,
        keyboardNavigationScore: null,
        screenReaderCompatibility: 90,
        colorContrastRatio: 100,
      },
    });
    const coverage = computePageCoverage(metrics);
    // cvv: 3/3 (lcp, cls, inpProxy), interaction: 0/4, accessibility: 3/4, reliability: 0/4
    expect(coverage.cvv.available).toBe(3);
    expect(coverage.cvv.percentage).toBe(100);
    expect(coverage.interactionStability.available).toBe(0);
    expect(coverage.accessibility.available).toBe(3);
    expect(coverage.reliability.available).toBe(0);
    expect(coverage.overall.available).toBe(6);
    expect(coverage.overall.percentage).toBeCloseTo(40, 0);
  });

  it("reports full coverage when all metrics present", () => {
    const metrics = makeMetrics({
      cvv: { lcp: 1500, fid: null, inp: null, cls: 0.1, inpProxy: 50 },
      interactionStability: {
        layoutShiftDuringInteractions: 0.01,
        inputResponsiveness: 100,
        frameDropRate: 5,
        interactionLatency: 200,
      },
      accessibility: {
        wcagComplianceScore: 85,
        keyboardNavigationScore: 90,
        screenReaderCompatibility: 95,
        colorContrastRatio: 100,
      },
      reliability: {
        errorRate: 2,
        networkFailureRecovery: 100,
        resourceLoadSuccessRate: 98,
        serviceWorkerAvailable: true,
      },
    });
    const coverage = computePageCoverage(metrics);
    expect(coverage.overall.percentage).toBe(100);
    expect(coverage.overall.missing.length).toBe(0);
  });

  it("correctly identifies missing field names", () => {
    const metrics = makeMetrics({
      cvv: { lcp: 1500, fid: null, inp: null, cls: null, inpProxy: null },
    });
    const coverage = computePageCoverage(metrics);
    expect(coverage.cvv.missing).toContain("cvv.cls");
    expect(coverage.cvv.missing).toContain("cvv.inpProxy");
    expect(coverage.cvv.missing).not.toContain("cvv.lcp");
  });
});
