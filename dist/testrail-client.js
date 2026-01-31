import axios from "axios";
import { DEFAULT_STATUS, FRAMEWORK_VALUES, POD_VALUES, } from "./mappings.js";
import { buildStepsFromRow } from "./csv-parser.js";
const PRIORITY_MAP = {
    critical: 4,
    high: 3,
    medium: 2,
    low: 1,
};
function priorityToId(p) {
    const raw = p.trim().toLowerCase();
    const key = raw.replace(/^p\d+-/, "").trim() || raw;
    return PRIORITY_MAP[key] ?? 2;
}
/** TestRail case types: name -> id (defaults; real IDs come from get_case_types) */
const TYPE_NAME_TO_ID = {
    accessibility: 1,
    compatibility: 2,
    destructive: 3,
    functional: 4,
    other: 5,
    performance: 6,
    security: 7,
    usability: 8,
};
function typeToId(t) {
    const key = t.trim().toLowerCase().replace(/\s+/g, "_");
    return TYPE_NAME_TO_ID[key] ?? 4; // default Functional
}
export class TestRailClient {
    client;
    baseUrl;
    constructor(baseUrl, username, apiKey) {
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
    async getCaseTypes() {
        const { data } = await this.client.get("/index.php?/api/v2/get_case_types");
        return data;
    }
    async getTemplates(projectId) {
        const { data } = await this.client.get(`/index.php?/api/v2/get_templates/${projectId}`);
        return data;
    }
    async getCaseFields() {
        const { data } = await this.client.get("/index.php?/api/v2/get_case_fields");
        return data;
    }
    /**
     * Resolve the TestRail custom field name for Framework/Automation from get_case_fields.
     * Finds a field whose label/name contains "framework" or "automation" (e.g. custom_case_automation_framework).
     */
    async resolveFrameworkFieldName() {
        const fields = (await this.getCaseFields());
        const f = fields.find((field) => {
            const n = (field.name ?? field.label ?? "").toLowerCase();
            return n.includes("framework") || n.includes("automation");
        });
        if (f?.system_name) {
            return "custom_" + f.system_name.replace(/^custom_/, "");
        }
        return "custom_framework";
    }
    /**
     * Resolve the TestRail custom field name for POD from get_case_fields.
     * Finds a field whose label/name is "POD" and returns the API key (e.g. custom_case_podname).
     * Falls back to "custom_pod" if not found.
     */
    async resolvePodFieldName() {
        const { fieldName } = await this.resolvePodFieldNameAndOptions();
        return fieldName;
    }
    /**
     * Resolve POD field name and dropdown options (label -> id) from get_case_fields.
     * Dropdown fields require numeric IDs; this parses configs[].options.items (e.g. "1, Orchestration\n2, Journeys").
     */
    async resolvePodFieldNameAndOptions() {
        const fields = (await this.getCaseFields());
        const podField = fields.find((f) => {
            const name = (f.name ?? f.label ?? "").toLowerCase();
            return name === "pod" || name.includes("pod");
        });
        const fieldName = podField?.system_name
            ? "custom_" + podField.system_name.replace(/^custom_/, "")
            : "custom_pod";
        const labelToId = {};
        let configs = podField?.configs;
        if (typeof configs === "string") {
            try {
                configs = JSON.parse(configs);
            }
            catch {
                configs = undefined;
            }
        }
        if (podField?.type_id === 6 && Array.isArray(configs) && configs.length > 0) {
            const itemsStr = configs[0]?.options?.items ?? "";
            for (const line of itemsStr.split(/\n/)) {
                const match = line.match(/^\s*(\d+)\s*,\s*(.+)$/);
                if (match) {
                    const id = parseInt(match[1], 10);
                    const label = match[2].trim();
                    labelToId[label] = id;
                }
            }
        }
        return { fieldName, labelToId };
    }
    /**
     * Resolve template ID by name (e.g. "Test Case (Text)").
     * Falls back to first template or 1 if not found.
     */
    async resolveTemplateId(projectId, templateName) {
        const templates = await this.getTemplates(projectId);
        const t = templates.find((x) => x.name.toLowerCase() === templateName.toLowerCase());
        return t?.id ?? templates[0]?.id ?? 1;
    }
    /**
     * Build one TestRail case payload from a parsed row and mandatory overrides.
     */
    buildCasePayload(row, options, templateId) {
        const title = row.title?.trim() || "(No title)";
        const preconditions = row.preconditions?.trim() || "";
        const steps = buildStepsFromRow(row);
        const payload = {
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
        const frameworkValue = framework && FRAMEWORK_VALUES.includes(framework)
            ? framework
            : options.defaultFramework?.trim() && FRAMEWORK_VALUES.includes(options.defaultFramework.trim())
                ? options.defaultFramework.trim()
                : null;
        if (frameworkValue) {
            payload[options.customFieldFramework ?? "custom_framework"] = frameworkValue;
        }
        const pod = (row.pod?.trim() || options.defaultPOD || "").trim();
        if (pod && POD_VALUES.includes(pod)) {
            const podFieldKey = options.customFieldPOD ?? "custom_pod";
            let podValue = pod;
            if (options.podLabelToId && Object.keys(options.podLabelToId).length > 0) {
                const idByExact = options.podLabelToId[pod];
                const idByLower = idByExact ??
                    Object.entries(options.podLabelToId).find(([k]) => k.toLowerCase() === pod.toLowerCase())?.[1];
                if (idByExact !== undefined || idByLower !== undefined) {
                    podValue = idByExact ?? idByLower;
                }
            }
            payload[podFieldKey] = podValue;
        }
        const status = options.defaultStatus ?? DEFAULT_STATUS;
        payload[options.customFieldStatus ?? "custom_status"] = status;
        if (row.type || options.defaultType) {
            payload.type_id = typeToId(row.type?.trim() || options.defaultType || "Functional");
        }
        return payload;
    }
    /**
     * Add a single test case to a section.
     */
    async addCase(sectionId, payload) {
        const { data } = await this.client.post(`/index.php?/api/v2/add_case/${sectionId}`, payload);
        return data;
    }
    /**
     * Upload multiple parsed rows to TestRail.
     */
    async uploadCases(rows, options, templateId, batchDelayMs = 200) {
        const optionsWithPOD = { ...options };
        if (!optionsWithPOD.customFieldPOD || !optionsWithPOD.podLabelToId) {
            const resolved = await this.resolvePodFieldNameAndOptions();
            optionsWithPOD.customFieldPOD = resolved.fieldName;
            if (Object.keys(resolved.labelToId).length > 0) {
                optionsWithPOD.podLabelToId = resolved.labelToId;
            }
        }
        if (!optionsWithPOD.customFieldFramework) {
            optionsWithPOD.customFieldFramework = await this.resolveFrameworkFieldName();
        }
        const result = {
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
            }
            catch (e) {
                result.failed++;
                const msg = e && typeof e === "object" && "response" in e
                    ? e.response?.data
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
export function createClientFromEnv() {
    const url = process.env.TESTRAIL_URL;
    const username = process.env.TESTRAIL_USERNAME;
    const apiKey = process.env.TESTRAIL_API_KEY ?? process.env.TESTRAIL_PASSWORD;
    if (!url || !username || !apiKey) {
        throw new Error("Missing TestRail credentials. Set TESTRAIL_URL, TESTRAIL_USERNAME, and TESTRAIL_API_KEY (or TESTRAIL_PASSWORD) in environment.");
    }
    return new TestRailClient(url, username, apiKey);
}
//# sourceMappingURL=testrail-client.js.map