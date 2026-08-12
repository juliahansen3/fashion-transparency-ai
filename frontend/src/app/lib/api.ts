// Client for the lightweight FastAPI backend (Backend/api.py).
// Run the backend from the Backend/ directory with:
//   uvicorn api:app --reload --port 8000

const API_BASE = "http://localhost:8000";

async function getJson<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) {
    let detail = res.statusText;
    try {
      const body = await res.json();
      if (body?.detail) detail = body.detail;
    } catch {
      // ignore
    }
    throw new Error(detail);
  }
  return res.json();
}

export interface SummaryResponse {
  brand: string;
  model: string;
  summary: string;
}

export interface ComparisonResponse {
  brands: [string, string];
  model: string;
  comparison: string;
}

export function fetchSummary(brand: string): Promise<SummaryResponse> {
  return getJson(`${API_BASE}/api/summary/${encodeURIComponent(brand)}`);
}

export function fetchComparison(brandA: string, brandB: string): Promise<ComparisonResponse> {
  const params = new URLSearchParams({ brandA, brandB });
  return getJson(`${API_BASE}/api/comparison?${params.toString()}`);
}

// ─── Summary parsing ───────────────────────────────────────────────────────
// Backend markdown headers -> BrandSummaryPage section keys.

const SUMMARY_HEADER_TO_KEY: Record<string, string> = {
  "brand metadata": "overview",
  "labor & human rights": "labor",
  "environmental impact": "environment",
  "transparency & accountability": "transparency",
  "overall tradeoff summary": "tradeoff",
};

export interface ParsedSummary {
  sections: Record<string, string>;
}

export function parseSummary(raw: string): ParsedSummary {
  const sections: Record<string, string> = {};
  const lines = raw.split("\n");

  let currentKey: string | null = null;
  let buffer: string[] = [];

  const flush = () => {
    if (currentKey) sections[currentKey] = buffer.join("\n").trim();
    buffer = [];
  };

  for (const line of lines) {
    const match = /^##\s+(.+?)\s*$/.exec(line);
    if (match) {
      flush();
      currentKey = SUMMARY_HEADER_TO_KEY[match[1].trim().toLowerCase()] ?? null;
      continue;
    }
    if (currentKey) buffer.push(line);
  }
  flush();

  return { sections };
}

// ─── Comparison parsing ────────────────────────────────────────────────────

export interface ComparisonCategory {
  brandA: string[];
  sharedStrengths: string[];
  sharedWeaknesses: string[];
  brandB: string[];
}

export interface ParsedComparison {
  categories: Record<string, ComparisonCategory>;
  keyTradeoffs: string[];
  practiceGuidance: {
    labor: string;
    environment: string;
    transparency: string;
    overall: string;
  };
  sources: string[];
}

function extractBullets(text: string): string[] {
  return text
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => /^[-*]\s+/.test(l))
    .map((l) => l.replace(/^[-*]\s+/, "").trim())
    .filter(Boolean);
}

// Splits `text` into a map of section-label -> body, using a list of
// case-insensitive regexes that match a line containing only that label.
function splitByLabels(text: string, labels: [string, RegExp][]): Record<string, string> {
  const lines = text.split("\n");
  const result: Record<string, string> = {};
  let currentKey: string | null = null;
  let buffer: string[] = [];

  const flush = () => {
    if (currentKey) result[currentKey] = buffer.join("\n").trim();
    buffer = [];
  };

  for (const line of lines) {
    const trimmed = line.trim();
    const found = labels.find(([, re]) => re.test(trimmed));
    if (found) {
      flush();
      currentKey = found[0];
      continue;
    }
    if (currentKey) buffer.push(line);
  }
  flush();
  return result;
}

function parseCategory(text: string): ComparisonCategory {
  const parts = splitByLabels(text, [
    ["brandA", /^brand a\b.*:?$/i],
    ["sharedStrengths", /^shared strengths:?$/i],
    ["sharedWeaknesses", /^shared weaknesses:?$/i],
    ["brandB", /^brand b\b.*:?$/i],
  ]);
  return {
    brandA: extractBullets(parts.brandA ?? ""),
    sharedStrengths: extractBullets(parts.sharedStrengths ?? ""),
    sharedWeaknesses: extractBullets(parts.sharedWeaknesses ?? ""),
    brandB: extractBullets(parts.brandB ?? ""),
  };
}

function firstParagraph(text: string): string {
  return text
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean)
    .join(" ")
    .trim();
}

export function parseComparison(raw: string): ParsedComparison {
  const top = splitByLabels(raw, [
    ["labor", /^labor practices:?$/i],
    ["environment", /^environmental impact:?$/i],
    ["transparency", /^transparency\s*(&|and)\s*accountability:?$/i],
    ["keyTradeoffs", /^key tradeoffs:?$/i],
    ["practice", /^what this means in practice:?$/i],
    ["overall", /^overall takeaway:?$/i],
    ["sources", /^sources:?$/i],
  ]);

  const categories: Record<string, ComparisonCategory> = {
    labor: parseCategory(top.labor ?? ""),
    environment: parseCategory(top.environment ?? ""),
    transparency: parseCategory(top.transparency ?? ""),
  };

  const practiceParts = splitByLabels(top.practice ?? "", [
    ["labor", /labor matters most/i],
    ["environment", /environmental impact matters most/i],
    ["transparency", /transparency matters most/i],
  ]);

  return {
    categories,
    keyTradeoffs: extractBullets(top.keyTradeoffs ?? ""),
    practiceGuidance: {
      labor: firstParagraph(practiceParts.labor ?? ""),
      environment: firstParagraph(practiceParts.environment ?? ""),
      transparency: firstParagraph(practiceParts.transparency ?? ""),
      overall: firstParagraph(top.overall ?? ""),
    },
    sources: extractBullets(top.sources ?? ""),
  };
}
