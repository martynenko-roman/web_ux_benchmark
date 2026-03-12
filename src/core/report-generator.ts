import type {
  BenchmarkReport,
  PageBenchmark,
  CoverageSummary,
  RunsArtifact,
} from "../types/report.js";
import type { PerRunMetrics } from "../types/metrics.js";
import type { ComparisonResult } from "./comparator.js";
import type { CompositeWeights } from "../types/config.js";
import { writeJsonFile } from "../utils/file-utils.js";

export interface ReportOptions {
  compositeWeights: CompositeWeights;
  coveragePenaltyFactor: number;
  playwrightRuns: number;
}

export interface PageRunData {
  pageId: string;
  url: string;
  runs: PerRunMetrics[];
}

export async function generateReport(
  pages: PageBenchmark[],
  comparison: ComparisonResult,
  outputPath: string,
  options: ReportOptions,
  pageRunData?: PageRunData[],
): Promise<string | null> {
  const coverageSummary = computeCoverageSummary(pages);

  let runsArtifactPath: string | null = null;
  if (pageRunData && pageRunData.length > 0) {
    runsArtifactPath = outputPath.replace(/\.json$/, "-runs.json");
    const runsArtifact: RunsArtifact = {
      metadata: {
        timestamp: new Date().toISOString(),
        reportVersion: 2,
      },
      pages: pageRunData,
    };
    await writeJsonFile(runsArtifactPath, runsArtifact);
  }

  const report: BenchmarkReport = {
    metadata: {
      timestamp: new Date().toISOString(),
      reportVersion: 2,
      toolVersion: "2.0.0",
      pages: pages.map((p) => p.pageId),
      config: {
        compositeWeights: options.compositeWeights as unknown as Record<string, number>,
        coveragePenaltyFactor: options.coveragePenaltyFactor,
        playwrightRuns: options.playwrightRuns,
      },
    },
    pages,
    rankings: {
      cvv: comparison.cvvRankings,
      composite: comparison.compositeRankings,
      rankFlips: comparison.rankFlips,
    },
    statistics: comparison.statistics,
    coverageSummary,
    runsArtifactPath,
  };

  await writeJsonFile(outputPath, report);
  return runsArtifactPath;
}

function computeCoverageSummary(pages: PageBenchmark[]): CoverageSummary {
  const total = pages.length;

  const pagesWithInteraction = pages.filter(
    (p) => p.coverage.interactionStability.available > 0,
  ).length;

  const pagesWithReliability = pages.filter(
    (p) => p.coverage.reliability.available > 0,
  ).length;

  const metricKeys = [
    "cvv.lcp",
    "cvv.cls",
    "cvv.inpProxy",
    "interactionStability.layoutShiftDuringInteractions",
    "interactionStability.inputResponsiveness",
    "interactionStability.frameDropRate",
    "interactionStability.interactionLatency",
    "accessibility.wcagComplianceScore",
    "accessibility.keyboardNavigationScore",
    "accessibility.screenReaderCompatibility",
    "accessibility.colorContrastRatio",
    "reliability.errorRate",
    "reliability.networkFailureRecovery",
    "reliability.resourceLoadSuccessRate",
    "reliability.serviceWorkerAvailable",
  ];

  const metricPopulation: CoverageSummary["metricPopulation"] = {};
  for (const key of metricKeys) {
    const populated = pages.filter(
      (p) => !p.coverage.overall.missing.includes(key),
    ).length;
    metricPopulation[key] = {
      populated,
      total,
      percentage: total > 0 ? Math.round((populated / total) * 10000) / 100 : 0,
    };
  }

  const avgCoverage =
    total > 0
      ? pages.reduce((sum, p) => sum + p.coverage.overall.percentage, 0) / total
      : 0;

  return {
    totalPages: total,
    pagesWithInteractionMetrics: pagesWithInteraction,
    pagesWithReliabilityMetrics: pagesWithReliability,
    metricPopulation,
    averageCoveragePercentage: Math.round(avgCoverage * 100) / 100,
  };
}

export function generateSummary(report: BenchmarkReport): string {
  const lines: string[] = [];

  lines.push("=== Web UX Benchmark Report (v2) ===");
  lines.push(`Timestamp: ${report.metadata.timestamp}`);
  lines.push(`Pages Analyzed: ${report.pages.length}`);
  lines.push(`Coverage Penalty Factor: ${report.metadata.config.coveragePenaltyFactor}`);
  lines.push("");

  lines.push("=== Coverage Summary ===");
  const cs = report.coverageSummary;
  lines.push(`Average Coverage: ${cs.averageCoveragePercentage.toFixed(1)}%`);
  lines.push(
    `Pages with Interaction Metrics: ${cs.pagesWithInteractionMetrics}/${cs.totalPages} (${((cs.pagesWithInteractionMetrics / cs.totalPages) * 100).toFixed(0)}%)`,
  );
  lines.push(
    `Pages with Reliability Metrics: ${cs.pagesWithReliabilityMetrics}/${cs.totalPages} (${((cs.pagesWithReliabilityMetrics / cs.totalPages) * 100).toFixed(0)}%)`,
  );

  const lowCovMetrics = Object.entries(cs.metricPopulation)
    .filter(([, v]) => v.percentage < 50)
    .map(([k, v]) => `  ${k}: ${v.percentage.toFixed(0)}%`);
  if (lowCovMetrics.length > 0) {
    lines.push("Low-coverage metrics (<50%):");
    lines.push(...lowCovMetrics);
  }
  lines.push("");

  lines.push("=== Rankings Comparison ===");
  lines.push(`CWV vs Composite Correlation: ${report.statistics.correlation}`);
  lines.push(
    `Rank Flips: ${report.statistics.rankFlipCount} (${report.statistics.rankFlipPercentage}%)`,
  );
  lines.push("");

  if (report.rankings.rankFlips.length > 0) {
    lines.push("=== Top Rank Flips ===");
    report.rankings.rankFlips.slice(0, 5).forEach((flip) => {
      lines.push(
        `${flip.pageId}: CWV Rank ${flip.cvvRank} → Composite Rank ${flip.compositeRank} (Change: ${flip.rankChange > 0 ? "+" : ""}${flip.rankChange})`,
      );
    });
    lines.push("");
  }

  lines.push("=== CWV Rankings (Top 5) ===");
  report.rankings.cvv.slice(0, 5).forEach((ranking) => {
    lines.push(
      `${ranking.rank}. ${ranking.pageId} (Score: ${ranking.score.toFixed(2)})`,
    );
  });
  lines.push("");

  lines.push("=== Composite UX Rankings (Top 5) ===");
  report.rankings.composite.slice(0, 5).forEach((ranking) => {
    lines.push(
      `${ranking.rank}. ${ranking.pageId} (Score: ${ranking.score.toFixed(2)})`,
    );
  });

  if (report.runsArtifactPath) {
    lines.push("");
    lines.push(`Per-run data: ${report.runsArtifactPath}`);
  }

  return lines.join("\n");
}
