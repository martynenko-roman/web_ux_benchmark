import type {
  CWVMetrics,
  InteractionMetrics,
  AccessibilityMetrics,
  ReliabilityMetrics,
  NormalizedMetrics,
  RawMetrics,
} from "../types/metrics.js";
import type { LighthouseResult } from "../collectors/lighthouse-runner.js";
import type { PlaywrightResult } from "../collectors/playwright-runner.js";
import type { CrUXResult } from "../collectors/crux-collector.js";

export interface CollectedMetrics {
  lighthouse?: LighthouseResult;
  webpagetest?: PlaywrightResult;
  crux?: CrUXResult;
}

export function aggregateMetrics(
  collected: CollectedMetrics
): NormalizedMetrics {
  const cvv: CWVMetrics = mergeCWV(
    collected.lighthouse?.cvv,
    collected.crux?.cvv
  );

  const interactionStability: InteractionMetrics =
    collected.webpagetest?.interactionStability ?? {
      layoutShiftDuringInteractions: null,
      inputResponsiveness: null,
      animationSmoothness: null,
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
    collected.webpagetest?.reliability ?? {
      errorRate: null,
      networkFailureRecovery: null,
      resourceLoadSuccessRate: null,
      serviceWorkerAvailable: null,
    };

  const raw: RawMetrics = {
    lighthouse: collected.lighthouse?.raw,
    webpagetest: collected.webpagetest?.raw,
    crux: collected.crux?.raw,
  };

  return {
    cvv,
    interactionStability,
    accessibility,
    reliability,
    raw,
  };
}

function mergeCWV(
  lighthouse?: CWVMetrics | null,
  crux?: CWVMetrics | null
): CWVMetrics {
  return {
    lcp: lighthouse?.lcp ?? crux?.lcp ?? null,
    fid: lighthouse?.fid ?? crux?.fid ?? null,
    inp: lighthouse?.inp ?? crux?.inp ?? null,
    cls: lighthouse?.cls ?? crux?.cls ?? null,
  };
}

export function validateDataCompleteness(
  metrics: NormalizedMetrics
): {
  isComplete: boolean;
  missingFields: string[];
} {
  const missingFields: string[] = [];

  // LCP is critical - should always be available
  if (metrics.cvv.lcp === null || metrics.cvv.lcp === undefined) {
    missingFields.push("cvv.lcp");
  }

  // CLS can be 0 (good), but null/undefined means missing
  if (metrics.cvv.cls === null || metrics.cvv.cls === undefined) {
    missingFields.push("cvv.cls");
  }

  // FID/INP - at least one should be available, but both can be missing if no interactions occurred
  if (metrics.cvv.fid === null && metrics.cvv.inp === null) {
    missingFields.push("cvv.fid/inp");
  }

  // Input responsiveness - can be missing if no interactions were performed
  if (metrics.interactionStability.inputResponsiveness === null) {
    missingFields.push("interactionStability.inputResponsiveness");
  }

  // Accessibility score should be available from Lighthouse
  if (metrics.accessibility.wcagComplianceScore === null || metrics.accessibility.wcagComplianceScore === undefined) {
    missingFields.push("accessibility.wcagComplianceScore");
  }

  // Error rate - null means no console messages were captured (could be 0 errors or no data)
  if (metrics.reliability.errorRate === null) {
    missingFields.push("reliability.errorRate");
  }

  return {
    isComplete: missingFields.length === 0,
    missingFields,
  };
}

