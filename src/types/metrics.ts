export interface CWVMetrics {
  lcp: number | null;
  fid: number | null;
  inp: number | null;
  cls: number | null;
}

export interface InteractionMetrics {
  layoutShiftDuringInteractions: number | null;
  inputResponsiveness: number | null;
  animationSmoothness: number | null;
  interactionLatency: number | null;
}

export interface AccessibilityMetrics {
  wcagComplianceScore: number | null;
  keyboardNavigationScore: number | null;
  screenReaderCompatibility: number | null;
  colorContrastRatio: number | null;
}

export interface ReliabilityMetrics {
  errorRate: number | null;
  networkFailureRecovery: number | null;
  resourceLoadSuccessRate: number | null;
  serviceWorkerAvailable: boolean | null;
}

export interface RawMetrics {
  lighthouse?: any;
  webpagetest?: any;
  crux?: any;
  rum?: any;
}

export interface NormalizedMetrics {
  cvv: CWVMetrics;
  interactionStability: InteractionMetrics;
  accessibility: AccessibilityMetrics;
  reliability: ReliabilityMetrics;
  raw: RawMetrics;
}

