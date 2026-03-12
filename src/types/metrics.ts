export interface CWVMetrics {
  lcp: number | null;
  fid: number | null;
  inp: number | null;
  cls: number | null;
  /** Playwright-based proxy for INP: time from user event dispatch to next paint (ms). */
  inpProxy: number | null;
}

export interface InteractionMetrics {
  layoutShiftDuringInteractions: number | null;
  inputResponsiveness: number | null;
  /** RAF-cadence frame drop rate (0–100, lower is better). Replaces the old always-null animationSmoothness. */
  frameDropRate: number | null;
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
  playwright?: any;
  crux?: any;
}

export interface NormalizedMetrics {
  cvv: CWVMetrics;
  interactionStability: InteractionMetrics;
  accessibility: AccessibilityMetrics;
  reliability: ReliabilityMetrics;
  raw: RawMetrics;
}

export type MeasurementStage =
  | "lighthouse"
  | "playwright"
  | "crux";

export interface StageStatus {
  stage: MeasurementStage;
  success: boolean;
  failureReason?: string;
  durationMs?: number;
}

export interface CategoryCoverage {
  available: number;
  expected: number;
  percentage: number;
  missing: string[];
}

export interface PageCoverage {
  overall: CategoryCoverage;
  cvv: CategoryCoverage;
  interactionStability: CategoryCoverage;
  accessibility: CategoryCoverage;
  reliability: CategoryCoverage;
}

export interface PageDiagnostics {
  stages: StageStatus[];
  coverage: PageCoverage;
}

export interface PerRunMetrics {
  run: number;
  layoutShifts: number;
  inputLatencies: number[];
  inpProxyValues: number[];
  frameDropRate: number | null;
  consoleErrorCount: number;
  totalConsoleMessageCount: number;
  networkRequestCount: number;
  failedRequestCount: number;
  successfulRequestCount: number;
  serviceWorkerAvailable: boolean;
  totalTimeMs: number;
}
