import type { BenchmarkReport, PageBenchmark } from "../types/report.js";
import type { ComparisonResult } from "./comparator.js";
import { writeJsonFile } from "../utils/file-utils.js";

export async function generateReport(
  pages: PageBenchmark[],
  comparison: ComparisonResult,
  outputPath: string
): Promise<void> {
  const report: BenchmarkReport = {
    metadata: {
      timestamp: new Date().toISOString(),
      version: "1.0.0",
      pages: pages.map((p) => p.pageId),
    },
    pages,
    rankings: {
      cvv: comparison.cvvRankings,
      composite: comparison.compositeRankings,
      rankFlips: comparison.rankFlips,
    },
    statistics: comparison.statistics,
  };

  await writeJsonFile(outputPath, report);
}

export function generateSummary(report: BenchmarkReport): string {
  const lines: string[] = [];

  lines.push("=== Web UX Benchmark Report ===");
  lines.push(`Timestamp: ${report.metadata.timestamp}`);
  lines.push(`Pages Analyzed: ${report.pages.length}`);
  lines.push("");

  lines.push("=== Rankings Comparison ===");
  lines.push(`CWV vs Composite Correlation: ${report.statistics.correlation}`);
  lines.push(
    `Rank Flips: ${report.statistics.rankFlipCount} (${report.statistics.rankFlipPercentage}%)`
  );
  lines.push("");

  if (report.rankings.rankFlips.length > 0) {
    lines.push("=== Top Rank Flips ===");
    report.rankings.rankFlips
      .slice(0, 5)
      .forEach((flip) => {
        lines.push(
          `${flip.pageId}: CWV Rank ${flip.cvvRank} → Composite Rank ${flip.compositeRank} (Change: ${flip.rankChange > 0 ? "+" : ""}${flip.rankChange})`
        );
      });
    lines.push("");
  }

  lines.push("=== CWV Rankings ===");
  report.rankings.cvv.slice(0, 5).forEach((ranking) => {
    lines.push(`${ranking.rank}. ${ranking.pageId} (Score: ${ranking.score.toFixed(2)})`);
  });
  lines.push("");

  lines.push("=== Composite UX Rankings ===");
  report.rankings.composite.slice(0, 5).forEach((ranking) => {
    lines.push(`${ranking.rank}. ${ranking.pageId} (Score: ${ranking.score.toFixed(2)})`);
  });

  return lines.join("\n");
}

