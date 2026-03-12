import lighthouse from "lighthouse";
import type { CWVMetrics, AccessibilityMetrics } from "../types/metrics.js";
import type { LighthouseConfig } from "../types/config.js";
import { writeJsonFile } from "../utils/file-utils.js";
import { createRequire } from "module";

const require = createRequire(import.meta.url);
const chromeLauncher = require("chrome-launcher");

export interface LighthouseResult {
  cvv: CWVMetrics;
  accessibility: AccessibilityMetrics;
  performance: number;
  raw: any;
}

export async function runLighthouse(
  url: string,
  config: LighthouseConfig,
  outputDir?: string,
): Promise<LighthouseResult> {
  const chrome = await chromeLauncher.launch({ chromeFlags: ["--headless"] });

  try {
    const options = {
      logLevel: "info" as const,
      output: "json" as const,
      onlyCategories: config.categories,
      port: chrome.port,
    };

    const runnerResult = await lighthouse(url, options);

    if (!runnerResult) {
      throw new Error("Lighthouse returned no result");
    }

    const lhr = runnerResult.lhr;

    if (outputDir) {
      const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
      const filename = `lighthouse-${timestamp}.json`;
      await writeJsonFile(`${outputDir}/${filename}`, lhr);
    }

    const cvv: CWVMetrics = {
      lcp: lhr.audits["largest-contentful-paint"]?.numericValue ?? null,
      fid: lhr.audits["first-input-delay"]?.numericValue ?? null,
      inp: lhr.audits["interaction-to-next-paint"]?.numericValue ?? null,
      cls:
        lhr.audits["cumulative-layout-shift"]?.numericValue !== undefined
          ? lhr.audits["cumulative-layout-shift"].numericValue
          : null,
      inpProxy: null,
    };

    const accessibility: AccessibilityMetrics = {
      wcagComplianceScore:
        lhr.categories.accessibility?.score != null
          ? lhr.categories.accessibility.score * 100
          : null,
      keyboardNavigationScore: extractKeyboardNavigationScore(lhr),
      screenReaderCompatibility: extractScreenReaderScore(lhr),
      colorContrastRatio: extractColorContrastScore(lhr),
    };

    return {
      cvv,
      accessibility,
      performance: lhr.categories.performance?.score
        ? lhr.categories.performance.score * 100
        : 0,
      raw: lhr,
    };
  } finally {
    await chrome.kill();
  }
}

function extractKeyboardNavigationScore(lhr: any): number | null {
  const keyboardAudits = [
    "tabindex",
    "accesskeys",
    "interactive-element-affordance",
    "logical-tab-order",
    "managed-focus",
    "focus-traps",
    "custom-controls-roles",
    "visual-order-follows-dom",
    "offscreen-content-hidden",
    "custom-controls-labels",
  ];
  let totalScore = 0;
  let count = 0;

  for (const auditId of keyboardAudits) {
    const audit = lhr.audits[auditId];
    if (audit?.score !== null && audit?.score !== undefined) {
      totalScore += audit.score;
      count++;
    }
  }

  if (count > 0) return (totalScore / count) * 100;

  const a11yScore = lhr.categories.accessibility?.score;
  if (a11yScore !== null && a11yScore !== undefined) {
    return a11yScore * 100;
  }

  return null;
}

function extractScreenReaderScore(lhr: any): number | null {
  const ariaAudits = [
    "aria-allowed-attr",
    "aria-hidden-body",
    "aria-hidden-focus",
    "aria-input-field-name",
    "aria-required-attr",
    "aria-roles",
    "aria-valid-attr-value",
    "aria-valid-attr",
    "button-name",
    "document-title",
    "html-has-lang",
    "image-alt",
    "label",
    "link-name",
  ];
  let totalScore = 0;
  let count = 0;

  for (const auditId of ariaAudits) {
    const audit = lhr.audits[auditId];
    if (audit?.score !== null && audit?.score !== undefined) {
      totalScore += audit.score;
      count++;
    }
  }

  return count > 0 ? (totalScore / count) * 100 : null;
}

function extractColorContrastScore(lhr: any): number | null {
  const contrastAudit = lhr.audits["color-contrast"];
  if (contrastAudit?.score !== null && contrastAudit?.score !== undefined) {
    return contrastAudit.score * 100;
  }
  return null;
}
