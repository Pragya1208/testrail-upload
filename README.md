# TestRail Upload MCP

MCP (Model Context Protocol) server for uploading test cases from CSV to TestRail. Designed to be hosted on GitHub and integrated with AI assistants (Cursor, Claude, Windsurf) via JSON configuration.

## Features

- **CSV input**: Upload test cases from a CSV file or raw CSV content
- **Convert-then-upload flow**: `upload_test_cases_to_testrail` always converts the CSV to TestRail format first (same as `convert_csv_to_testrail_format`), then validates and uploads
- **Environment-based credentials**: TestRail URL, username, and API key via env vars
- **Column mapping**: Flexible CSV column names mapped to TestRail fields (including POD)
- **Mandatory fields**: Validates and prompts for required fields; if a header is not mapped or present (e.g. POD), the tool asks you to provide it and shows **available values** (e.g. POD: Orchestration \| Journeys \| …)
- **Dry run**: Parse and validate CSV without uploading

## CSV Column Mapping

| CSV Column (any of) | Maps To | Notes |
|--------------------|---------|--------|
| TestCase_ID / Test Case ID | ID | Reference only |
| Scenario title / Test Case Title / Title | Title | **Mandatory** |
| Lane | Framework | ITF→RestAssured, TestCafe→E2E-Testcafe, Manual→None, Dev-Unit (Dev-owned)→Unit |
| Priority | Priority | Critical, High, Medium, Low |
| Test Type / Risk | Type | correctness/data/reliability/regression→Functional, security→Security, perf→Performance, UX→Usability, etc. |
| Preconditions / config | Preconditions | |
| Trigger / action / Test Steps | Steps (content) | |
| Expected Results | Steps (expected) | |
| Test Data | Steps (additional info) | Merged into step content |
| Covered? (Yes/No/Manual) | — | Not sent to TestRail by default |
| References / refs | References | JIRA ID; **recommended** |
| POD | POD | See POD Values below |

## Mandatory Fields (TestRail)

Provide via tool arguments or ensure CSV has them:

- **Title** – every row must have a title
- **Framework** – None \| E2E-Testcafe \| RestAssured \| Mobile \| Unit (or Lane column with ITF/TestCafe/Manual/Dev-Unit)
- **Type** – Accessibility \| Compatibility \| Destructive \| Functional \| Other \| Performance \| Security \| Usability
- **Section ID** – TestRail section where cases will be added (required)
- **Template** – "Test Case (Text)" (template_id resolved from project if `project_id` provided)
- **Status** – Design (default)
- **POD** – e.g. Journeys, Delivery, SDK (see full list below)
- **References** – JIRA ID of task

### POD Values

Orchestration \| Journeys \| Segmentation \| Delivery \| Core Functions \| App Experiences \| Product Analytics \| Web \| Workflows \| SDK \| Product Integration \| Mobile Channels \| ONB \| SMS-WA-RMKT \| EMAIL \| PROMO \| Ingestion \| Mongo-Security & Tools-Dashboard

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `TESTRAIL_URL` | Yes | TestRail base URL (e.g. `https://your-instance.testrail.com`) |
| `TESTRAIL_USERNAME` | Yes | Email or username |
| `TESTRAIL_API_KEY` or `TESTRAIL_PASSWORD` | Yes | API key or password |
| `TESTRAIL_TEMPLATE_ID` | No | Override template ID (default: resolved from project) |

## Installation

### npx from GitHub (no local install)

Use **npx** to run from a GitHub repo; npx will clone and build automatically 

```json
{
  "mcpServers": {
    "testrail-upload": {
      "command": "npx",
      "args": ["github:Pragya1208/testrail-upload"],
      "env": {
        "TESTRAIL_URL": "https://your-instance.testrail.com",
        "TESTRAIL_USERNAME": "your-email@example.com",
        "TESTRAIL_API_KEY": "your-api-key"
      }
    }
  }
}
```

Replace `Pragya1208` with your GitHub username if you forked the repo.

### Local clone (optional)

```bash
git clone https://github.com/Pragya1208/testrail-upload.git
cd testrail-upload
npm install
npm run build
```

Then point your MCP config at `.../testrail-upload/dist/index.js` (see [INTEGRATION.md](./INTEGRATION.md)).

## Usage (MCP)

### How to use in Cursor

1. **Add the MCP server** to Cursor config (`~/.cursor/mcp.json`):
   ```json
   {
     "mcpServers": {
       "testrail-upload": {
         "command": "npx",
         "args": ["github:Pragya1208/testrail-upload"],
         "env": {
           "TESTRAIL_URL": "https://your-instance.testrail.com",
           "TESTRAIL_USERNAME": "your-email@example.com",
           "TESTRAIL_API_KEY": "your-api-key"
         }
       }
     }
   }
   ```
2. **Restart Cursor** (or reload the window) so it connects to the MCP server.
3. **Call the tools from chat** – you don’t click a button; you ask in natural language and the AI uses the tools when relevant. Examples:
   - *“Run testrail_upload_help and show me the mandatory fields and mapping.”*
   - *“Upload test cases from the CSV at /path/to/my-tests.csv to TestRail section 12345, project 5, with default POD Journeys and default references CHAN-7186.”*
   - *“Validate only (no upload): parse the CSV at ./tests.csv for section_id 12345 and default_framework RestAssured. Use dry_run.”*

### Tools

| Tool | Purpose |
|------|--------|
| **testrail_upload_help** | Returns mandatory fields and CSV → TestRail mapping (no upload). |
| **upload_test_cases_to_testrail** | Parses CSV and uploads test cases to TestRail. |

**upload_test_cases_to_testrail** parameters:

- **csv_file_path** or **csv_content** – input CSV
- **section_id** or **group_id** (one required) – TestRail section/group ID. Use **group_id** from the suite URL (e.g. `...&group_id=568`).
- **project_id** (optional) – used to resolve "Test Case (Text)" template
- **template_id** (optional) – override template ID
- **default_pod**, **default_references**, **default_framework**, **default_type** – only used when you explicitly pass them; no defaults are assumed for missing CSV fields. If mandatory fields are missing, the tool prompts you to provide them.
- **dry_run** – `true` to only parse/validate, no upload

**convert_csv_to_testrail_format** – Converts your CSV to a clean TestRail-ready CSV with mandatory columns (Title, Framework, Type, POD, References, Preconditions, Steps, Expected Results, Priority, Test Data). Does not assume defaults; returns a missing-fields report so you can fill or provide values when uploading.

## Troubleshooting: npx exits immediately with no output

If `npx github:Pragya1208/testrail-upload` returns to the prompt with no message:

1. **Capture stderr:** Run `npx github:Pragya1208/testrail-upload 2>&1` and check for errors.
2. **Run from a local clone** to see install + build + run:
   ```bash
   git clone https://github.com/Pragya1208/testrail-upload.git && cd testrail-upload
   npm install
   npm run build
   node dist/index.js
   ```
   You should see `[testrail-upload] Starting MCP server...` then `testrail-upload v1.0.0 started`. If you see an error instead, fix that (e.g. Node version, missing deps).
3. **Ensure your GitHub repo has the latest code** (including the startup log and `prepare` script in package.json).

## Integration

See [INTEGRATION.md](./INTEGRATION.md) for:

- **Cursor** – `mcp.json` configuration
- **Claude** – Claude Desktop / API MCP config
- **Windsurf** – MCP server JSON config

## License

MIT
