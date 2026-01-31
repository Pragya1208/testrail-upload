#!/usr/bin/env node

// Log startup early (stderr) so we see output before any async code
console.error("[testrail-upload] Starting MCP server...");

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import fs from "fs/promises";
import * as dotenv from "dotenv";
import { parseCSV } from "./csv-parser.js";
import { createClientFromEnv, TestRailClient } from "./testrail-client.js";
import {
  validateRowsAndOverrides,
  formatMandatoryHelp,
  formatHeaderCheckReport,
  type MandatoryOverrides,
} from "./validation.js";
import { TEMPLATE_NAME, TESTRAIL_MANDATORY_HEADERS } from "./mappings.js";
import type { ParsedRow } from "./csv-parser.js";

dotenv.config();

/** TestRail-format CSV header (all mandatory headers for upload). */
const TESTRAIL_FORMAT_HEADER = TESTRAIL_MANDATORY_HEADERS.join(",");

/**
 * Build TestRail-compatible CSV with all mandatory headers.
 * Transfers values row by row from parsed rows (mappings already applied in parse step).
 */
function buildTestRailFormatCsv(rows: ParsedRow[]): string {
  const escape = (s: string) =>
    s.includes(",") || s.includes('"') || s.includes("\n")
      ? `"${s.replace(/"/g, '""')}"`
      : s;
  const cleanRows = rows.map((r) => {
    const title = r.title?.trim() ?? "";
    const framework = r.framework?.trim() ?? "";
    const type = r.type?.trim() ?? "";
    const pod = r.pod?.trim() ?? "";
    const refs = r.references?.trim() ?? "";
    const pre = r.preconditions?.trim() ?? "";
    const steps = r.steps?.trim() ?? "";
    const expected = r.expected_results?.trim() ?? "";
    const priority = r.priority?.trim() ?? "";
    const testData = r.test_data?.trim() ?? "";
    return [title, framework, type, pod, refs, pre, steps, expected, priority, testData]
      .map(escape)
      .join(",");
  });
  return TESTRAIL_FORMAT_HEADER + "\n" + cleanRows.join("\n");
}

const MCP_SERVER_NAME = "testrail-upload";
const MCP_SERVER_VERSION = "1.0.0";

const server = new Server(
  {
    name: MCP_SERVER_NAME,
    version: MCP_SERVER_VERSION,
  },
  { capabilities: { tools: {} } }
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    {
      name: "upload_test_cases_to_testrail",
      description:
        "Upload test cases from a CSV file to TestRail. Always converts the CSV to TestRail format first (same as convert_csv_to_testrail_format), then validates and uploads. " +
        "Requires TESTRAIL_URL, TESTRAIL_USERNAME, TESTRAIL_API_KEY in environment. " +
        "Mandatory: section_id (or group_id). If CSV misses Title, Framework, Type, POD, or References, the tool asks you to provide them (e.g. default_pod) and shows available values.",
      inputSchema: {
        type: "object",
        properties: {
          csv_file_path: {
            type: "string",
            description:
              "Absolute or relative path to the CSV file containing test cases",
          },
          csv_content: {
            type: "string",
            description:
              "Raw CSV content (use when file path is not available). Ignored if csv_file_path is provided.",
          },
          section_id: {
            type: "number",
            description:
              "TestRail section ID where cases will be added. Use section_id OR group_id (from URL e.g. group_id=568).",
          },
          group_id: {
            type: "number",
            description:
              "TestRail group/section ID from the suite URL (e.g. ...&group_id=568). Used as section_id when section_id not provided.",
          },
          project_id: {
            type: "number",
            description:
              "TestRail project ID (required to resolve template by name if template_id not provided)",
          },
          template_id: {
            type: "number",
            description:
              "TestRail template ID. Default: resolved from project as 'Test Case (Text)' if project_id given",
          },
          default_pod: {
            type: "string",
            description:
              "Default POD value (e.g. Journeys, Delivery, SDK). One of: Orchestration | Journeys | Segmentation | Delivery | Core Functions | App Experiences | Product Analytics | Web | Workflows | SDK | Product Integration | Mobile Channels | ONB | SMS-WA-RMKT | EMAIL | PROMO | Ingestion | Mongo-Security & Tools-Dashboard",
          },
          default_references: {
            type: "string",
            description: "Default JIRA ID / references for all cases",
          },
          default_framework: {
            type: "string",
            description:
              "Default Framework if not in CSV: None | E2E-Testcafe | RestAssured | Mobile | Unit",
          },
          default_type: {
            type: "string",
            description:
              "Default Type when Risk (CSV) is absent; default is Functional. Values: Accessibility | Compatibility | Destructive | Functional | Other | Performance | Security | Usability",
          },
          default_status: {
            type: "string",
            description: "TestRail status for new cases (default: Design)",
            default: "Design",
          },
          batch_delay_ms: {
            type: "number",
            description: "Delay between API calls in ms (default: 200)",
            default: 200,
          },
          dry_run: {
            type: "boolean",
            description:
              "If true, only parse and validate CSV; do not upload to TestRail",
            default: false,
          },
        },
        required: [],
      },
    },
    {
      name: "convert_csv_to_testrail_format",
      description:
        "Convert user CSV to a clean TestRail-ready CSV with mandatory columns (Title, Framework, Type, POD, References, Preconditions, Steps, Expected Results, Priority, Test Data). Does NOT assume defaults; returns the cleaned CSV and a report of which rows have which mandatory fields missing so the user can fill them.",
      inputSchema: {
        type: "object",
        properties: {
          csv_file_path: { type: "string", description: "Path to the CSV file" },
          csv_content: { type: "string", description: "Raw CSV content" },
          output_path: {
            type: "string",
            description: "Optional path to write the cleaned CSV file",
          },
        },
      },
    },
    {
      name: "testrail_upload_help",
      description:
        "Return mandatory fields and mapping documentation for TestRail CSV upload (no upload performed).",
      inputSchema: {
        type: "object",
        properties: {},
      },
    },
  ],
}));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;
  const argsObj = (args as Record<string, unknown>) || {};

  try {
    if (name === "testrail_upload_help") {
      return {
        content: [
          {
            type: "text" as const,
            text: formatMandatoryHelp(),
          },
        ],
      };
    }

    if (name === "convert_csv_to_testrail_format") {
      let csvContent: string;
      if (argsObj.csv_file_path && typeof argsObj.csv_file_path === "string") {
        csvContent = await fs.readFile(argsObj.csv_file_path, "utf-8");
      } else if (argsObj.csv_content && typeof argsObj.csv_content === "string") {
        csvContent = argsObj.csv_content;
      } else {
        return {
          content: [
            {
              type: "text" as const,
              text: "Error: Provide csv_file_path or csv_content for convert_csv_to_testrail_format.",
            },
          ],
        };
      }
      const parseResult = parseCSV(csvContent);
      if (parseResult.errors.length > 0) {
        return {
          content: [
            { type: "text" as const, text: `CSV parse errors:\n${parseResult.errors.join("\n")}` },
          ],
        };
      }
      const headerCheck = formatHeaderCheckReport(parseResult);
      const cleanCsv = buildTestRailFormatCsv(parseResult.rows);
      const missingPerRow: string[] = [];
      parseResult.rows.forEach((r, i) => {
        const missing: string[] = [];
        if (!r.title?.trim()) missing.push("Title");
        if (!r.framework?.trim()) missing.push("Framework");
        if (!r.type?.trim()) missing.push("Type");
        if (!r.references?.trim()) missing.push("References");
        if (!r.pod?.trim()) missing.push("POD");
        if (missing.length) missingPerRow.push(`Row ${i + 1}: ${missing.join(", ")}`);
      });
      const outputPath =
        typeof argsObj.output_path === "string" ? argsObj.output_path : undefined;
      if (outputPath) await fs.writeFile(outputPath, cleanCsv);
      const report =
        missingPerRow.length > 0
          ? "Missing mandatory fields (do not assume defaults; please fill or provide when uploading):\n" +
            missingPerRow.join("\n")
          : "All mandatory columns have values. You can upload after setting section_id or group_id.";
      return {
        content: [
          {
            type: "text" as const,
            text:
              "1) Header check (provided CSV → TestRail mapping):\n" +
              headerCheck +
              "\n\n2) New CSV created with TestRail-compatible headers; values transferred row by row.\n\n" +
              report +
              "\n\n" +
              (outputPath ? `Cleaned CSV written to: ${outputPath}\n\n` : "") +
              "First 3 rows of cleaned CSV:\n" +
              cleanCsv.split("\n").slice(0, 4).join("\n"),
          },
        ],
      };
    }

    if (name !== "upload_test_cases_to_testrail") {
      return {
        content: [{ type: "text" as const, text: `Unknown tool: ${name}` }],
      };
    }

    let csvContent: string;
    if (argsObj.csv_file_path && typeof argsObj.csv_file_path === "string") {
      csvContent = await fs.readFile(argsObj.csv_file_path, "utf-8");
    } else if (argsObj.csv_content && typeof argsObj.csv_content === "string") {
      csvContent = argsObj.csv_content;
    } else {
      return {
        content: [
          {
            type: "text" as const,
            text:
              "Error: Provide either csv_file_path or csv_content to upload test cases.",
          },
        ],
      };
    }

    // ─── Step 1: Check provided CSV headers and create TestRail-compatible CSV ───
    // Parse the provided CSV and check headers against mappings.
    const parseResult = parseCSV(csvContent);
    if (parseResult.errors.length > 0) {
      return {
        content: [
          {
            type: "text" as const,
            text: `CSV parse errors:\n${parseResult.errors.join("\n")}`,
          },
        ],
      };
    }

    const headerCheckReport = formatHeaderCheckReport(parseResult);

    const sectionIdArg =
      typeof argsObj.section_id === "number"
        ? argsObj.section_id
        : typeof argsObj.group_id === "number"
          ? argsObj.group_id
          : undefined;
    const overrides: MandatoryOverrides = {
      section_id: sectionIdArg as number,
      default_pod: typeof argsObj.default_pod === "string" ? argsObj.default_pod : undefined,
      default_references:
        typeof argsObj.default_references === "string"
          ? argsObj.default_references
          : undefined,
      default_framework:
        typeof argsObj.default_framework === "string"
          ? argsObj.default_framework
          : undefined,
      default_type:
        typeof argsObj.default_type === "string" ? argsObj.default_type : undefined,
      template_id:
        typeof argsObj.template_id === "number" ? argsObj.template_id : undefined,
      default_status:
        typeof argsObj.default_status === "string"
          ? argsObj.default_status
          : "Design",
    };

    if (sectionIdArg == null) {
      return {
        content: [
          {
            type: "text" as const,
            text:
              "Error: Provide either section_id or group_id (e.g. from TestRail URL: ...&group_id=568). Do not assume defaults.",
          },
        ],
      };
    }

    // Validate: section_id and defaults for missing mandatory headers (POD, References, etc.).
    const validation = validateRowsAndOverrides(parseResult.rows, overrides);

    if (argsObj.dry_run === true) {
      const summary = [
        headerCheckReport,
        "",
        `Parsed ${parseResult.rows.length} rows.`,
        `Column map: ${JSON.stringify(parseResult.columnMap)}`,
        validation.message,
      ].join("\n\n");
      return {
        content: [{ type: "text" as const, text: summary }],
      };
    }

    if (!validation.valid) {
      return {
        content: [
          {
            type: "text" as const,
            text:
              "Step 1 – Header check and validation failed.\n\n" +
              headerCheckReport +
              "\n\n" +
              validation.message,
          },
        ],
      };
    }

    // ─── Step 2: Create new CSV with TestRail-compatible headers and transfer values row by row ───
    // Apply defaults so mandatory columns (POD, References, Framework, Type) are filled.
    // Type (TestRail) is mapped from Risk (CSV); if Risk is absent, default is Functional.
    const defaultFramework =
      typeof argsObj.default_framework === "string"
        ? argsObj.default_framework
        : undefined;
    const defaultType =
      typeof argsObj.default_type === "string" ? argsObj.default_type : "Functional";
    const defaultPod =
      typeof argsObj.default_pod === "string" ? argsObj.default_pod : undefined;
    const defaultReferences =
      typeof argsObj.default_references === "string"
        ? argsObj.default_references
        : undefined;
    const rowsWithDefaults = parseResult.rows.map((r) => ({
      ...r,
      framework: r.framework?.trim() || defaultFramework || r.framework,
      type: r.type?.trim() || defaultType || r.type,
      pod: r.pod?.trim() || defaultPod || r.pod,
      references: r.references?.trim() || defaultReferences || r.references,
    }));

    // Build new CSV with all mandatory TestRail headers; values transferred row by row per mapping.
    const testRailFormatCsv = buildTestRailFormatCsv(rowsWithDefaults);
    const parseResult2 = parseCSV(testRailFormatCsv);
    if (parseResult2.errors.length > 0) {
      return {
        content: [
          {
            type: "text" as const,
            text: `Step 2 – TestRail-format CSV parse errors:\n${parseResult2.errors.join("\n")}`,
          },
        ],
      };
    }

    const rows = parseResult2.rows;

    // ─── Step 3: Upload the created TestRail-compatible CSV to TestRail ───
    const sectionId = Number(sectionIdArg);
    const projectId =
      typeof argsObj.project_id === "number" ? argsObj.project_id : undefined;
    let templateId =
      typeof argsObj.template_id === "number" ? argsObj.template_id : undefined;
    const batchDelayMs =
      typeof argsObj.batch_delay_ms === "number" ? argsObj.batch_delay_ms : 200;

    let client: TestRailClient;
    try {
      client = createClientFromEnv();
    } catch (e) {
      return {
        content: [
          {
            type: "text" as const,
            text:
              "TestRail credentials not set. Set TESTRAIL_URL, TESTRAIL_USERNAME, and TESTRAIL_API_KEY (or TESTRAIL_PASSWORD) in environment.",
          },
        ],
      };
    }

    if (templateId == null && projectId != null) {
      try {
        templateId = await client.resolveTemplateId(projectId, TEMPLATE_NAME);
      } catch {
        templateId = 1;
      }
    }
    if (templateId == null) templateId = 1;

    const uploadOptions = {
      sectionId,
      templateId,
      defaultStatus:
        typeof argsObj.default_status === "string"
          ? argsObj.default_status
          : "Design",
      defaultPOD:
        typeof argsObj.default_pod === "string" ? argsObj.default_pod : undefined,
      defaultReferences:
        typeof argsObj.default_references === "string"
          ? argsObj.default_references
          : undefined,
      defaultFramework,
      defaultType: defaultType ?? "Functional",
    };

    const result = await client.uploadCases(
      rows,
      uploadOptions,
      templateId,
      batchDelayMs
    );

    const successRate =
      result.total > 0
        ? ((result.uploaded / result.total) * 100).toFixed(1)
        : "0";
    const report = [
      "TestRail upload complete.",
      `Total: ${result.total}, Uploaded: ${result.uploaded}, Failed: ${result.failed}, Success rate: ${successRate}%`,
      result.createdIds.length > 0
        ? "Created case IDs (first 10): " +
          result.createdIds
            .slice(0, 10)
            .map((c) => `#${c.caseId} (${c.title})`)
            .join("; ")
        : "",
      result.errors.length > 0
        ? "Errors:\n" + result.errors.slice(0, 5).join("\n")
        : "",
    ]
      .filter(Boolean)
      .join("\n");

    return {
      content: [{ type: "text" as const, text: report }],
    };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : String(error);
    return {
      content: [{ type: "text" as const, text: `Error: ${message}` }],
    };
  }
});

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error(`${MCP_SERVER_NAME} v${MCP_SERVER_VERSION} started`);
}

main().catch((err) => {
  console.error("[testrail-upload] Fatal error:", err);
  process.exit(1);
});
