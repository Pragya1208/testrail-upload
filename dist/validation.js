import { FRAMEWORK_VALUES, POD_VALUES, TYPE_VALUES } from "./mappings.js";
const MANDATORY_FIELDS = [
    "Title",
    "Framework (ITF→RestAssured, TestCafe→E2E-Testcafe, Manual→None, Dev-Unit→Unit)",
    "Type (Accessibility | Compatibility | Destructive | Functional | Other | Performance | Security | Usability)",
    "Section ID or Group ID (from TestRail URL, e.g. ...&group_id=568)",
    "Template (Test Case (Text))",
    "Status (Design)",
    "POD (e.g. Journeys, Delivery, SDK, ...)",
    "References (JIRA ID)",
];
/** Check if any row has a non-empty value for a field */
function anyRowHas(rows, field) {
    return rows.some((r) => {
        const v = r[field];
        return typeof v === "string" && v.trim() !== "";
    });
}
export function validateRowsAndOverrides(rows, overrides) {
    const missingMandatory = [];
    const rowsMissingTitle = [];
    const rowsMissingFramework = [];
    const rowsMissingType = [];
    if (!overrides?.section_id) {
        missingMandatory.push("section_id or group_id (required; e.g. group_id=568 from URL)");
    }
    const hasPodInCsv = anyRowHas(rows, "pod");
    if (!hasPodInCsv && !overrides?.default_pod) {
        missingMandatory.push(`POD is not present in CSV. Please provide default_pod. Available values: ${POD_VALUES.join(" | ")}`);
    }
    const hasReferencesInCsv = anyRowHas(rows, "references");
    if (!hasReferencesInCsv && !overrides?.default_references) {
        missingMandatory.push("References (JIRA ID) is not present in CSV. Please provide default_references.");
    }
    for (let i = 0; i < rows.length; i++) {
        const row = rows[i];
        if (!row.title?.trim())
            rowsMissingTitle.push(i + 1);
        if (!row.framework?.trim())
            rowsMissingFramework.push(i + 1);
        if (!row.type?.trim())
            rowsMissingType.push(i + 1);
    }
    const valid = overrides?.section_id != null &&
        (hasPodInCsv || overrides?.default_pod != null) &&
        (hasReferencesInCsv || overrides?.default_references != null) &&
        rowsMissingTitle.length === 0 &&
        (rowsMissingFramework.length === 0 || overrides?.default_framework != null) &&
        (rowsMissingType.length === 0 || overrides?.default_type != null);
    let message = "";
    if (missingMandatory.length > 0) {
        message += missingMandatory.map((m) => `- ${m}`).join("\n") + "\n\n";
    }
    if (rowsMissingTitle.length > 0) {
        message += `Rows missing Title (row numbers): ${rowsMissingTitle.slice(0, 20).join(", ")}${rowsMissingTitle.length > 20 ? "..." : ""}.\n`;
    }
    if (rowsMissingFramework.length > 0) {
        message += `Rows missing Framework (row numbers): ${rowsMissingFramework.slice(0, 20).join(", ")}${rowsMissingFramework.length > 20 ? "..." : ""}. Provide default_framework or add Lane column. Available values: ${FRAMEWORK_VALUES.join(" | ")}\n`;
    }
    if (rowsMissingType.length > 0) {
        message += `Rows missing Type (row numbers): ${rowsMissingType.slice(0, 20).join(", ")}${rowsMissingType.length > 20 ? "..." : ""}. Provide default_type or add Risk/Test Type column. Available values: ${TYPE_VALUES.join(" | ")}\n`;
    }
    if (!message) {
        message = "Validation passed.";
    }
    else {
        message =
            "Headers not mapped or present in CSV are required. Please provide the following so we can proceed:\n\n" +
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
export function formatMandatoryHelp() {
    return ("Mandatory fields for TestRail (provide via tool args or ensure CSV has them):\n" +
        MANDATORY_FIELDS.map((f) => `- ${f}`).join("\n") +
        "\n\nFramework mapping: ITF→RestAssured, TestCafe→E2E-Testcafe, Manual→None, Dev-Unit (Dev-owned)→Unit.\n" +
        `Type: one of ${TYPE_VALUES.join(" | ")}.\n` +
        `POD: one of ${POD_VALUES.slice(0, 8).join(", ")} ... (see full list in docs).`);
}
//# sourceMappingURL=validation.js.map