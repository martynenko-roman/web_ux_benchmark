import type { ReliabilityMetrics } from "../types/metrics.js";
import { writeJsonFile } from "../utils/file-utils.js";

export interface RUMResult {
  reliability: Partial<ReliabilityMetrics>;
  raw: any;
}

export async function analyzeRUMData(
  rumData: any,
  outputDir?: string
): Promise<RUMResult | null> {
  if (!rumData) {
    return null;
  }

  try {
    if (outputDir) {
      const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
      const filename = `rum-${timestamp}.json`;
      await writeJsonFile(`${outputDir}/${filename}`, rumData);
    }

    const reliability: Partial<ReliabilityMetrics> = {
      errorRate: extractErrorRate(rumData),
      networkFailureRecovery: extractNetworkFailureRecovery(rumData),
      resourceLoadSuccessRate: extractResourceLoadSuccessRate(rumData),
    };

    return {
      reliability,
      raw: rumData,
    };
  } catch (error: any) {
    console.warn(`Failed to analyze RUM data: ${error.message}`);
    return null;
  }
}

function extractErrorRate(rumData: any): number | null {
  if (!rumData.errors || !rumData.totalEvents) {
    return null;
  }
  return (rumData.errors / rumData.totalEvents) * 100;
}

function extractNetworkFailureRecovery(rumData: any): number | null {
  if (!rumData.networkFailures || !rumData.networkRetries) {
    return null;
  }
  if (rumData.networkFailures === 0) return 100;
  return (rumData.networkRetries / rumData.networkFailures) * 100;
}

function extractResourceLoadSuccessRate(rumData: any): number | null {
  if (!rumData.resourceLoads || !rumData.resourceLoadsTotal) {
    return null;
  }
  return (rumData.resourceLoads / rumData.resourceLoadsTotal) * 100;
}

