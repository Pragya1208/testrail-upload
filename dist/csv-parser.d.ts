export interface ParsedRow {
    id?: string;
    title?: string;
    framework?: string;
    type?: string;
    pod?: string;
    priority?: string;
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
 * Map Lane value to Framework.
 */
export declare function mapLaneToFramework(lane: string): string;
/**
 * Map Risk/Test Type to TestRail Type.
 */
export declare function mapRiskToType(risk: string): string;
/**
 * Parse CSV content and return normalized rows with column mapping.
 */
export declare function parseCSV(content: string): ParseResult;
/**
 * Build TestRail steps from row: Trigger/Steps + Expected Results + Test Data.
 * Each step can have content, expected, and additional_info.
 */
export declare function buildStepsFromRow(row: ParsedRow): Array<{
    content: string;
    expected: string;
    additional_info?: string;
}>;
//# sourceMappingURL=csv-parser.d.ts.map