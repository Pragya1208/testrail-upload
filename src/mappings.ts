/**
 * CSV column name variants -> internal field key.
 * First match wins when detecting columns.
 */
export const CSV_COLUMN_ALIASES: Record<string, string> = {
  "testcase_id": "id",
  "test case id": "id",
  "scenario title": "title",
  "test case title": "title",
  "title": "title",
  "lane": "framework",
  "framework": "framework",
  "priority": "priority",
  "test type": "type",
  "risk": "type",
  "type": "type",
  "preconditions": "preconditions",
  "config": "preconditions",
  "trigger": "steps",
  "action": "steps",
  "test steps": "steps",
  "steps": "steps",
  "expected results": "expected_results",
  "expected result": "expected_results",
  "covered?": "covered",
  "covered": "covered",
  "test data": "test_data",
  "references": "references",
  "refs": "references",
  "pod": "pod",
  "estimate": "estimate",
};

/** Lane (CSV) -> TestRail Framework */
export const LANE_TO_FRAMEWORK: Record<string, string> = {
  "itf": "RestAssured",
  "testcafe": "E2E-Testcafe",
  "manual": "None",
  "dev-unit (dev-owned)": "Unit",
  "dev-unit": "Unit",
};

/** TestRail Framework values (for custom_framework or equivalent) */
export const FRAMEWORK_VALUES = ["None", "E2E-Testcafe", "RestAssured", "Mobile", "Unit"] as const;

/** Risk/Test Type (CSV) -> TestRail Type */
export const RISK_TO_TYPE: Record<string, string> = {
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
] as const;

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
] as const;

/** Default status for new cases */
export const DEFAULT_STATUS = "Design";

/** Template name we target (user can override template_id via env) */
export const TEMPLATE_NAME = "Test Case (Text)";
