import type { ParsedRow } from "./csv-parser.js";
import type { ParseResult } from "./csv-parser.js";
export interface MandatoryOverrides {
    section_id: number;
    default_pod?: string;
    default_references?: string;
    default_framework?: string;
    default_type?: string;
    template_id?: number;
    default_status?: string;
}
export interface ValidationResult {
    valid: boolean;
    missingMandatory: string[];
    rowsMissingTitle: number[];
    rowsMissingFramework: number[];
    rowsMissingType: number[];
    suggestedOverrides: Partial<MandatoryOverrides> | null;
    message: string;
}
/**
 * Build a header-check report: detected CSV headers, mapping to TestRail fields, and missing mandatory headers.
 */
export declare function formatHeaderCheckReport(parseResult: ParseResult): string;
export declare function validateRowsAndOverrides(rows: ParsedRow[], overrides: Partial<MandatoryOverrides> | null): ValidationResult;
export declare function formatMandatoryHelp(): string;
//# sourceMappingURL=validation.d.ts.map