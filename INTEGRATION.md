# TestRail Upload MCP – Integration Guide

This document describes how to integrate the TestRail Upload MCP server with **Cursor**, **Claude**, and **Windsurf** using JSON configuration. Credentials are provided via environment variables.

---

## Prerequisites

1. **Node.js** >= 18
2. **TestRail credentials**: URL, username, API key (or password)

---

## npx from GitHub (no local install)

Run the MCP server with **npx** from a GitHub repo. npx will clone and install the repo and run `prepare` to build—no local path or manual build needed. 

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
---

## 1. Cursor

Cursor uses an MCP configuration file.

**Config file:** `~/.cursor/mcp.json` (macOS/Linux) or `%USERPROFILE%\.cursor\mcp.json` (Windows)

Use the **npx** config above under `mcpServers`:

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

### Local path (optional)

If you prefer a local clone instead of npx:

```json
{
  "mcpServers": {
    "testrail-upload": {
      "command": "node",
      "args": ["/absolute/path/to/testrail-upload-mcp/dist/index.js"],
      "env": {
        "TESTRAIL_URL": "https://your-instance.testrail.com",
        "TESTRAIL_USERNAME": "your-email@example.com",
        "TESTRAIL_API_KEY": "your-api-key"
      }
    }
  }
}
```

Restart Cursor after editing. The tools `upload_test_cases_to_testrail` and `testrail_upload_help` will appear when the server is connected.

---

## 2. Claude (Claude Desktop / API with MCP)

### Claude Desktop (official app)

Config file:

- **macOS:** `~/Library/Application Support/Claude/claude_desktop_config.json`
- **Windows:** `%APPDATA%\Claude\claude_desktop_config.json`

Add the MCP server using **npx** (no local install):

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

Restart Claude Desktop after changing the config.

### Claude API / third-party MCP hosts

If your client uses MCP and expects a JSON config (e.g. for a hosted MCP gateway), use npx:

```json
{
  "command": "npx",
  "args": ["github:YOUR_ORG/testrail-upload-mcp"],
  "env": {
    "TESTRAIL_URL": "https://your-instance.testrail.com",
    "TESTRAIL_USERNAME": "your-email@example.com",
    "TESTRAIL_API_KEY": "your-api-key"
  }
}
```

Ensure the process that runs this command has access to the env vars (or pass them in the `env` block).

---

## 3. Windsurf

Windsurf uses MCP servers configured via JSON. Add the server with **npx** (no local path needed):

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

Restart or reload Windsurf so it discovers the new server.

---

## 4. Shared JSON snippet (all editors)

For teams that store config in Git or share snippets, you can provide a **minimal JSON snippet** that users paste into their editor’s MCP config. Replace YOUR_ORG with your GitHub org or username and set TestRail env vars.

### Snippet for Cursor / Claude / Windsurf

```json
"testrail-upload": {
  "command": "npx",
  "args": ["github:Pragya1208/testrail-upload"],
  "env": {
    "TESTRAIL_URL": "https://YOUR_INSTANCE.testrail.com",
    "TESTRAIL_USERNAME": "YOUR_EMAIL",
    "TESTRAIL_API_KEY": "YOUR_API_KEY"
  }
}
```

**Replace:** `YOUR_ORG`, `TESTRAIL_URL`, `TESTRAIL_USERNAME`, `TESTRAIL_API_KEY` (or `TESTRAIL_PASSWORD`). No local path or install required.

---

## 5. Verifying the integration

1. **List tools**  
   In Cursor/Claude/Windsurf, confirm that the MCP server is connected and that you see:
   - `upload_test_cases_to_testrail`
   - `testrail_upload_help`

2. **Run help**  
   Ask the AI to call `testrail_upload_help`. You should get back the mandatory fields and mapping documentation.

3. **Dry run**  
   Ask the AI to run `upload_test_cases_to_testrail` with:
   - `csv_content`: a short CSV string (e.g. `Title,Priority\n"Test 1",High`)
   - `section_id`: a valid TestRail section ID
   - `dry_run`: `true`  
   You should get a validation/parse summary and no upload.

4. **Real upload**  
   Once dry run and credentials work, run without `dry_run` and with a real CSV file or content.

---

## 6. Security notes

- **Do not commit** `mcp.json` or config files that contain `TESTRAIL_API_KEY` or passwords.
- Prefer **environment variables** (or a local, gitignored `.env`) over hardcoding secrets in JSON when possible.
- For Cursor/Claude/Windsurf, the `env` block is the standard way to pass credentials; ensure only trusted people have access to the machine or config.

---

## 7. Troubleshooting

| Issue | Check |
|-------|--------|
| "Missing TestRail credentials" | `TESTRAIL_URL`, `TESTRAIL_USERNAME`, and `TESTRAIL_API_KEY` (or `TESTRAIL_PASSWORD`) must be set in the MCP server’s environment. |
| Tool not listed | Restart the editor / MCP client; ensure `args` is `["github:YOUR_ORG/testrail-upload-mcp"]` and Node.js ≥ 18 is installed. |
| "Validation failed" | Provide `section_id` and, if the CSV doesn’t have them, `default_framework`, `default_type`, and optionally `default_pod` and `default_references`. Use `testrail_upload_help` for the full list. |
| Template / custom fields | If your project uses a different template or custom field names, set `template_id` and, when we support it, custom field keys in the tool args or env. |

For more details on CSV columns and mandatory fields, see [README.md](./README.md).
