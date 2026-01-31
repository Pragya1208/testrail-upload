import axios, { AxiosInstance } from "axios";
import {
  DEFAULT_STATUS,
  FRAMEWORK_VALUES,
  POD_VALUES,
} from "./mappings.js";
import type { ParsedRow } from "./csv-parser.js";
import { buildStepsFromRow } from "./csv-parser.js";

export interface UploadOptions {
  sectionId: number;
  templateId?: number;
  defaultStatus?: string;
  defaultPOD?: string;
  defaultReferences?: string;
  defaultFramework?: string;
  defaultType?: string;
  /** Custom field IDs/names for your TestRail instance (optional) */
  customFieldFramework?: string;
  customFieldPOD?: string;
  customFieldStatus?: string;
}

export interface ResolvedCase {
  title: string;
  template_id: number;
  type_id?: number;
  priority_id?: number;
  refs?: string;
  custom_preconds?: string;
  custom_steps_separated?: Array<{ content: string; expected: string }>;
  [key: string]: unknown;
}

export interface UploadResult {
  total: number;
  uploaded: number;
  failed: number;
  errors: string[];
  createdIds: Array<{ rowIndex: number; title: string; caseId: number }>;
}

const PRIORITY_MAP: Record<string, number> = {
  critical: 4,
  high: 3,
  medium: 2,
  low: 1,
};

function priorityToId(p: string): number {
  const raw = p.trim().toLowerCase();
  const key = raw.replace(/^p\d+-/, "").trim() || raw;
  return PRIORITY_MAP[key] ?? 2;
}

/** TestRail case types: name -> id (defaults; real IDs come from get_case_types) */
const TYPE_NAME_TO_ID: Record<string, number> = {
  accessibility: 1,
  compatibility: 2,
  destructive: 3,
  functional: 4,
  other: 5,
  performance: 6,
  security: 7,
  usability: 8,
};

function typeToId(t: string): number {
  const key = t.trim().toLowerCase().replace(/\s+/g, "_");
  return TYPE_NAME_TO_ID[key] ?? 4; // default Functional
}

export class TestRailClient {
  private client: AxiosInstance;
  private baseUrl: string;

  constructor(baseUrl: string, username: string, apiKey: string) {
    this.baseUrl = baseUrl.replace(/\/$/, "");
    const auth = Buffer.from(`${username}:${apiKey}`).toString("base64");
    this.client = axios.create({
      baseURL: this.baseUrl,
      headers: {
        Authorization: `Basic ${auth}`,
        "Content-Type": "application/json",
      },
    });
  }

  async getCaseTypes(): Promise<Array<{ id: number; name: string }>> {
    const { data } = await this.client.get("/index.php?/api/v2/get_case_types");
    return data;
  }

  async getTemplates(projectId: number): Promise<Array<{ id: number; name: string }>> {
    const { data } = await this.client.get(
      `/index.php?/api/v2/get_templates/${projectId}`
    );
    return data;
  }

  async getCaseFields(): Promise<unknown[]> {
    const { data } = await this.client.get("/index.php?/api/v2/get_case_fields");
    return data;
  }

  /**
   * Resolve the TestRail custom field name for POD from get_case_fields.
   * Finds a field whose label/name is "POD" and returns the API key (e.g. custom_case_podname).
   * Falls back to "custom_pod" if not found.
   */
  async resolvePodFieldName(): Promise<string> {
    const fields = await this.getCaseFields();
    const podField = (fields as Array<{ name?: string; label?: string; system_name?: string }>).find(
      (f) => {
        const name = (f.name ?? f.label ?? "").toLowerCase();
        return name === "pod" || name.includes("pod");
      }
    );
    if (podField?.system_name) {
      return "custom_" + podField.system_name.replace(/^custom_/, "");
    }
    return "custom_pod";
  }

  /**
   * Resolve template ID by name (e.g. "Test Case (Text)").
   * Falls back to first template or 1 if not found.
   */
  async resolveTemplateId(projectId: number, templateName: string): Promise<number> {
    const templates = await this.getTemplates(projectId);
    const t = templates.find(
      (x) => x.name.toLowerCase() === templateName.toLowerCase()
    );
    return t?.id ?? templates[0]?.id ?? 1;
  }

  /**
   * Build one TestRail case payload from a parsed row and mandatory overrides.
   */
  buildCasePayload(
    row: ParsedRow,
    options: UploadOptions,
    templateId: number
  ): ResolvedCase {
    const title = row.title?.trim() || "(No title)";
    const preconditions = row.preconditions?.trim() || "";
    const steps = buildStepsFromRow(row);

    const payload: ResolvedCase = {
      title,
      template_id: templateId,
      refs: row.references?.trim() || options.defaultReferences || "",
      custom_preconds: preconditions,
    };

    if (row.priority) {
      payload.priority_id = priorityToId(row.priority);
    }
    if (row.type) {
      payload.type_id = typeToId(row.type);
    }
    if (row.estimate) {
      payload.estimate = row.estimate.trim();
    }

    if (steps.length > 0) {
      payload.custom_steps_separated = steps.map((s) => ({
        content: s.content,
        expected: s.expected,
      }));
      // If template supports "Additional Info", some instances use a third field per step.
      // Standard API is content + expected only.
    }

    // Custom fields: Framework, POD, Status (names vary by instance)
    const framework = (row.framework?.trim() || options.defaultFramework || "").trim();
    if (framework && FRAMEWORK_VALUES.includes(framework as (typeof FRAMEWORK_VALUES)[number])) {
      (payload as Record<string, unknown>)[options.customFieldFramework ?? "custom_framework"] = framework;
    }
    const pod = (row.pod?.trim() || options.defaultPOD || "").trim();
    if (pod && POD_VALUES.includes(pod as (typeof POD_VALUES)[number])) {
      (payload as Record<string, unknown>)[options.customFieldPOD ?? "custom_pod"] = pod;
    }
    const status = options.defaultStatus ?? DEFAULT_STATUS;
    (payload as Record<string, unknown>)[options.customFieldStatus ?? "custom_status"] = status;

    if (row.type || options.defaultType) {
      payload.type_id = typeToId(row.type?.trim() || options.defaultType || "Functional");
    }

    return payload;
  }

  /**
   * Add a single test case to a section.
   */
  async addCase(sectionId: number, payload: ResolvedCase): Promise<{ id: number }> {
    const { data } = await this.client.post(
      `/index.php?/api/v2/add_case/${sectionId}`,
      payload
    );
    return data;
  }

  /**
   * Upload multiple parsed rows to TestRail.
   */
  async uploadCases(
    rows: ParsedRow[],
    options: UploadOptions,
    templateId: number,
    batchDelayMs: number = 200
  ): Promise<UploadResult> {
    const optionsWithPOD = { ...options };
    if (!optionsWithPOD.customFieldPOD) {
      optionsWithPOD.customFieldPOD = await this.resolvePodFieldName();
    }
    const result: UploadResult = {
      total: rows.length,
      uploaded: 0,
      failed: 0,
      errors: [],
      createdIds: [],
    };

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      try {
        const payload = this.buildCasePayload(row, optionsWithPOD, templateId);
        const created = await this.addCase(options.sectionId, payload);
        result.uploaded++;
        result.createdIds.push({
          rowIndex: i + 1,
          title: payload.title,
          caseId: created.id,
        });
      } catch (e: unknown) {
        result.failed++;
        const msg = e && typeof e === "object" && "response" in e
          ? (e as { response?: { data?: unknown } }).response?.data
          : e;
        result.errors.push(`Row ${i + 1} (${row.title ?? "no title"}): ${JSON.stringify(msg)}`);
      }
      if (i < rows.length - 1 && batchDelayMs > 0) {
        await new Promise((r) => setTimeout(r, batchDelayMs));
      }
    }

    return result;
  }
}

export function createClientFromEnv(): TestRailClient {
  const url = process.env.TESTRAIL_URL;
  const username = process.env.TESTRAIL_USERNAME;
  const apiKey = process.env.TESTRAIL_API_KEY ?? process.env.TESTRAIL_PASSWORD;
  if (!url || !username || !apiKey) {
    throw new Error(
      "Missing TestRail credentials. Set TESTRAIL_URL, TESTRAIL_USERNAME, and TESTRAIL_API_KEY (or TESTRAIL_PASSWORD) in environment."
    );
  }
  return new TestRailClient(url, username, apiKey);
}
