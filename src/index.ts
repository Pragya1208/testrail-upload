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
  type MandatoryOverrides,
} from "./validation.js";
import { TEMPLATE_NAME } from "./mappings.js";

dotenv.config();

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
        "Upload test cases from a CSV file to TestRail. Reads CSV with columns mapped to TestRail fields. " +
        "Requires TESTRAIL_URL, TESTRAIL_USERNAME, TESTRAIL_API_KEY in environment. " +
        "Mandatory: section_id. If CSV misses Title, Framework, Type, POD, or References, provide them via arguments or the tool will return a validation message asking for them.",
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
              "Default Type if not in CSV: Accessibility | Compatibility | Destructive | Functional | Other | Performance | Security | Usability",
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
      const cleanHeader =
        "Title,Framework,Type,POD,References,Preconditions,Steps,Expected Results,Priority,Test Data";
      const escape = (s: string) =>
        s.includes(",") || s.includes('"') || s.includes("\n")
          ? `"${s.replace(/"/g, '""')}"`
          : s;
      const missingPerRow: string[] = [];
      const cleanRows = parseResult.rows.map((r, i) => {
        const title = r.title?.trim() ?? "";
        const framework = r.framework?.trim() ?? "";
        const type = r.type?.trim() ?? "";
        const pod = "";
        const refs = r.references?.trim() ?? "";
        const pre = r.preconditions?.trim() ?? "";
        const steps = r.steps?.trim() ?? "";
        const expected = r.expected_results?.trim() ?? "";
        const priority = r.priority?.trim() ?? "";
        const testData = r.test_data?.trim() ?? "";
        const missing: string[] = [];
        if (!title) missing.push("Title");
        if (!framework) missing.push("Framework");
        if (!type) missing.push("Type");
        if (!refs) missing.push("References");
        if (missing.length) missingPerRow.push(`Row ${i + 1}: ${missing.join(", ")}`);
        return [title, framework, type, pod, refs, pre, steps, expected, priority, testData]
          .map(escape)
          .join(",");
      });
      const cleanCsv = cleanHeader + "\n" + cleanRows.join("\n");
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
              "Cleaned CSV with mandatory columns (Title, Framework, Type, POD, References, Preconditions, Steps, Expected Results, Priority, Test Data):\n\n" +
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

    const validation = validateRowsAndOverrides(parseResult.rows, overrides);

    if (argsObj.dry_run === true) {
      const summary = [
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
              "Validation failed. Do not assume defaults. Please provide the following so we can proceed:\n\n" +
              validation.message,
          },
        ],
      };
    }

    // Apply defaults for missing framework/type per row
    const defaultFramework =
      typeof argsObj.default_framework === "string"
        ? argsObj.default_framework
        : undefined;
    const defaultType =
      typeof argsObj.default_type === "string" ? argsObj.default_type : undefined;
    const rows = parseResult.rows.map((r) => ({
      ...r,
      framework: r.framework?.trim() || defaultFramework || r.framework,
      type: r.type?.trim() || defaultType || r.type,
    }));
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
      defaultType,
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
