import { parse } from "csv-parse/sync";
import { CSV_COLUMN_ALIASES, LANE_TO_FRAMEWORK, RISK_TO_TYPE } from "./mappings.js";

export interface ParsedRow {
  id?: string;
  title?: string;
  framework?: string;
  priority?: string;
  type?: string;
  preconditions?: string;
  steps?: string;
  expected_results?: string;
  covered?: string;
  test_data?: string;
  references?: string;
  estimate?: string;
  /** Raw row for debugging */
  _raw: Record<string, string>;
}

export interface ParseResult {
  rows: ParsedRow[];
  columnMap: Record<string, string>;
  errors: string[];
}

/**
 * Normalize header: trim, lowercase, collapse spaces.
 */
function normalizeHeader(h: string): string {
  return h.trim().toLowerCase().replace(/\s+/g, " ");
}

/**
 * Detect column mapping from CSV headers.
 */
function detectColumnMap(headers: string[]): Record<string, string> {
  const map: Record<string, string> = {};
  for (const header of headers) {
    const key = normalizeHeader(header);
    const alias = CSV_COLUMN_ALIASES[key];
    if (alias && !map[alias]) {
      map[alias] = header;
    }
  }
  return map;
}

/**
 * Map Lane value to Framework.
 */
export function mapLaneToFramework(lane: string): string {
  const key = lane.trim().toLowerCase();
  return LANE_TO_FRAMEWORK[key] ?? lane;
}

/**
 * Map Risk/Test Type to TestRail Type.
 */
export function mapRiskToType(risk: string): string {
  const key = risk.trim().toLowerCase();
  return RISK_TO_TYPE[key] ?? risk;
}

/**
 * Parse CSV content and return normalized rows with column mapping.
 */
export function parseCSV(content: string): ParseResult {
  const errors: string[] = [];
  let rows: ParsedRow[] = [];
  let columnMap: Record<string, string> = {};

  try {
    const records = parse(content, {
      columns: true,
      skip_empty_lines: true,
      relax_column_count: true,
      trim: true,
      bom: true,
    }) as Record<string, string>[];

    if (records.length === 0) {
      return { rows: [], columnMap: {}, errors: ["CSV has no data rows."] };
    }

    const headers = Object.keys(records[0]);
    columnMap = detectColumnMap(headers);

    for (let i = 0; i < records.length; i++) {
      const raw = records[i];
      const row: ParsedRow = { _raw: raw };

      for (const [field, csvCol] of Object.entries(columnMap)) {
        const val = raw[csvCol]?.trim();
        if (val === undefined || val === "") continue;
        if (field === "framework") {
          (row as Record<string, string>)[field] = mapLaneToFramework(val);
        } else if (field === "type") {
          (row as Record<string, string>)[field] = mapRiskToType(val);
        } else {
          (row as Record<string, string>)[field] = val;
        }
      }

      rows.push(row);
    }
  } catch (e) {
    errors.push(e instanceof Error ? e.message : String(e));
  }

  return { rows, columnMap, errors };
}

/**
 * Build TestRail steps from row: Trigger/Steps + Expected Results + Test Data.
 * Each step can have content, expected, and additional_info.
 */
export function buildStepsFromRow(row: ParsedRow): Array<{ content: string; expected: string; additional_info?: string }> {
  const steps: Array<{ content: string; expected: string; additional_info?: string }> = [];
  const stepText = row.steps ?? "";
  const expectedText = row.expected_results ?? "";
  const testData = row.test_data?.trim();

  // If steps contain "Expected Results:" or similar, split; else treat whole as one step block
  const stepLines = stepText.split(/\n/).filter((s) => s.trim());
  const expectedLines = expectedText.split(/\n/).filter((s) => s.trim());

  if (stepLines.length === 0 && expectedLines.length === 0) {
    return steps;
  }

  // Single combined step: content = steps text, expected = expected text, additional_info = test data
  const content = stepText.trim() || "(No steps)";
  const expected = expectedText.trim() || "(No expected result)";
  const additional_info = testData || undefined;
  steps.push({ content, expected, additional_info });

  return steps;
}
