import { chromium, type Page } from "playwright";
import type { InteractionMetrics, ReliabilityMetrics } from "../types/metrics.js";
import type { PlaywrightConfig } from "../types/config.js";
import { writeJsonFile } from "../utils/file-utils.js";

export interface PlaywrightResult {
  interactionStability: InteractionMetrics;
  reliability: ReliabilityMetrics;
  raw: any;
}

export async function runPlaywrightTest(
  url: string,
  config: PlaywrightConfig,
  outputDir?: string
): Promise<PlaywrightResult> {
  const browser = await chromium.launch({
    headless: config.headless !== false,
  });

  try {
    const results: any[] = [];

    for (let run = 0; run < config.runs; run++) {
      const context = await browser.newContext({
        viewport: config.viewport || { width: 1920, height: 1080 },
      });

      const page = await context.newPage();

      const runResult = await performTestRun(page, url, config);
      results.push(runResult);

      await context.close();
    }

    const aggregatedResult = aggregateRuns(results);

    if (outputDir) {
      const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
      const filename = `playwright-${timestamp}.json`;
      await writeJsonFile(`${outputDir}/${filename}`, aggregatedResult);
    }

    const interactionStability: InteractionMetrics = {
      layoutShiftDuringInteractions: aggregatedResult.layoutShift,
      inputResponsiveness: aggregatedResult.inputResponsiveness,
      frameDropRate: aggregatedResult.animationSmoothness,
      interactionLatency: aggregatedResult.interactionLatency,
    };

    const reliability: ReliabilityMetrics = {
      errorRate: aggregatedResult.errorRate,
      networkFailureRecovery: aggregatedResult.networkFailureRecovery,
      resourceLoadSuccessRate: aggregatedResult.resourceLoadSuccessRate,
      serviceWorkerAvailable: aggregatedResult.serviceWorkerAvailable,
    };

    return {
      interactionStability,
      reliability,
      raw: aggregatedResult,
    };
  } finally {
    await browser.close();
  }
}

async function performTestRun(
  page: Page,
  url: string,
  config: PlaywrightConfig
): Promise<any> {
  const metrics: any = {
    layoutShifts: [],
    inputLatencies: [],
    networkRequests: [],
    consoleErrors: [],
    performanceEntries: [],
  };

  page.on("console", (msg) => {
    if (msg.type() === "error") {
      metrics.consoleErrors.push({
        text: msg.text(),
        type: msg.type(),
      });
    }
  });

  page.on("requestfailed", (request) => {
    metrics.networkRequests.push({
      url: request.url(),
      failure: request.failure()?.errorText || "unknown",
      method: request.method(),
    });
  });

  page.on("response", (response) => {
    metrics.networkRequests.push({
      url: response.url(),
      status: response.status(),
      method: response.request().method(),
    });
  });

  const cdpSession = await page.context().newCDPSession(page);
  await cdpSession.send("Performance.enable");
  await cdpSession.send("Page.enable");

  const startTime = Date.now();

  await page.goto(url, {
    waitUntil: "networkidle",
    timeout: config.timeout || 30000,
  });

  await page.waitForTimeout(2000);

  if (config.interactions) {
    for (const interaction of config.interactions) {
      await performInteraction(page, interaction, metrics);
    }
  } else {
    await performDefaultInteractions(page, metrics);
  }

  const performanceMetrics = await cdpSession.send("Performance.getMetrics");
  const layoutShiftEntries = await page.evaluate(() => {
    return new Promise((resolve) => {
      try {
        const observer = new PerformanceObserver((list) => {
          const entries = Array.from(list.getEntries());
          resolve(
            entries.map((entry: any) => ({
              value: entry.value,
              hadRecentInput: entry.hadRecentInput,
            }))
          );
        });
        observer.observe({ type: "layout-shift", buffered: true });
        setTimeout(() => {
          observer.disconnect();
          resolve([]);
        }, 1000);
      } catch (error) {
        resolve([]);
      }
    });
  });

  metrics.layoutShifts = layoutShiftEntries as any[];
  metrics.performanceMetrics = performanceMetrics.metrics;

  const endTime = Date.now();
  metrics.totalTime = endTime - startTime;

  const serviceWorkerAvailable = await page.evaluate(() => {
    return "serviceWorker" in navigator;
  });

  return {
    ...metrics,
    serviceWorkerAvailable,
  };
}

async function performInteraction(
  page: Page,
  interaction: { type: string; selector?: string; text?: string },
  metrics: any
): Promise<void> {
  const startTime = Date.now();

  try {
    if (interaction.type === "click" && interaction.selector) {
      await page.click(interaction.selector);
    } else if (interaction.type === "type" && interaction.selector && interaction.text) {
      await page.fill(interaction.selector, interaction.text);
    } else if (interaction.type === "scroll") {
      await page.evaluate(() => window.scrollBy(0, 500));
    }

    const endTime = Date.now();
    metrics.inputLatencies.push(endTime - startTime);

    await page.waitForTimeout(500);
  } catch (error) {
    console.warn(`Interaction failed: ${interaction.type}`, error);
  }
}

async function performDefaultInteractions(page: Page, metrics: any): Promise<void> {
  await page.waitForTimeout(1000);

  const clickableElements = await page.$$("button, a, input[type='button'], input[type='submit']");
  if (clickableElements.length > 0) {
    await performInteraction(
      page,
      { type: "click", selector: "button, a" },
      metrics
    );
  }

  await page.evaluate(() => window.scrollBy(0, 500));
  await page.waitForTimeout(500);

  const inputs = await page.$$("input[type='text'], input[type='email'], textarea");
  if (inputs.length > 0) {
    await performInteraction(
      page,
      { type: "type", selector: "input[type='text'], textarea", text: "test" },
      metrics
    );
  }
}

function aggregateRuns(runs: any[]): any {
  if (runs.length === 0) {
    return {
      layoutShift: null,
      inputResponsiveness: null,
      animationSmoothness: null,
      interactionLatency: null,
      errorRate: null,
      networkFailureRecovery: null,
      resourceLoadSuccessRate: null,
      serviceWorkerAvailable: null,
    };
  }

  const allLayoutShifts = runs.flatMap((r) => r.layoutShifts || []);
  const layoutShift = allLayoutShifts.reduce((sum, entry: any) => {
    return sum + (entry.value || 0);
  }, 0);

  const allInputLatencies = runs.flatMap((r) => r.inputLatencies || []);
  const avgInputLatency =
    allInputLatencies.length > 0
      ? allInputLatencies.reduce((sum, lat) => sum + lat, 0) / allInputLatencies.length
      : null;

  const allNetworkRequests = runs.flatMap((r) => r.networkRequests || []);
  const failedRequests = allNetworkRequests.filter(
    (req: any) => req.failure || (req.status && req.status >= 400)
  );
  const successfulRequests = allNetworkRequests.filter(
    (req: any) => !req.failure && req.status && req.status >= 200 && req.status < 400
  );

  const allConsoleErrors = runs.flatMap((r) => r.consoleErrors || []);
  const totalConsoleMessages = runs.reduce(
    (sum, r) => sum + (r.consoleErrors?.length || 0),
    0
  );

  const serviceWorkerAvailable = runs.some((r) => r.serviceWorkerAvailable);

  const performanceMetrics = runs[0]?.performanceMetrics || [];
  const fpsMetric = performanceMetrics.find((m: any) => m.name === "FramesPerSecond");
  const animationSmoothness = fpsMetric ? fpsMetric.value : null;

  const errorRate =
    totalConsoleMessages > 0
      ? (allConsoleErrors.length / totalConsoleMessages) * 100
      : null;

  const resourceLoadSuccessRate =
    allNetworkRequests.length > 0
      ? (successfulRequests.length / allNetworkRequests.length) * 100
      : null;

  const networkFailureRecovery =
    failedRequests.length > 0
      ? ((failedRequests.length - failedRequests.filter((r: any) => r.retries > 0).length) /
          failedRequests.length) *
        100
      : failedRequests.length === 0
        ? 100
        : null;

  return {
    layoutShift: layoutShift > 0 ? layoutShift : null,
    inputResponsiveness: avgInputLatency,
    animationSmoothness,
    interactionLatency: avgInputLatency,
    errorRate,
    networkFailureRecovery,
    resourceLoadSuccessRate,
    serviceWorkerAvailable: serviceWorkerAvailable || null,
    runs: runs.length,
  };
}
