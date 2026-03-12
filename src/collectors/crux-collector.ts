import axios from "axios";
import type { CWVMetrics } from "../types/metrics.js";
import { writeJsonFile } from "../utils/file-utils.js";

export interface CrUXResult {
  cvv: CWVMetrics;
  raw: any;
}

export async function collectCrUXData(
  origin: string,
  outputDir?: string
): Promise<CrUXResult | null> {
  try {
    const apiKey = process.env.CRUX_API_KEY;
    if (!apiKey) {
      console.warn("CrUX API key not found, skipping CrUX data collection");
      return null;
    }

    const url = `https://chromeuxreport.googleapis.com/v1/records:queryRecord`;
    const response = await axios.post(
      url,
      {
        origin,
        formFactor: "ALL",
        metrics: ["largest_contentful_paint", "first_input_delay", "cumulative_layout_shift"],
      },
      {
        headers: {
          "Content-Type": "application/json",
        },
        params: {
          key: apiKey,
        },
      }
    );

    const data = response.data;

    if (outputDir) {
      const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
      const filename = `crux-${origin.replace(/[^a-zA-Z0-9]/g, "_")}-${timestamp}.json`;
      await writeJsonFile(`${outputDir}/${filename}`, data);
    }

    const cvv: CWVMetrics = {
      lcp: extractPercentile(data, "largest_contentful_paint", 75),
      fid: extractPercentile(data, "first_input_delay", 75),
      inp: null,
      cls: extractPercentile(data, "cumulative_layout_shift", 75),
      inpProxy: null,
    };

    return {
      cvv,
      raw: data,
    };
  } catch (error: any) {
    if (error.response?.status === 404) {
      console.warn(`No CrUX data available for ${origin}`);
      return null;
    }
    console.warn(`Failed to collect CrUX data for ${origin}:`, error.message);
    return null;
  }
}

function extractPercentile(
  data: any,
  metricName: string,
  percentile: number
): number | null {
  const metric = data.record?.metrics?.[metricName];
  if (!metric) return null;

  const histogram = metric.histogram;
  if (!histogram || histogram.length === 0) return null;

  const percentileKey = `p${percentile}`;
  const percentileValue = metric.percentiles?.[percentileKey];

  if (percentileValue !== undefined && percentileValue !== null) {
    return percentileValue;
  }

  return null;
}

