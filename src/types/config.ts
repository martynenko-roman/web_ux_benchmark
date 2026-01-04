export interface PageConfig {
  id: string;
  name: string;
  url: string;
  category: string;
  expectedPattern: string;
}

export interface PagesConfig {
  pages: PageConfig[];
}

export interface LighthouseConfig {
  preset: "desktop" | "mobile";
  categories: string[];
  throttling: string;
}

export interface PlaywrightConfig {
  headless?: boolean;
  runs: number;
  timeout?: number;
  viewport?: { width: number; height: number };
  interactions?: Array<{
    type: "click" | "type" | "scroll";
    selector?: string;
    text?: string;
  }>;
}

export interface CompositeWeights {
  cvv: number;
  interactionStability: number;
  accessibility: number;
  reliability: number;
}

export interface BenchmarkConfig {
  lighthouse: LighthouseConfig;
  playwright: PlaywrightConfig;
  compositeWeights: CompositeWeights;
}

