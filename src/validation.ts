import type { ParsedRow } from "./csv-parser.js";
import { FRAMEWORK_VALUES, POD_VALUES, TYPE_VALUES } from "./mappings.js";

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
  suggestedOverrides: MandatoryOverrides | null;
  message: string;
}

const MANDATORY_FIELDS = [
  "Title",
  "Framework (ITF→RestAssured, TestCafe→E2E-Testcafe, Manual→None, Dev-Unit→Unit)",
  "Type (Accessibility | Compatibility | Destructive | Functional | Other | Performance | Security | Usability)",
  "Section ID",
  "Template (Test Case (Text))",
  "Status (Design)",
  "POD (e.g. Journeys, Delivery, SDK, ...)",
  "References (JIRA ID)",
];

export function validateRowsAndOverrides(
  rows: ParsedRow[],
  overrides: Partial<MandatoryOverrides> | null
): ValidationResult {
  const missingMandatory: string[] = [];
  const rowsMissingTitle: number[] = [];
  const rowsMissingFramework: number[] = [];
  const rowsMissingType: number[] = [];

  if (!overrides?.section_id) {
    missingMandatory.push("section_id (required)");
  }
  if (!overrides?.default_references) {
    missingMandatory.push("default_references (JIRA ID) - optional but recommended");
  }
  if (!overrides?.default_pod) {
    missingMandatory.push("default_pod - optional but recommended");
  }

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    if (!row.title?.trim()) rowsMissingTitle.push(i + 1);
    if (!row.framework?.trim()) rowsMissingFramework.push(i + 1);
    if (!row.type?.trim()) rowsMissingType.push(i + 1);
  }

  const valid =
    overrides?.section_id != null &&
    rowsMissingTitle.length === 0 &&
    (rowsMissingFramework.length === 0 || overrides?.default_framework != null) &&
    (rowsMissingType.length === 0 || overrides?.default_type != null);

  let message = "";
  if (missingMandatory.length > 0) {
    message += `Missing mandatory parameters: ${missingMandatory.join(", ")}.\n`;
  }
  if (rowsMissingTitle.length > 0) {
    message += `Rows missing Title (row numbers): ${rowsMissingTitle.slice(0, 20).join(", ")}${rowsMissingTitle.length > 20 ? "..." : ""}.\n`;
  }
  if (rowsMissingFramework.length > 0) {
    message += `Rows missing Framework (row numbers): ${rowsMissingFramework.slice(0, 20).join(", ")}${rowsMissingFramework.length > 20 ? "..." : ""}. Provide default_framework or add Lane column.\n`;
  }
  if (rowsMissingType.length > 0) {
    message += `Rows missing Type (row numbers): ${rowsMissingType.slice(0, 20).join(", ")}${rowsMissingType.length > 20 ? "..." : ""}. Map Test Type/Risk to Type or provide default_type.\n`;
  }
  if (!message) {
    message = "Validation passed.";
  } else {
    message =
      "Please provide the following before uploading:\n\n" +
      MANDATORY_FIELDS.map((f) => `- ${f}`).join("\n") +
      "\n\nValidation issues:\n" +
      message;
  }

  return {
    valid,
    missingMandatory,
    rowsMissingTitle,
    rowsMissingFramework,
    rowsMissingType,
    suggestedOverrides: overrides ?? null,
    message,
  };
}

export function formatMandatoryHelp(): string {
  return (
    "Mandatory fields for TestRail (provide via tool args or ensure CSV has them):\n" +
    MANDATORY_FIELDS.map((f) => `- ${f}`).join("\n") +
    "\n\nFramework mapping: ITF→RestAssured, TestCafe→E2E-Testcafe, Manual→None, Dev-Unit (Dev-owned)→Unit.\n" +
    `Type: one of ${TYPE_VALUES.join(" | ")}.\n` +
    `POD: one of ${POD_VALUES.slice(0, 8).join(", ")} ... (see full list in docs).`
  );
}
