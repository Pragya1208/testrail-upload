/**
 * CSV column name variants -> internal field key.
 * Headers are normalized: trim, lowercase, collapse spaces (e.g. "Preconditions / Config" -> "preconditions / config").
 * First match wins when detecting columns.
 */
export const CSV_COLUMN_ALIASES = {
    // ID / reference
    "testcase_id": "id",
    "test case id": "id",
    "scn_id": "id",
    "scenario id": "id",
    // Title
    "scenario title": "title",
    "test case title": "title",
    "title": "title",
    // Framework (Lane)
    "lane": "framework",
    "framework": "framework",
    // Priority
    "priority": "priority",
    // Type (Risk / Test Type)
    "test type": "type",
    "risk": "type",
    "type": "type",
    // Preconditions
    "preconditions": "preconditions",
    "preconditions/config": "preconditions",
    "preconditions / config": "preconditions",
    "config": "preconditions",
    // Steps (Trigger / Action)
    "trigger": "steps",
    "trigger/action": "steps",
    "trigger / action": "steps",
    "action": "steps",
    "test steps": "steps",
    "steps": "steps",
    // Expected results (Oracle / Observable)
    "expected results": "expected_results",
    "expected result": "expected_results",
    "oracle/observable": "expected_results",
    "oracle / observable": "expected_results",
    "oracle": "expected_results",
    "observable": "expected_results",
    // Covered (not sent to TestRail)
    "covered?": "covered",
    "covered": "covered",
    // Test data
    "test data": "test_data",
    // References (JIRA ID, REQ_ID)
    "references": "references",
    "refs": "references",
    "req_id": "references",
    "reference": "references",
    // POD
    "pod": "pod",
    // Estimate
    "estimate": "estimate",
};
/** Lane (CSV) -> TestRail Framework */
export const LANE_TO_FRAMEWORK = {
    "itf": "RestAssured",
    "testcafe": "E2E-Testcafe",
    "manual": "None",
    "dev-unit (dev-owned)": "Unit",
    "dev-unit": "Unit",
};
/** TestRail Framework values (for custom_framework or equivalent) */
export const FRAMEWORK_VALUES = ["None", "E2E-Testcafe", "RestAssured", "Mobile", "Unit"];
/** Risk/Test Type (CSV) -> TestRail Type */
export const RISK_TO_TYPE = {
    "correctness": "Functional",
    "data": "Functional",
    "security": "Security",
    "perf": "Performance",
    "performance": "Performance",
    "reliability": "Functional",
    "ux": "Usability",
    "regression": "Functional",
    "accessibility": "Accessibility",
    "compatibility": "Compatibility",
    "destructive": "Destructive",
    "functional": "Functional",
    "other": "Other",
    "usability": "Usability",
    "high": "Functional",
    "medium": "Functional",
    "low": "Functional",
};
/** TestRail Type values */
export const TYPE_VALUES = [
    "Accessibility",
    "Compatibility",
    "Destructive",
    "Functional",
    "Other",
    "Performance",
    "Security",
    "Usability",
];
/** POD values in TestRail */
export const POD_VALUES = [
    "Orchestration",
    "Journeys",
    "Segmentation",
    "Delivery",
    "Core Functions",
    "App Experiences",
    "Product Analytics",
    "Web",
    "Workflows",
    "SDK",
    "Product Integration",
    "Mobile Channels",
    "ONB",
    "SMS-WA-RMKT",
    "EMAIL",
    "PROMO",
    "Ingestion",
    "Mongo-Security & Tools-Dashboard",
];
/** Default status for new cases */
export const DEFAULT_STATUS = "Design";
/** Template name we target (user can override template_id via env) */
export const TEMPLATE_NAME = "Test Case (Text)";
/** Mandatory TestRail CSV headers (in order) for the created TestRail-compatible CSV. */
export const TESTRAIL_MANDATORY_HEADERS = [
    "Title",
    "Framework",
    "Type",
    "POD",
    "References",
    "Preconditions",
    "Steps",
    "Expected Results",
    "Priority",
    "Test Data",
];
/** Internal field name -> TestRail header name (for reporting). */
export const FIELD_TO_TESTRAIL_HEADER = {
    title: "Title",
    framework: "Framework",
    type: "Type",
    pod: "POD",
    references: "References",
    preconditions: "Preconditions",
    steps: "Steps",
    expected_results: "Expected Results",
    priority: "Priority",
    test_data: "Test Data",
};
//# sourceMappingURL=mappings.js.map