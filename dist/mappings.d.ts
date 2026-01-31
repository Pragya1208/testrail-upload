/**
 * CSV column name variants -> internal field key.
 * Headers are normalized: trim, lowercase, collapse spaces (e.g. "Preconditions / Config" -> "preconditions / config").
 * First match wins when detecting columns.
 */
export declare const CSV_COLUMN_ALIASES: Record<string, string>;
/** Lane (CSV) -> TestRail Framework */
export declare const LANE_TO_FRAMEWORK: Record<string, string>;
/** TestRail Framework values (for custom_framework or equivalent) */
export declare const FRAMEWORK_VALUES: readonly ["None", "E2E-Testcafe", "RestAssured", "Mobile", "Unit"];
/** Risk/Test Type (CSV) -> TestRail Type */
export declare const RISK_TO_TYPE: Record<string, string>;
/** TestRail Type values */
export declare const TYPE_VALUES: readonly ["Accessibility", "Compatibility", "Destructive", "Functional", "Other", "Performance", "Security", "Usability"];
/** POD values in TestRail */
export declare const POD_VALUES: readonly ["Orchestration", "Journeys", "Segmentation", "Delivery", "Core Functions", "App Experiences", "Product Analytics", "Web", "Workflows", "SDK", "Product Integration", "Mobile Channels", "ONB", "SMS-WA-RMKT", "EMAIL", "PROMO", "Ingestion", "Mongo-Security & Tools-Dashboard"];
/** Default status for new cases */
export declare const DEFAULT_STATUS = "Design";
/** Template name we target (user can override template_id via env) */
export declare const TEMPLATE_NAME = "Test Case (Text)";
/** Mandatory TestRail CSV headers (in order) for the created TestRail-compatible CSV. */
export declare const TESTRAIL_MANDATORY_HEADERS: readonly ["Title", "Framework", "Type", "POD", "References", "Preconditions", "Steps", "Expected Results", "Priority", "Test Data"];
/** Internal field name -> TestRail header name (for reporting). */
export declare const FIELD_TO_TESTRAIL_HEADER: Record<string, string>;
//# sourceMappingURL=mappings.d.ts.map