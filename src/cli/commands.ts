import { Command } from "commander";
import chalk from "chalk";
import ora from "ora";
import { readJsonFile } from "../utils/file-utils.js";
import type { PagesConfig, BenchmarkConfig } from "../types/config.js";
import { runBenchmarks } from "../core/orchestrator.js";
import { compareRankings } from "../core/comparator.js";
import { generateReport, generateSummary } from "../core/report-generator.js";
import { ensureDirExists } from "../utils/file-utils.js";
import path from "path";

export function createBenchmarkCommand(): Command {
  const command = new Command("benchmark");

  command
    .description("Run benchmarks on configured pages")
    .option("-p, --page <pageId>", "Run benchmark on specific page only")
    .option(
      "-c, --config <path>",
      "Path to benchmark config file",
      "config/benchmark.json",
    )
    .option(
      "--pages-config <path>",
      "Path to pages config file",
      "config/pages.json",
    )
    .option("-o, --output <dir>", "Output directory", "data")
    .option("--skip-playwright", "Skip Playwright test collection")
    .option("--skip-crux", "Skip CrUX data collection")
    .action(async (options) => {
      const spinner = ora("Loading configuration...").start();

      try {
        const pagesConfig = await readJsonFile<PagesConfig>(options.pagesConfig);
        const benchmarkConfig = await readJsonFile<BenchmarkConfig>(options.config);

        spinner.succeed("Configuration loaded");

        let pages = pagesConfig.pages;
        if (options.page) {
          pages = pages.filter((p) => p.id === options.page);
          if (pages.length === 0) {
            console.error(chalk.red(`Page "${options.page}" not found`));
            process.exit(1);
          }
        }

        console.log(chalk.blue(`\nBenchmarking ${pages.length} page(s)...\n`));

        const outputDir = path.resolve(options.output);
        await ensureDirExists(outputDir);

        const { benchmarks: results, allRunData } = await runBenchmarks(
          pages,
          benchmarkConfig,
          {
            outputDir,
            skipWebPageTest: options.skipPlaywright,
            skipCrUX: options.skipCrux,
          },
        );

        if (results.length === 0) {
          console.error(chalk.red("No benchmarks completed successfully"));
          process.exit(1);
        }

        const comparison = compareRankings(results);

        const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
        const reportPath = path.join(outputDir, "reports", `report-${timestamp}.json`);
        await ensureDirExists(path.join(outputDir, "reports"));

        const coveragePenaltyFactor = benchmarkConfig.coveragePenaltyFactor ?? 0.5;

        const runsPath = await generateReport(
          results,
          comparison,
          reportPath,
          {
            compositeWeights: benchmarkConfig.compositeWeights,
            coveragePenaltyFactor,
            playwrightRuns: benchmarkConfig.playwright.runs,
          },
          allRunData,
        );

        console.log(chalk.green(`\n✓ Report generated: ${reportPath}`));
        if (runsPath) {
          console.log(chalk.green(`✓ Per-run data: ${runsPath}`));
        }
        console.log("");

        const report = {
          metadata: {
            timestamp: new Date().toISOString(),
            reportVersion: 2,
            toolVersion: "2.0.0",
            pages: results.map((r) => r.pageId),
            config: {
              compositeWeights: benchmarkConfig.compositeWeights as unknown as Record<string, number>,
              coveragePenaltyFactor,
              playwrightRuns: benchmarkConfig.playwright.runs,
            },
          },
          pages: results,
          rankings: {
            cvv: comparison.cvvRankings,
            composite: comparison.compositeRankings,
            rankFlips: comparison.rankFlips,
          },
          statistics: comparison.statistics,
          coverageSummary: {
            totalPages: results.length,
            pagesWithInteractionMetrics: results.filter(
              (p) => p.coverage.interactionStability.available > 0,
            ).length,
            pagesWithReliabilityMetrics: results.filter(
              (p) => p.coverage.reliability.available > 0,
            ).length,
            metricPopulation: {},
            averageCoveragePercentage:
              results.length > 0
                ? results.reduce((s, p) => s + p.coverage.overall.percentage, 0) /
                  results.length
                : 0,
          },
          runsArtifactPath: runsPath,
        };

        console.log(generateSummary(report));
      } catch (error: any) {
        spinner.fail("Benchmark failed");
        console.error(chalk.red(`Error: ${error.message}`));
        if (error.stack) {
          console.error(error.stack);
        }
        process.exit(1);
      }
    });

  return command;
}

export function createReportCommand(): Command {
  const command = new Command("report");

  command
    .description("Generate report from existing normalized data")
    .option(
      "-i, --input <dir>",
      "Input directory with normalized data",
      "data/normalized",
    )
    .option(
      "-o, --output <path>",
      "Output report path",
      "data/reports/report.json",
    )
    .action(async () => {
      console.log(
        chalk.yellow("Report generation from normalized data not yet implemented"),
      );
      console.log(chalk.blue("Use the benchmark command to generate reports"));
    });

  return command;
}

export function createCompareCommand(): Command {
  const command = new Command("compare");

  command
    .description("Compare two benchmark reports")
    .requiredOption("-b, --baseline <path>", "Path to baseline report")
    .requiredOption("-c, --current <path>", "Path to current report")
    .action(async (options) => {
      try {
        const baseline = await readJsonFile<any>(options.baseline);
        const current = await readJsonFile<any>(options.current);

        console.log(chalk.blue("\n=== Comparison Report ===\n"));

        console.log(chalk.yellow("Baseline:"), options.baseline);
        console.log(`  Timestamp: ${baseline.metadata.timestamp}`);
        console.log(`  Pages: ${baseline.pages.length}`);
        console.log(
          `  Version: ${baseline.metadata.reportVersion || baseline.metadata.version}`,
        );

        console.log(chalk.yellow("\nCurrent:"), options.current);
        console.log(`  Timestamp: ${current.metadata.timestamp}`);
        console.log(`  Pages: ${current.pages.length}`);
        console.log(
          `  Version: ${current.metadata.reportVersion || current.metadata.version}`,
        );

        console.log(chalk.yellow("\nStatistics Comparison:"));
        console.log(
          `  Correlation: ${baseline.statistics.correlation} → ${current.statistics.correlation}`,
        );
        console.log(
          `  Rank Flips: ${baseline.statistics.rankFlipCount} → ${current.statistics.rankFlipCount}`,
        );

        if (current.coverageSummary) {
          console.log(chalk.yellow("\nCoverage (Current):"));
          console.log(
            `  Average: ${current.coverageSummary.averageCoveragePercentage.toFixed(1)}%`,
          );
          console.log(
            `  Interaction pages: ${current.coverageSummary.pagesWithInteractionMetrics}/${current.coverageSummary.totalPages}`,
          );
          console.log(
            `  Reliability pages: ${current.coverageSummary.pagesWithReliabilityMetrics}/${current.coverageSummary.totalPages}`,
          );
        }

        console.log(chalk.green("\n✓ Comparison complete"));
      } catch (error: any) {
        console.error(chalk.red(`Error: ${error.message}`));
        process.exit(1);
      }
    });

  return command;
}
