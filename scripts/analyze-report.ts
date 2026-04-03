#!/usr/bin/env tsx

/**
 * Statistical analysis of benchmark reports.
 *
 * Computes correlation metrics (Pearson, Spearman, Kendall) between CWV-only
 * and composite UX rankings, plus weight sensitivity and category ablation studies.
 *
 * Usage:
 *   tsx scripts/analyze-report.ts [path/to/report.json]
 *
 * If no path is given, the latest report-*.json in data/reports/ is used.
 * Writes JSON to data/summary/<report-name>-analysis.json and prints to stdout.
 *
 * ── Statistical methods ──────────────────────────────────────────────────────
 *
 * Pearson r
 *   Standard product-moment formula. P-value from two-tailed t-test:
 *     t = r √(n−2) / √(1−r²),  df = n−2
 *   evaluated via the regularized incomplete beta function (continued fraction,
 *   Lentz algorithm) for the Student-t CDF.
 *   95% CI via Fisher z-transform: z = atanh(r), SE = 1/√(n−3),
 *   bounds = tanh(z ± 1.96·SE).
 *
 * Spearman ρ
 *   Pearson r computed on mid-ranks (average-rank ties). P-value uses the same
 *   t-test approximation as Pearson (valid for n ≥ 10). 95% CI via Fisher
 *   z-transform with SE = 1/√(n−3).
 *
 * Kendall τ-b
 *   τ_b = (C−D) / √((n₀−tₓ)(n₀−tᵧ)) where n₀ = n(n−1)/2, C = concordant
 *   pairs, D = discordant pairs, tₓ/tᵧ = ties in x/y. P-value via normal
 *   approximation: z = τ / √(2(2n+5) / (9n(n−1))). 95% CI: τ ± 1.96·SE
 *   with the same SE.
 */

import { readFileSync, readdirSync, writeFileSync, mkdirSync } from "node:fs";
import { join, dirname, resolve, basename } from "node:path";
import { fileURLToPath } from "node:url";

// ── Types ────────────────────────────────────────────────────────────────────

interface Weights {
  cvv: number;
  interactionStability: number;
  accessibility: number;
  reliability: number;
}

interface PageEntry {
  pageId: string;
  scores: {
    cvv: number;
    interactionStability: number;
    accessibility: number;
    reliability: number;
    composite: number;
    rawComposite: number;
    coverageFactor: number;
  };
  coverage: {
    overall: { available: number; expected: number; percentage: number };
    cvv: { available: number };
    interactionStability: { available: number };
    accessibility: { available: number };
    reliability: { available: number };
  };
}

interface Report {
  metadata: {
    timestamp: string;
    reportVersion: number;
    config: {
      compositeWeights: Weights;
      coveragePenaltyFactor: number;
    };
  };
  pages: PageEntry[];
}

// ── Lanczos ln(Gamma) ────────────────────────────────────────────────────────

const LANCZOS_COEF = [
  0.99999999999980993, 676.5203681218851, -1259.1392167224028,
  771.32342877765313, -176.61502916214059, 12.507343278686905,
  -0.13857109526572012, 9.9843695780195716e-6, 1.5056327351493116e-7,
];

const lnGamma = (z: number): number => {
  if (z < 0.5) {
    return Math.log(Math.PI / Math.sin(Math.PI * z)) - lnGamma(1 - z);
  }
  z -= 1;
  let x = LANCZOS_COEF[0];
  for (let i = 1; i < 9; i++) x += LANCZOS_COEF[i] / (z + i);
  const t = z + 7.5;
  return 0.5 * Math.log(2 * Math.PI) + (z + 0.5) * Math.log(t) - t + Math.log(x);
};

const lnBeta = (a: number, b: number): number =>
  lnGamma(a) + lnGamma(b) - lnGamma(a + b);

// ── Regularized incomplete beta (continued fraction, Lentz) ──────────────────

const regularizedBeta = (x: number, a: number, b: number): number => {
  if (x <= 0) return 0;
  if (x >= 1) return 1;

  if (x > (a + 1) / (a + b + 2)) {
    return 1 - regularizedBeta(1 - x, b, a);
  }

  const lnPre =
    a * Math.log(x) + b * Math.log(1 - x) - lnBeta(a, b) - Math.log(a);
  const prefix = Math.exp(lnPre);

  const TINY = 1e-30;
  const EPS = 1e-14;
  const MAX_ITER = 200;

  let d = 1 - ((a + b) * x) / (a + 1);
  if (Math.abs(d) < TINY) d = TINY;
  d = 1 / d;
  let f = d;
  let c = 1;

  for (let m = 1; m <= MAX_ITER; m++) {
    let num = (m * (b - m) * x) / ((a + 2 * m - 1) * (a + 2 * m));
    d = 1 + num * d;
    if (Math.abs(d) < TINY) d = TINY;
    d = 1 / d;
    c = 1 + num / c;
    if (Math.abs(c) < TINY) c = TINY;
    f *= c * d;

    num =
      (-(a + m) * (a + b + m) * x) / ((a + 2 * m) * (a + 2 * m + 1));
    d = 1 + num * d;
    if (Math.abs(d) < TINY) d = TINY;
    d = 1 / d;
    c = 1 + num / c;
    if (Math.abs(c) < TINY) c = TINY;
    const delta = c * d;
    f *= delta;

    if (Math.abs(delta - 1) < EPS) break;
  }

  return prefix * f;
};

// ── Distribution CDFs ────────────────────────────────────────────────────────

const tCDF = (t: number, df: number): number => {
  const x = df / (df + t * t);
  const prob = 0.5 * regularizedBeta(x, df / 2, 0.5);
  return t >= 0 ? 1 - prob : prob;
};

const normalCDF = (z: number): number => {
  if (z < -8) return 0;
  if (z > 8) return 1;
  const a1 = 0.254829592;
  const a2 = -0.284496736;
  const a3 = 1.421413741;
  const a4 = -1.453152027;
  const a5 = 1.061405429;
  const p = 0.3275911;
  const sign = z < 0 ? -1 : 1;
  const absZ = Math.abs(z) / Math.SQRT2;
  const t = 1 / (1 + p * absZ);
  const erf =
    1 - ((((a5 * t + a4) * t + a3) * t + a2) * t + a1) * t * Math.exp(-absZ * absZ);
  return 0.5 * (1 + sign * erf);
};

// ── Correlation functions ────────────────────────────────────────────────────

const pearsonR = (x: number[], y: number[]): number => {
  const n = x.length;
  const mx = x.reduce((s, v) => s + v, 0) / n;
  const my = y.reduce((s, v) => s + v, 0) / n;
  let num = 0;
  let dx2 = 0;
  let dy2 = 0;
  for (let i = 0; i < n; i++) {
    const dx = x[i] - mx;
    const dy = y[i] - my;
    num += dx * dy;
    dx2 += dx * dx;
    dy2 += dy * dy;
  }
  const den = Math.sqrt(dx2 * dy2);
  return den === 0 ? 0 : num / den;
};

const assignRanks = (values: number[]): number[] => {
  const indexed = values.map((v, i) => ({ v, i }));
  indexed.sort((a, b) => a.v - b.v);
  const result = new Array<number>(values.length);
  let i = 0;
  while (i < indexed.length) {
    let j = i;
    while (j < indexed.length && indexed[j].v === indexed[i].v) j++;
    const avgRank = (i + j + 1) / 2;
    for (let k = i; k < j; k++) result[indexed[k].i] = avgRank;
    i = j;
  }
  return result;
};

const spearmanRho = (x: number[], y: number[]): number =>
  pearsonR(assignRanks(x), assignRanks(y));

const kendallTauB = (x: number[], y: number[]): number => {
  const n = x.length;
  let concordant = 0;
  let discordant = 0;
  let tiesX = 0;
  let tiesY = 0;
  for (let i = 0; i < n - 1; i++) {
    for (let j = i + 1; j < n; j++) {
      const dx = x[i] - x[j];
      const dy = y[i] - y[j];
      const prod = dx * dy;
      if (prod > 0) concordant++;
      else if (prod < 0) discordant++;
      else {
        if (dx === 0) tiesX++;
        if (dy === 0) tiesY++;
      }
    }
  }
  const n0 = (n * (n - 1)) / 2;
  const den = Math.sqrt((n0 - tiesX) * (n0 - tiesY));
  return den === 0 ? 0 : (concordant - discordant) / den;
};

// ── P-values ─────────────────────────────────────────────────────────────────

const correlationPValue = (r: number, n: number): number => {
  if (n <= 2 || Math.abs(r) >= 1) return n <= 2 ? 1 : 0;
  const t = r * Math.sqrt(n - 2) / Math.sqrt(1 - r * r);
  return 2 * (1 - tCDF(Math.abs(t), n - 2));
};

const kendallPValue = (tau: number, n: number): number => {
  const variance = (2 * (2 * n + 5)) / (9 * n * (n - 1));
  const z = tau / Math.sqrt(variance);
  return 2 * (1 - normalCDF(Math.abs(z)));
};

// ── Confidence intervals ─────────────────────────────────────────────────────

const Z_975 = 1.959964;

const fisherZCI = (r: number, n: number): [number, number] => {
  const z = Math.atanh(r);
  const se = 1 / Math.sqrt(n - 3);
  return [Math.tanh(z - Z_975 * se), Math.tanh(z + Z_975 * se)];
};

const kendallCI = (tau: number, n: number): [number, number] => {
  const se = Math.sqrt((2 * (2 * n + 5)) / (9 * n * (n - 1)));
  return [tau - Z_975 * se, tau + Z_975 * se];
};

// ── Composite recomputation ──────────────────────────────────────────────────

const CATEGORY_KEYS: Array<keyof Weights> = [
  "cvv",
  "interactionStability",
  "accessibility",
  "reliability",
];

const recomputeComposite = (
  page: PageEntry,
  weights: Weights,
  penaltyFactor: number,
): number => {
  const categories = CATEGORY_KEYS.map((key) => ({
    key,
    score: page.scores[key],
    hasData: page.coverage[key].available > 0,
  }));

  const available = categories.filter((c) => c.hasData);
  if (available.length === 0) return 0;

  const totalWeight = available.reduce((sum, c) => sum + weights[c.key], 0);
  if (totalWeight === 0) return 0;

  let raw = 0;
  for (const cat of available) {
    raw += cat.score * (weights[cat.key] / totalWeight);
  }

  const ratio = page.coverage.overall.percentage / 100;
  const factor =
    penaltyFactor > 0
      ? Math.pow(Math.max(ratio, 0.01), penaltyFactor)
      : 1;

  return Math.round(raw * factor * 100) / 100;
};

// ── Ranking helpers ──────────────────────────────────────────────────────────

const buildRankMap = (
  pageIds: string[],
  scores: number[],
): Map<string, number> => {
  const indexed = pageIds.map((id, i) => ({ id, score: scores[i] }));
  indexed.sort((a, b) => b.score - a.score);
  return new Map(indexed.map((p, i) => [p.id, i + 1]));
};

const rankFlipStats = (
  baseRanks: Map<string, number>,
  otherRanks: Map<string, number>,
) => {
  const absChanges: number[] = [];
  let flips = 0;

  for (const [pageId, baseRank] of baseRanks) {
    const otherRank = otherRanks.get(pageId)!;
    const change = Math.abs(baseRank - otherRank);
    absChanges.push(change);
    if (change > 0) flips++;
  }

  absChanges.sort((a, b) => a - b);
  const n = absChanges.length;
  const median =
    n % 2 === 0
      ? (absChanges[n / 2 - 1] + absChanges[n / 2]) / 2
      : absChanges[Math.floor(n / 2)];

  return {
    flips,
    flipPercentage: (flips / n) * 100,
    maxAbsChange: absChanges[n - 1],
    medianAbsChange: median,
  };
};

// ── Rounding helpers ─────────────────────────────────────────────────────────

const r3 = (v: number): number => Math.round(v * 1000) / 1000;
const r1 = (v: number): number => Math.round(v * 10) / 10;

// ── Main ─────────────────────────────────────────────────────────────────────

const CATEGORY_LABELS: Record<keyof Weights, string> = {
  cvv: "CWV",
  interactionStability: "Interaction",
  accessibility: "Accessibility",
  reliability: "Reliability",
};

const findLatestReport = (): string => {
  const scriptDir = dirname(fileURLToPath(import.meta.url));
  const reportsDir = join(scriptDir, "..", "data", "reports");
  const files = readdirSync(reportsDir)
    .filter(
      (f) =>
        f.startsWith("report-") && f.endsWith(".json") && !f.includes("-runs"),
    )
    .sort()
    .reverse();

  if (files.length === 0) {
    console.error("No report files found in data/reports/");
    process.exit(1);
  }
  return join(reportsDir, files[0]);
};

const main = () => {
  const reportPath =
    process.argv.length > 2 ? resolve(process.argv[2]) : findLatestReport();

  console.error(`Analyzing: ${reportPath}`);

  const report: Report = JSON.parse(readFileSync(reportPath, "utf-8"));
  const { pages } = report;
  const n = pages.length;
  const weights = report.metadata.config.compositeWeights;
  const penaltyFactor = report.metadata.config.coveragePenaltyFactor;

  const cvvScores = pages.map((p) => p.scores.cvv);
  const compositeScores = pages.map((p) => p.scores.composite);
  const pageIds = pages.map((p) => p.pageId);

  const cvvRanks = buildRankMap(pageIds, cvvScores);
  const compositeRanks = buildRankMap(pageIds, compositeScores);

  // ── TABLE V ──────────────────────────────────────────────────────────────

  const pearson = pearsonR(cvvScores, compositeScores);
  const spearman = spearmanRho(cvvScores, compositeScores);
  const kendall = kendallTauB(cvvScores, compositeScores);
  const flips = rankFlipStats(cvvRanks, compositeRanks);

  const [pCILow, pCIHigh] = fisherZCI(pearson, n);
  const [sCILow, sCIHigh] = fisherZCI(spearman, n);
  const [kCILow, kCIHigh] = kendallCI(kendall, n);

  const rankingComparison = {
    title: "Summary of Ranking Comparison Results",
    rows: [
      { metric: "Number of evaluated pages", value: n },
      { metric: "Pages with rank flips", value: flips.flips },
      {
        metric: "Rank flip percentage",
        value: r1(flips.flipPercentage),
        unit: "%",
      },
      { metric: "Maximum absolute rank change", value: flips.maxAbsChange },
      { metric: "Median absolute rank change", value: flips.medianAbsChange },
      {
        metric: "Pearson correlation (CWV vs. composite UX)",
        value: r3(pearson),
        ci95: [r3(pCILow), r3(pCIHigh)],
        pValue: correlationPValue(pearson, n),
      },
      {
        metric: "Spearman correlation",
        value: r3(spearman),
        ci95: [r3(sCILow), r3(sCIHigh)],
        pValue: correlationPValue(spearman, n),
      },
      {
        metric: "Kendall's τ",
        value: r3(kendall),
        ci95: [r3(kCILow), r3(kCIHigh)],
        pValue: kendallPValue(kendall, n),
      },
    ],
  };

  // ── Weight sensitivity ────────────────────────────────────────────────────

  const sensitivityRow = (label: string, w: Weights) => {
    const newScores = pages.map((p) => recomputeComposite(p, w, penaltyFactor));
    const newRanks = buildRankMap(pageIds, newScores);
    const stats = rankFlipStats(cvvRanks, newRanks);
    const rho = spearmanRho(cvvScores, newScores);
    return {
      configuration: label,
      spearmanRho: r3(rho),
      rankFlipPercent: r1(stats.flipPercentage),
      medianAbsRankChange: stats.medianAbsChange,
    };
  };

  const sensitivityRows = [sensitivityRow("Baseline", { ...weights })];

  for (const key of CATEGORY_KEYS) {
    for (const dir of [1, -1] as const) {
      const adjusted: Weights = { ...weights };
      adjusted[key] *= 1 + dir * 0.1;
      const sign = dir > 0 ? "+10%" : "\u221210%";
      sensitivityRows.push(
        sensitivityRow(`${CATEGORY_LABELS[key]} ${sign}`, adjusted),
      );
    }
  }

  const weightSensitivity = {
    title: "Weight sensitivity analysis (\u00b110%)",
    rows: sensitivityRows,
  };

  // ── Category ablation ─────────────────────────────────────────────────────

  const ablationRows = CATEGORY_KEYS.map((key) => {
    const ablated: Weights = { ...weights, [key]: 0 };
    const newScores = pages.map((p) =>
      recomputeComposite(p, ablated, penaltyFactor),
    );
    const newRanks = buildRankMap(pageIds, newScores);
    const stats = rankFlipStats(cvvRanks, newRanks);
    const rho = spearmanRho(cvvScores, newScores);
    return {
      ablation: `Remove ${CATEGORY_LABELS[key]}`,
      spearmanRho: r3(rho),
      rankFlipPercent: r1(stats.flipPercentage),
      medianAbsRankChange: stats.medianAbsChange,
    };
  });

  const categoryAblation = {
    title: "Category ablation study",
    rows: ablationRows,
  };

  // ── Output ───────────────────────────────────────────────────────────────

  const result = { rankingComparison, weightSensitivity, categoryAblation };
  const json = JSON.stringify(result, null, 2);

  const scriptDir = dirname(fileURLToPath(import.meta.url));
  const summaryDir = join(scriptDir, "..", "data", "summary");
  mkdirSync(summaryDir, { recursive: true });

  const reportName = basename(reportPath, ".json");
  const outputPath = join(summaryDir, `${reportName}-analysis.json`);
  writeFileSync(outputPath, json, "utf-8");

  console.error(`Written to: ${outputPath}`);
  console.log(json);
};

main();
