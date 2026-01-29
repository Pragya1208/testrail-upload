# TestRail Upload MCP

MCP (Model Context Protocol) server for uploading test cases from CSV to TestRail. Designed to be hosted on GitHub and integrated with AI assistants (Cursor, Claude, Windsurf) via JSON configuration.

## Features

- **CSV input**: Upload test cases from a CSV file or raw CSV content
- **Environment-based credentials**: TestRail URL, username, and API key via env vars
- **Column mapping**: Flexible CSV column names mapped to TestRail fields
- **Mandatory fields**: Validates and prompts for required fields (Title, Framework, Type, Section ID, Template, Status, POD, References)
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

### Local clone (optional)

```bash
git clone https://github.com/Pragya1208/testrail-upload.git
cd testrail-upload
npm install
npm run build
```

Then point your MCP config at `.../testrail-upload/dist/index.js` (see [INTEGRATION.md](./INTEGRATION.md)).

## Usage (MCP)

Use the tool `upload_test_cases_to_testrail` with:

- **csv_file_path** or **csv_content** – input CSV
- **section_id** (required) – TestRail section ID
- **project_id** (optional) – used to resolve "Test Case (Text)" template
- **template_id** (optional) – override template ID
- **default_pod**, **default_references**, **default_framework**, **default_type** – applied when CSV row is missing
- **dry_run** – `true` to only parse/validate, no upload

Helper tool: `testrail_upload_help` – returns mandatory fields and mapping docs.

## Integration

See [INTEGRATION.md](./INTEGRATION.md) for:

- **Cursor** – `mcp.json` configuration
- **Claude** – Claude Desktop / API MCP config
- **Windsurf** – MCP server JSON config

## License

MIT
