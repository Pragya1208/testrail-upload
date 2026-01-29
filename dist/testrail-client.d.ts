import type { ParsedRow } from "./csv-parser.js";
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
    custom_steps_separated?: Array<{
        content: string;
        expected: string;
    }>;
    [key: string]: unknown;
}
export interface UploadResult {
    total: number;
    uploaded: number;
    failed: number;
    errors: string[];
    createdIds: Array<{
        rowIndex: number;
        title: string;
        caseId: number;
    }>;
}
export declare class TestRailClient {
    private client;
    private baseUrl;
    constructor(baseUrl: string, username: string, apiKey: string);
    getCaseTypes(): Promise<Array<{
        id: number;
        name: string;
    }>>;
    getTemplates(projectId: number): Promise<Array<{
        id: number;
        name: string;
    }>>;
    getCaseFields(): Promise<unknown[]>;
    /**
     * Resolve template ID by name (e.g. "Test Case (Text)").
     * Falls back to first template or 1 if not found.
     */
    resolveTemplateId(projectId: number, templateName: string): Promise<number>;
    /**
     * Build one TestRail case payload from a parsed row and mandatory overrides.
     */
    buildCasePayload(row: ParsedRow, options: UploadOptions, templateId: number): ResolvedCase;
    /**
     * Add a single test case to a section.
     */
    addCase(sectionId: number, payload: ResolvedCase): Promise<{
        id: number;
    }>;
    /**
     * Upload multiple parsed rows to TestRail.
     */
    uploadCases(rows: ParsedRow[], options: UploadOptions, templateId: number, batchDelayMs?: number): Promise<UploadResult>;
}
export declare function createClientFromEnv(): TestRailClient;
//# sourceMappingURL=testrail-client.d.ts.map