import type { PageConfig, BenchmarkConfig } from "../types/config.js";
import type { PageBenchmark } from "../types/report.js";
import { runLighthouse } from "../collectors/lighthouse-runner.js";
import { runPlaywrightTest } from "../collectors/playwright-runner.js";
import { collectCrUXData } from "../collectors/crux-collector.js";
import { aggregateMetrics, validateDataCompleteness } from "./metrics-collector.js";
import { normalizeMetrics } from "./normalizer.js";
import { calculateCompositeScore, validateWeights } from "./composite-engine.js";
import { ensureDirExists } from "../utils/file-utils.js";
import ora from "ora";

export interface OrchestratorOptions {
  outputDir?: string;
  skipWebPageTest?: boolean;
  skipCrUX?: boolean;
}

export async function runBenchmark(
  page: PageConfig,
  config: BenchmarkConfig,
  options: OrchestratorOptions = {}
): Promise<PageBenchmark> {
  const spinner = ora(`Benchmarking ${page.name} (${page.url})`).start();

  try {
    const outputDir = options.outputDir
      ? `${options.outputDir}/raw`
      : undefined;

    if (outputDir) {
      await ensureDirExists(outputDir);
    }

    spinner.text = `Running Lighthouse for ${page.name}...`;
    const lighthouseResult = await runLighthouse(
      page.url,
      config.lighthouse,
      outputDir
    );

    let playwrightResult;
    if (!options.skipWebPageTest) {
      spinner.text = `Running Playwright test for ${page.name}...`;
      try {
        playwrightResult = await runPlaywrightTest(
          page.url,
          config.playwright,
          outputDir
        );
      } catch (error: any) {
        spinner.warn(`Playwright test failed for ${page.name}: ${error.message}`);
      }
    }

    let cruxResult;
    if (!options.skipCrUX) {
      spinner.text = `Collecting CrUX data for ${page.name}...`;
      try {
        const origin = new URL(page.url).origin;
        cruxResult = await collectCrUXData(origin, outputDir);
      } catch (error: any) {
        spinner.warn(`CrUX collection failed for ${page.name}: ${error.message}`);
      }
    }

    spinner.text = `Processing metrics for ${page.name}...`;
    const collectedMetrics = {
      lighthouse: lighthouseResult,
      webpagetest: playwrightResult,
      crux: cruxResult || undefined,
    };

    const normalizedMetrics = aggregateMetrics(collectedMetrics);
    const validation = validateDataCompleteness(normalizedMetrics);

    if (!validation.isComplete) {
      spinner.warn(
        `Incomplete data for ${page.name}: Missing ${validation.missingFields.join(", ")}. This is normal if: CLS=0 (no shifts), no user interactions occurred, or no console messages were captured.`
      );
    }

    const normalizedScores = normalizeMetrics(normalizedMetrics);

    if (!validateWeights(config.compositeWeights)) {
      throw new Error("Composite weights must sum to 1.0");
    }

    const compositeScores = calculateCompositeScore(
      normalizedScores,
      config.compositeWeights
    );

    spinner.succeed(`Completed benchmark for ${page.name}`);

    return {
      pageId: page.id,
      url: page.url,
      metrics: {
        cvv: normalizedMetrics.cvv,
        interactionStability: normalizedMetrics.interactionStability,
        accessibility: normalizedMetrics.accessibility,
        reliability: normalizedMetrics.reliability,
      },
      scores: compositeScores,
    };
  } catch (error: any) {
    spinner.fail(`Failed to benchmark ${page.name}: ${error.message}`);
    throw error;
  }
}

export async function runBenchmarks(
  pages: PageConfig[],
  config: BenchmarkConfig,
  options: OrchestratorOptions = {}
): Promise<PageBenchmark[]> {
  const results: PageBenchmark[] = [];

  for (const page of pages) {
    try {
      const result = await runBenchmark(page, config, options);
      results.push(result);
    } catch (error: any) {
      console.error(`Skipping ${page.id} due to error:`, error.message);
    }
  }

  return results;
}

