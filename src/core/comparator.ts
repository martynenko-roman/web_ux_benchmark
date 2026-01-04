import type { PageBenchmark, Ranking, RankFlip } from "../types/report.js";
import { calculateCorrelation } from "../utils/math-utils.js";

export interface ComparisonResult {
  cvvRankings: Ranking[];
  compositeRankings: Ranking[];
  rankFlips: RankFlip[];
  statistics: {
    correlation: number;
    rankFlipCount: number;
    rankFlipPercentage: number;
  };
}

export function compareRankings(
  pages: PageBenchmark[]
): ComparisonResult {
  const cvvRankings = rankByCWV(pages);
  const compositeRankings = rankByComposite(pages);

  const rankFlips = identifyRankFlips(cvvRankings, compositeRankings);

  const cvvScores = pages.map((p) => p.scores.cvv);
  const compositeScores = pages.map((p) => p.scores.composite);
  const correlation = calculateCorrelation(cvvScores, compositeScores);

  const rankFlipCount = rankFlips.length;
  const rankFlipPercentage =
    pages.length > 0 ? (rankFlipCount / pages.length) * 100 : 0;

  return {
    cvvRankings,
    compositeRankings,
    rankFlips,
    statistics: {
      correlation: Math.round(correlation * 1000) / 1000,
      rankFlipCount,
      rankFlipPercentage: Math.round(rankFlipPercentage * 100) / 100,
    },
  };
}

function rankByCWV(pages: PageBenchmark[]): Ranking[] {
  const sorted = [...pages].sort((a, b) => b.scores.cvv - a.scores.cvv);
  return sorted.map((page, index) => ({
    pageId: page.pageId,
    score: page.scores.cvv,
    rank: index + 1,
  }));
}

function rankByComposite(pages: PageBenchmark[]): Ranking[] {
  const sorted = [...pages].sort(
    (a, b) => b.scores.composite - a.scores.composite
  );
  return sorted.map((page, index) => ({
    pageId: page.pageId,
    score: page.scores.composite,
    rank: index + 1,
  }));
}

function identifyRankFlips(
  cvvRankings: Ranking[],
  compositeRankings: Ranking[]
): RankFlip[] {
  const rankFlips: RankFlip[] = [];

  const cvvRankMap = new Map(cvvRankings.map((r) => [r.pageId, r.rank]));
  const compositeRankMap = new Map(
    compositeRankings.map((r) => [r.pageId, r.rank])
  );

  for (const cvvRank of cvvRankings) {
    const compositeRank = compositeRankMap.get(cvvRank.pageId);
    if (compositeRank === undefined) continue;

    const rankChange = cvvRank.rank - compositeRank;
    if (rankChange !== 0) {
      rankFlips.push({
        pageId: cvvRank.pageId,
        cvvRank: cvvRank.rank,
        compositeRank,
        rankChange,
      });
    }
  }

  return rankFlips.sort((a, b) => Math.abs(b.rankChange) - Math.abs(a.rankChange));
}

