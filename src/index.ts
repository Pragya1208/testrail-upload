#!/usr/bin/env node

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

const MCP_SERVER_NAME = "testrail-upload-mcp";
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
              "TestRail section ID where cases will be added (mandatory)",
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
        required: ["section_id"],
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

    const overrides: MandatoryOverrides = {
      section_id: Number(argsObj.section_id),
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
              "Validation failed. Please provide missing mandatory fields (e.g. section_id, default_framework, default_type if not in CSV). Ensure every row has a Title.\n\n" +
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
    const sectionId = Number(argsObj.section_id);
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

main().catch(console.error);
