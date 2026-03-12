import type {
  CWVMetrics,
  InteractionMetrics,
  AccessibilityMetrics,
  ReliabilityMetrics,
  NormalizedMetrics,
  RawMetrics,
  CategoryCoverage,
  PageCoverage,
} from "../types/metrics.js";
import type { LighthouseResult } from "../collectors/lighthouse-runner.js";
import type { PlaywrightResult } from "../collectors/playwright-runner.js";
import type { CrUXResult } from "../collectors/crux-collector.js";

export interface CollectedMetrics {
  lighthouse?: LighthouseResult;
  playwright?: PlaywrightResult;
  crux?: CrUXResult;
}

export function aggregateMetrics(collected: CollectedMetrics): NormalizedMetrics {
  const cvv: CWVMetrics = mergeCWV(
    collected.lighthouse?.cvv,
    collected.crux?.cvv,
    collected.playwright?.inpProxy ?? null,
  );

  const interactionStability: InteractionMetrics =
    collected.playwright?.interactionStability ?? {
      layoutShiftDuringInteractions: null,
      inputResponsiveness: null,
      frameDropRate: null,
      interactionLatency: null,
    };

  const accessibility: AccessibilityMetrics =
    collected.lighthouse?.accessibility ?? {
      wcagComplianceScore: null,
      keyboardNavigationScore: null,
      screenReaderCompatibility: null,
      colorContrastRatio: null,
    };

  const reliability: ReliabilityMetrics =
    collected.playwright?.reliability ?? {
      errorRate: null,
      networkFailureRecovery: null,
      resourceLoadSuccessRate: null,
      serviceWorkerAvailable: null,
    };

  const raw: RawMetrics = {
    lighthouse: collected.lighthouse?.raw,
    playwright: collected.playwright?.raw,
    crux: collected.crux?.raw,
  };

  return { cvv, interactionStability, accessibility, reliability, raw };
}

function mergeCWV(
  lighthouse?: CWVMetrics | null,
  crux?: CWVMetrics | null,
  playwrightInpProxy?: number | null,
): CWVMetrics {
  return {
    lcp: lighthouse?.lcp ?? crux?.lcp ?? null,
    fid: lighthouse?.fid ?? crux?.fid ?? null,
    inp: lighthouse?.inp ?? crux?.inp ?? null,
    cls: lighthouse?.cls ?? crux?.cls ?? null,
    inpProxy: playwrightInpProxy ?? lighthouse?.inpProxy ?? null,
  };
}

function computeCategoryCoverage(
  values: Record<string, unknown>,
  categoryName: string,
): CategoryCoverage {
  const keys = Object.keys(values);
  const missing: string[] = [];
  let available = 0;

  for (const key of keys) {
    if (values[key] !== null && values[key] !== undefined) {
      available++;
    } else {
      missing.push(`${categoryName}.${key}`);
    }
  }

  return {
    available,
    expected: keys.length,
    percentage: keys.length > 0 ? (available / keys.length) * 100 : 0,
    missing,
  };
}

export function computePageCoverage(metrics: NormalizedMetrics): PageCoverage {
  const cvv = computeCategoryCoverage(
    {
      lcp: metrics.cvv.lcp,
      cls: metrics.cvv.cls,
      inpProxy: metrics.cvv.inpProxy,
    },
    "cvv",
  );

  const interactionStability = computeCategoryCoverage(
    {
      layoutShiftDuringInteractions: metrics.interactionStability.layoutShiftDuringInteractions,
      inputResponsiveness: metrics.interactionStability.inputResponsiveness,
      frameDropRate: metrics.interactionStability.frameDropRate,
      interactionLatency: metrics.interactionStability.interactionLatency,
    },
    "interactionStability",
  );

  const accessibility = computeCategoryCoverage(
    {
      wcagComplianceScore: metrics.accessibility.wcagComplianceScore,
      keyboardNavigationScore: metrics.accessibility.keyboardNavigationScore,
      screenReaderCompatibility: metrics.accessibility.screenReaderCompatibility,
      colorContrastRatio: metrics.accessibility.colorContrastRatio,
    },
    "accessibility",
  );

  const reliability = computeCategoryCoverage(
    {
      errorRate: metrics.reliability.errorRate,
      networkFailureRecovery: metrics.reliability.networkFailureRecovery,
      resourceLoadSuccessRate: metrics.reliability.resourceLoadSuccessRate,
      serviceWorkerAvailable: metrics.reliability.serviceWorkerAvailable,
    },
    "reliability",
  );

  const totalAvailable =
    cvv.available + interactionStability.available + accessibility.available + reliability.available;
  const totalExpected =
    cvv.expected + interactionStability.expected + accessibility.expected + reliability.expected;
  const allMissing = [
    ...cvv.missing,
    ...interactionStability.missing,
    ...accessibility.missing,
    ...reliability.missing,
  ];

  const overall: CategoryCoverage = {
    available: totalAvailable,
    expected: totalExpected,
    percentage: totalExpected > 0 ? (totalAvailable / totalExpected) * 100 : 0,
    missing: allMissing,
  };

  return { overall, cvv, interactionStability, accessibility, reliability };
}

export function validateDataCompleteness(metrics: NormalizedMetrics): {
  isComplete: boolean;
  missingFields: string[];
} {
  const coverage = computePageCoverage(metrics);
  return {
    isComplete: coverage.overall.missing.length === 0,
    missingFields: coverage.overall.missing,
  };
}
