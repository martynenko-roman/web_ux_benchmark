import type { PageConfig, BenchmarkConfig } from "../types/config.js";
import type { PageBenchmark } from "../types/report.js";
import type { StageStatus, PerRunMetrics } from "../types/metrics.js";
import { runLighthouse } from "../collectors/lighthouse-runner.js";
import { runPlaywrightTest } from "../collectors/playwright-runner.js";
import { collectCrUXData } from "../collectors/crux-collector.js";
import { aggregateMetrics, computePageCoverage, validateDataCompleteness } from "./metrics-collector.js";
import { normalizeMetrics } from "./normalizer.js";
import { calculateCompositeScore, validateWeights } from "./composite-engine.js";
import { ensureDirExists } from "../utils/file-utils.js";
import type { PageRunData } from "./report-generator.js";
import ora from "ora";

export interface OrchestratorOptions {
  outputDir?: string;
  skipWebPageTest?: boolean;
  skipCrUX?: boolean;
}

export interface PageBenchmarkWithRuns {
  benchmark: PageBenchmark;
  runData: PageRunData | null;
}

export async function runBenchmark(
  page: PageConfig,
  config: BenchmarkConfig,
  options: OrchestratorOptions = {},
): Promise<PageBenchmarkWithRuns> {
  const spinner = ora(`Benchmarking ${page.name} (${page.url})`).start();
  const stages: StageStatus[] = [];
  const coveragePenalty = config.coveragePenaltyFactor ?? 0.5;

  try {
    const outputDir = options.outputDir ? `${options.outputDir}/raw` : undefined;
    if (outputDir) await ensureDirExists(outputDir);

    let lighthouseResult;
    const lhStart = Date.now();
    spinner.text = `Running Lighthouse for ${page.name}...`;
    try {
      lighthouseResult = await runLighthouse(page.url, config.lighthouse, outputDir);
      stages.push({
        stage: "lighthouse",
        success: true,
        durationMs: Date.now() - lhStart,
      });
    } catch (error: any) {
      stages.push({
        stage: "lighthouse",
        success: false,
        failureReason: error.message,
        durationMs: Date.now() - lhStart,
      });
      spinner.warn(`Lighthouse failed for ${page.name}: ${error.message}`);
    }

    let playwrightResult;
    let perRunMetrics: PerRunMetrics[] = [];
    if (!options.skipWebPageTest) {
      const pwStart = Date.now();
      spinner.text = `Running Playwright test for ${page.name}...`;
      try {
        playwrightResult = await runPlaywrightTest(page.url, config.playwright, outputDir);
        perRunMetrics = playwrightResult.perRunMetrics;

        const hasInteractionData =
          playwrightResult.interactionStability.inputResponsiveness !== null ||
          playwrightResult.interactionStability.interactionLatency !== null;

        stages.push({
          stage: "playwright",
          success: true,
          failureReason: !hasInteractionData
            ? `Interactions failed: ${playwrightResult.interactionFailures.join("; ")}`
            : undefined,
          durationMs: Date.now() - pwStart,
        });
      } catch (error: any) {
        stages.push({
          stage: "playwright",
          success: false,
          failureReason: error.message,
          durationMs: Date.now() - pwStart,
        });
        spinner.warn(`Playwright test failed for ${page.name}: ${error.message}`);
      }
    }

    let cruxResult;
    if (!options.skipCrUX) {
      const cruxStart = Date.now();
      spinner.text = `Collecting CrUX data for ${page.name}...`;
      try {
        const origin = new URL(page.url).origin;
        cruxResult = await collectCrUXData(origin, outputDir);
        stages.push({
          stage: "crux",
          success: cruxResult !== null,
          failureReason: cruxResult === null ? "No CrUX data available" : undefined,
          durationMs: Date.now() - cruxStart,
        });
      } catch (error: any) {
        stages.push({
          stage: "crux",
          success: false,
          failureReason: error.message,
          durationMs: Date.now() - cruxStart,
        });
        spinner.warn(`CrUX collection failed for ${page.name}: ${error.message}`);
      }
    }

    spinner.text = `Processing metrics for ${page.name}...`;
    const collectedMetrics = {
      lighthouse: lighthouseResult,
      playwright: playwrightResult,
      crux: cruxResult || undefined,
    };

    const normalizedMetrics = aggregateMetrics(collectedMetrics);
    const coverage = computePageCoverage(normalizedMetrics);
    const validation = validateDataCompleteness(normalizedMetrics);

    if (!validation.isComplete) {
      spinner.warn(
        `Incomplete data for ${page.name}: Missing ${validation.missingFields.length} metric(s).`,
      );
    }

    const normalizedScores = normalizeMetrics(normalizedMetrics);

    if (!validateWeights(config.compositeWeights)) {
      throw new Error("Composite weights must sum to 1.0");
    }

    const compositeScores = calculateCompositeScore(
      normalizedScores,
      config.compositeWeights,
      coverage,
      coveragePenalty,
    );

    spinner.succeed(
      `Completed ${page.name} — coverage: ${coverage.overall.percentage.toFixed(0)}%, composite: ${compositeScores.composite}`,
    );

    const benchmark: PageBenchmark = {
      pageId: page.id,
      url: page.url,
      metrics: {
        cvv: normalizedMetrics.cvv,
        interactionStability: normalizedMetrics.interactionStability,
        accessibility: normalizedMetrics.accessibility,
        reliability: normalizedMetrics.reliability,
      },
      scores: compositeScores,
      diagnostics: { stages, coverage },
      coverage,
    };

    const runData: PageRunData | null =
      perRunMetrics.length > 0
        ? { pageId: page.id, url: page.url, runs: perRunMetrics }
        : null;

    return { benchmark, runData };
  } catch (error: any) {
    spinner.fail(`Failed to benchmark ${page.name}: ${error.message}`);
    throw error;
  }
}

export async function runBenchmarks(
  pages: PageConfig[],
  config: BenchmarkConfig,
  options: OrchestratorOptions = {},
): Promise<{ benchmarks: PageBenchmark[]; allRunData: PageRunData[] }> {
  const benchmarks: PageBenchmark[] = [];
  const allRunData: PageRunData[] = [];

  for (const page of pages) {
    try {
      const { benchmark, runData } = await runBenchmark(page, config, options);
      benchmarks.push(benchmark);
      if (runData) allRunData.push(runData);
    } catch (error: any) {
      console.error(`Skipping ${page.id} due to error:`, error.message);
    }
  }

  return { benchmarks, allRunData };
}
