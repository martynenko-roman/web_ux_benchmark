import { chromium, type Page, type ElementHandle } from "playwright";
import type { InteractionMetrics, ReliabilityMetrics, PerRunMetrics } from "../types/metrics.js";
import type { PlaywrightConfig } from "../types/config.js";
import { writeJsonFile } from "../utils/file-utils.js";

export interface PlaywrightResult {
  interactionStability: InteractionMetrics;
  reliability: ReliabilityMetrics;
  inpProxy: number | null;
  perRunMetrics: PerRunMetrics[];
  raw: any;
  interactionFailures: string[];
}

export async function runPlaywrightTest(
  url: string,
  config: PlaywrightConfig,
  outputDir?: string,
): Promise<PlaywrightResult> {
  const browser = await chromium.launch({
    headless: config.headless !== false,
  });

  try {
    const results: RunResult[] = [];
    const interactionFailures: string[] = [];

    for (let run = 0; run < config.runs; run++) {
      const context = await browser.newContext({
        viewport: config.viewport || { width: 1920, height: 1080 },
      });

      const page = await context.newPage();

      try {
        const runResult = await performTestRun(page, url, config);
        results.push(runResult);
        interactionFailures.push(...runResult.interactionFailures);
      } catch (error: any) {
        interactionFailures.push(`Run ${run}: ${error.message}`);
      }

      await context.close();
    }

    const aggregated = aggregateRuns(results);

    if (outputDir) {
      const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
      const filename = `playwright-${timestamp}.json`;
      await writeJsonFile(`${outputDir}/${filename}`, aggregated);
    }

    const interactionStability: InteractionMetrics = {
      layoutShiftDuringInteractions: aggregated.layoutShift,
      inputResponsiveness: aggregated.inputResponsiveness,
      frameDropRate: aggregated.frameDropRate,
      interactionLatency: aggregated.interactionLatency,
    };

    const reliability: ReliabilityMetrics = {
      errorRate: aggregated.errorRate,
      networkFailureRecovery: aggregated.networkFailureRecovery,
      resourceLoadSuccessRate: aggregated.resourceLoadSuccessRate,
      serviceWorkerAvailable: aggregated.serviceWorkerAvailable,
    };

    const perRunMetrics: PerRunMetrics[] = results.map((r, i) => ({
      run: i,
      layoutShifts: r.layoutShiftValue,
      inputLatencies: r.inputLatencies,
      inpProxyValues: r.inpProxyValues,
      frameDropRate: r.frameDropRate,
      consoleErrorCount: r.consoleErrors.length,
      totalConsoleMessageCount: r.totalConsoleMessages,
      networkRequestCount: r.networkRequests.length,
      failedRequestCount: r.networkRequests.filter(
        (req: any) => req.failure || (req.status && req.status >= 400),
      ).length,
      successfulRequestCount: r.networkRequests.filter(
        (req: any) => !req.failure && req.status && req.status >= 200 && req.status < 400,
      ).length,
      serviceWorkerAvailable: r.serviceWorkerAvailable,
      totalTimeMs: r.totalTime,
    }));

    return {
      interactionStability,
      reliability,
      inpProxy: aggregated.inpProxy,
      perRunMetrics,
      raw: aggregated,
      interactionFailures: [...new Set(interactionFailures)],
    };
  } finally {
    await browser.close();
  }
}

interface RunResult {
  layoutShifts: any[];
  layoutShiftValue: number;
  inputLatencies: number[];
  inpProxyValues: number[];
  frameDropRate: number | null;
  networkRequests: any[];
  consoleErrors: any[];
  totalConsoleMessages: number;
  performanceMetrics: any[];
  serviceWorkerAvailable: boolean;
  totalTime: number;
  interactionFailures: string[];
}

// ─── Overlay / modal / cookie banner dismissal ───

const COMMON_COOKIE_SELECTORS = [
  "[id*='cookie'] button",
  "[class*='cookie'] button",
  "[id*='consent'] button",
  "[class*='consent'] button",
  "[id*='gdpr'] button",
  "[class*='gdpr'] button",
  "[aria-label*='cookie' i]",
  "[aria-label*='accept' i]",
  "button:has-text('Accept')",
  "button:has-text('Accept All')",
  "button:has-text('Accept Cookies')",
  "button:has-text('I agree')",
  "button:has-text('OK')",
  "button:has-text('Got it')",
  "button:has-text('Agree')",
  "button:has-text('Continue')",
];

const BLOCKING_OVERLAY_SELECTORS = [
  "[class*='modal__mask']",
  "[class*='overlay'][class*='modal']",
  "[class*='dialog__snap']",
  "[data-testid*='modal']",
  "[class*='consent-banner']",
  "[class*='cookie-banner']",
  "[id*='onetrust']",
  "[class*='onetrust']",
];

async function dismissOverlays(page: Page): Promise<boolean> {
  // Try clicking cookie/consent buttons first
  for (const selector of COMMON_COOKIE_SELECTORS) {
    try {
      const element = await page.$(selector);
      if (element && await element.isVisible()) {
        await element.click({ timeout: 2000 });
        await page.waitForTimeout(500);
        return true;
      }
    } catch {
      // try next
    }
  }

  // Try Escape key to dismiss modals/dialogs
  try {
    await page.keyboard.press("Escape");
    await page.waitForTimeout(300);
  } catch {
    // ignore
  }

  // Force-hide blocking overlays that intercept pointer events
  for (const selector of BLOCKING_OVERLAY_SELECTORS) {
    try {
      const overlay = await page.$(selector);
      if (overlay && await overlay.isVisible()) {
        await overlay.evaluate((el: any) => {
          el.style.display = "none";
          el.style.pointerEvents = "none";
        });
        return true;
      }
    } catch {
      // try next
    }
  }

  return false;
}

// ─── INP proxy measurement ───

async function measureInpProxyViaHandle(
  _page: Page,
  handle: ElementHandle,
  action: "click" | "type",
): Promise<number | null> {
  try {
    const delay = await handle.evaluate((el: any, act: string) => {
      return new Promise<number>((resolve) => {
        const start = performance.now();
        if (act === "click") {
          el.dispatchEvent(new MouseEvent("pointerdown", { bubbles: true }));
          el.dispatchEvent(new MouseEvent("mousedown", { bubbles: true }));
        } else {
          el.dispatchEvent(new InputEvent("input", { bubbles: true }));
        }
        requestAnimationFrame(() => {
          resolve(performance.now() - start);
        });
      });
    }, action);
    return typeof delay === "number" && delay >= 0 ? delay : null;
  } catch {
    return null;
  }
}

// ─── Frame drop rate measurement via CDP ───

interface CdpMetricSnapshot {
  timestamp: number;
  frames: number;
  layoutCount: number;
  layoutDuration: number;
  taskDuration: number;
}

function extractCdpSnapshot(metrics: Array<{ name: string; value: number }>): CdpMetricSnapshot {
  const get = (name: string) =>
    metrics.find((m) => m.name === name)?.value ?? 0;
  return {
    timestamp: get("Timestamp"),
    frames: get("Frames"),
    layoutCount: get("LayoutCount"),
    layoutDuration: get("LayoutDuration"),
    taskDuration: get("TaskDuration"),
  };
}

function computeFrameDropRate(
  before: CdpMetricSnapshot,
  after: CdpMetricSnapshot,
): number | null {
  const elapsedSec = after.timestamp - before.timestamp;
  if (elapsedSec <= 0) return null;

  const framesDelta = after.frames - before.frames;
  if (framesDelta <= 0) {
    const taskDelta = after.taskDuration - before.taskDuration;
    const busyRatio = elapsedSec > 0 ? (taskDelta / elapsedSec) * 100 : 0;
    return Math.min(busyRatio, 100);
  }

  const actualFps = framesDelta / elapsedSec;
  const targetFps = 60;
  const dropRate = Math.max(0, ((targetFps - actualFps) / targetFps) * 100);
  return Math.min(dropRate, 100);
}

// ─── Navigation with fallback ───

async function navigateWithFallback(
  page: Page,
  url: string,
  timeout: number,
): Promise<void> {
  // Use 'load' as baseline — always fires. 'networkidle' hangs on ad-heavy sites.
  try {
    await page.goto(url, { waitUntil: "load", timeout });
  } catch {
    // 'load' timed out — try domcontentloaded as last resort
    await page.goto(url, { waitUntil: "domcontentloaded", timeout });
  }
  // Post-load settle: give deferred scripts and lazy-loaded content time to appear
  await page.waitForTimeout(3000);
}

// ─── Test run ───

async function performTestRun(
  page: Page,
  url: string,
  config: PlaywrightConfig,
): Promise<RunResult> {
  const consoleErrors: any[] = [];
  let totalConsoleMessages = 0;
  const networkRequests: any[] = [];
  const inputLatencies: number[] = [];
  const inpProxyValues: number[] = [];
  const interactionFailures: string[] = [];

  page.on("console", (msg) => {
    totalConsoleMessages++;
    if (msg.type() === "error") {
      consoleErrors.push({ text: msg.text(), type: msg.type() });
    }
  });

  page.on("requestfailed", (request) => {
    networkRequests.push({
      url: request.url(),
      failure: request.failure()?.errorText || "unknown",
      method: request.method(),
    });
  });

  page.on("response", (response) => {
    networkRequests.push({
      url: response.url(),
      status: response.status(),
      method: response.request().method(),
    });
  });

  const cdpSession = await page.context().newCDPSession(page);
  await cdpSession.send("Performance.enable");
  await cdpSession.send("Page.enable");

  const startTime = Date.now();

  await navigateWithFallback(page, url, config.timeout || 30000);

  await dismissOverlays(page);

  // Snapshot CDP metrics BEFORE interactions
  const preMetrics = extractCdpSnapshot(
    (await cdpSession.send("Performance.getMetrics")).metrics,
  );

  if (config.interactions) {
    for (const interaction of config.interactions) {
      const result = await performInteraction(page, interaction, inputLatencies, inpProxyValues);
      if (result.failure) interactionFailures.push(result.failure);
    }
  } else {
    const failures = await performDefaultInteractions(page, inputLatencies, inpProxyValues);
    interactionFailures.push(...failures);
  }

  // Snapshot CDP metrics AFTER interactions
  const postMetrics = extractCdpSnapshot(
    (await cdpSession.send("Performance.getMetrics")).metrics,
  );
  const frameDropRate = computeFrameDropRate(preMetrics, postMetrics);

  const layoutShiftEntries = await page.evaluate(() => {
    return new Promise((resolve) => {
      try {
        const entries: any[] = [];
        const observer = new PerformanceObserver((list) => {
          entries.push(
            ...Array.from(list.getEntries()).map((entry: any) => ({
              value: entry.value,
              hadRecentInput: entry.hadRecentInput,
            })),
          );
        });
        observer.observe({ type: "layout-shift", buffered: true });
        setTimeout(() => {
          observer.disconnect();
          resolve(entries);
        }, 1000);
      } catch {
        resolve([]);
      }
    });
  }) as any[];

  const performanceMetrics = await cdpSession.send("Performance.getMetrics");

  const endTime = Date.now();

  const serviceWorkerAvailable = await page.evaluate(() => {
    return "serviceWorker" in navigator;
  });

  const layoutShiftValue = layoutShiftEntries.reduce(
    (sum, entry: any) => sum + (entry.value || 0),
    0,
  );

  return {
    layoutShifts: layoutShiftEntries,
    layoutShiftValue,
    inputLatencies,
    inpProxyValues,
    frameDropRate,
    networkRequests,
    consoleErrors,
    totalConsoleMessages,
    performanceMetrics: performanceMetrics.metrics,
    serviceWorkerAvailable,
    totalTime: endTime - startTime,
    interactionFailures,
  };
}

// ─── Interactions ───

interface InteractionResult {
  failure: string | null;
}

async function performInteraction(
  page: Page,
  interaction: { type: string; selector?: string; text?: string },
  inputLatencies: number[],
  inpProxyValues: number[],
): Promise<InteractionResult> {
  const startTime = Date.now();

  try {
    if (interaction.type === "click" && interaction.selector) {
      const handle = await page.$(interaction.selector);
      if (handle) {
        const inp = await measureInpProxyViaHandle(page, handle, "click");
        if (inp !== null) inpProxyValues.push(inp);
      }
      await page.click(interaction.selector, { timeout: 5000 });
    } else if (interaction.type === "type" && interaction.selector && interaction.text) {
      const handle = await page.$(interaction.selector);
      if (handle) {
        const inp = await measureInpProxyViaHandle(page, handle, "type");
        if (inp !== null) inpProxyValues.push(inp);
      }
      await page.fill(interaction.selector, interaction.text, { timeout: 5000 });
    } else if (interaction.type === "scroll") {
      await page.evaluate(() => window.scrollBy(0, 500));
    }

    inputLatencies.push(Date.now() - startTime);
    await page.waitForTimeout(300);
    return { failure: null };
  } catch (error: any) {
    return { failure: `${interaction.type}(${interaction.selector || "page"}): ${error.message}` };
  }
}

async function performDefaultInteractions(
  page: Page,
  inputLatencies: number[],
  inpProxyValues: number[],
): Promise<string[]> {
  const failures: string[] = [];
  await page.waitForTimeout(1000);

  // 1. Try text inputs
  try {
    const inputs = await page.$$(
      "input[type='text']:visible, input[type='search']:visible, input[type='email']:visible, textarea:visible",
    );
    if (inputs.length > 0) {
      const input = inputs[0];
      const inp = await measureInpProxyViaHandle(page, input, "type");
      if (inp !== null) inpProxyValues.push(inp);
      const startTime = Date.now();
      await input.click({ timeout: 5000 });
      await input.fill("test", { timeout: 5000 });
      inputLatencies.push(Date.now() - startTime);
      await page.waitForTimeout(300);
    } else {
      failures.push("No visible text inputs found");
    }
  } catch (error: any) {
    failures.push(`text-input: ${error.message}`);
  }

  // 2. Try buttons (avoid navigation — use non-link buttons)
  try {
    const buttons = await page.$$(
      "button:visible, input[type='button']:visible, input[type='submit']:visible",
    );
    if (buttons.length > 0) {
      const btn = buttons[0];
      const inp = await measureInpProxyViaHandle(page, btn, "click");
      if (inp !== null) inpProxyValues.push(inp);
      const startTime = Date.now();
      await btn.click({ timeout: 5000 });
      inputLatencies.push(Date.now() - startTime);
      await page.waitForTimeout(300);
    } else {
      failures.push("No visible buttons found");
    }
  } catch (error: any) {
    failures.push(`button-click: ${error.message}`);
  }

  // 3. Scroll
  try {
    const scrollInp = await measureScrollInpProxy(page);
    if (scrollInp !== null) inpProxyValues.push(scrollInp);
    await page.evaluate(() => window.scrollBy(0, 500));
    await page.waitForTimeout(500);
    await page.evaluate(() => window.scrollBy(0, 500));
    await page.waitForTimeout(500);
  } catch (error: any) {
    failures.push(`scroll: ${error.message}`);
  }

  return failures;
}

async function measureScrollInpProxy(page: Page): Promise<number | null> {
  try {
    const delay = await page.evaluate(() => {
      return new Promise<number>((resolve) => {
        const start = performance.now();
        window.dispatchEvent(new Event("scroll"));
        requestAnimationFrame(() => {
          resolve(performance.now() - start);
        });
      });
    });
    return typeof delay === "number" && delay >= 0 ? delay : null;
  } catch {
    return null;
  }
}

// ─── Aggregation ───

interface AggregatedResult {
  layoutShift: number;
  inputResponsiveness: number | null;
  frameDropRate: number | null;
  interactionLatency: number | null;
  inpProxy: number | null;
  errorRate: number | null;
  networkFailureRecovery: number | null;
  resourceLoadSuccessRate: number | null;
  serviceWorkerAvailable: boolean | null;
  runs: number;
}

function aggregateRuns(runs: RunResult[]): AggregatedResult {
  if (runs.length === 0) {
    return {
      layoutShift: 0,
      inputResponsiveness: null,
      frameDropRate: null,
      interactionLatency: null,
      inpProxy: null,
      errorRate: null,
      networkFailureRecovery: null,
      resourceLoadSuccessRate: null,
      serviceWorkerAvailable: null,
      runs: 0,
    };
  }

  const layoutShift =
    runs.reduce((sum, r) => sum + r.layoutShiftValue, 0) / runs.length;

  const allInputLatencies = runs.flatMap((r) => r.inputLatencies);
  const avgInputLatency =
    allInputLatencies.length > 0
      ? allInputLatencies.reduce((sum, lat) => sum + lat, 0) / allInputLatencies.length
      : null;

  const allInpProxies = runs.flatMap((r) => r.inpProxyValues);
  const inpProxy =
    allInpProxies.length > 0
      ? allInpProxies.reduce((sum, v) => sum + v, 0) / allInpProxies.length
      : null;

  const frameDropRates = runs
    .map((r) => r.frameDropRate)
    .filter((v): v is number => v !== null);
  const frameDropRate =
    frameDropRates.length > 0
      ? frameDropRates.reduce((a, b) => a + b, 0) / frameDropRates.length
      : null;

  const allNetworkRequests = runs.flatMap((r) => r.networkRequests);
  const failedRequests = allNetworkRequests.filter(
    (req: any) => req.failure || (req.status && req.status >= 400),
  );
  const successfulRequests = allNetworkRequests.filter(
    (req: any) => !req.failure && req.status && req.status >= 200 && req.status < 400,
  );

  const totalErrors = runs.reduce((sum, r) => sum + r.consoleErrors.length, 0);
  const totalMessages = runs.reduce((sum, r) => sum + r.totalConsoleMessages, 0);
  const consoleDataCaptured = runs.some((r) => r.totalConsoleMessages !== undefined);

  const errorRate =
    totalMessages > 0
      ? (totalErrors / totalMessages) * 100
      : consoleDataCaptured
        ? 0
        : null;

  const resourceLoadSuccessRate =
    allNetworkRequests.length > 0
      ? (successfulRequests.length / allNetworkRequests.length) * 100
      : null;

  const networkFailureRecovery =
    failedRequests.length > 0
      ? ((failedRequests.length -
          failedRequests.filter((r: any) => r.retries > 0).length) /
          failedRequests.length) *
        100
      : failedRequests.length === 0 && allNetworkRequests.length > 0
        ? 100
        : null;

  const serviceWorkerAvailable = runs.some((r) => r.serviceWorkerAvailable);

  return {
    layoutShift,
    inputResponsiveness: avgInputLatency,
    frameDropRate,
    interactionLatency: avgInputLatency,
    inpProxy,
    errorRate,
    networkFailureRecovery,
    resourceLoadSuccessRate,
    serviceWorkerAvailable: serviceWorkerAvailable || null,
    runs: runs.length,
  };
}
