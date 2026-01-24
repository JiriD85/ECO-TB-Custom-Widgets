# Codebase Structure

**Analysis Date:** 2026-01-24

## Directory Layout

```
eco-tb-custom-widgets/
├── sync/                    # ThingsBoard sync tool (CLI + API wrapper)
│   ├── sync.js              # Main CLI entry point, command dispatch
│   ├── api.js               # ThingsBoard REST API client wrapper
│   ├── config.js            # Environment credential loader (.env)
│   └── backup.js            # Backup/rollback system
├── widgets/                 # Widget definitions (synced to/from ThingsBoard)
│   ├── bundles/             # Bundle definitions (one per bundle)
│   │   └── eco_custom_widgets.json
│   └── types/               # Widget type definitions (one per widget type)
│       ├── eco_boxplot.json
│       ├── eco_calendar_heatmap.json
│       ├── eco_candlestick_basic.json
│       ├── eco_candlestick_brush.json
│       ├── eco_heatmap_cartesian.json
│       ├── eco_line_confidence_band.json
│       ├── eco_load_duration_curve.json
│       ├── eco_sankey_levels.json
│       ├── eco_timeseries_zoom_sync.json
│       └── eco_treemap.json
├── backups/                 # Auto-created timestamped backups (YYYY-MM-DD_HH-MM-SS/)
│   ├── 2026-01-23_17-34-52/
│   ├── 2026-01-23_15-22-44/
│   ├── 2026-01-23_15-55-43/
│   └── .sync-status.json    # Metadata: lastBackup, lastSync, lastPull, lastRollback
├── node_modules/            # Dependencies (dotenv)
├── package.json             # Node.js project manifest
├── README.md                # User-facing documentation
├── CLAUDE.md                # Claude Code guidance (how to use with this repo)
└── .env                     # Environment secrets (TB_BASE_URL, TB_USERNAME, TB_PASSWORD)
```

## Directory Purposes

**sync/**
- Purpose: Synchronization tool for ThingsBoard widget management
- Contains: Node.js CLI implementation, API wrapper, backup system
- Key files: `sync.js` (entry point), `api.js` (ThingsBoard REST client)

**widgets/bundles/**
- Purpose: Widget bundle definitions (metadata for grouping widgets)
- Contains: JSON files defining bundle properties (alias, title, description)
- Key files: `eco_custom_widgets.json` (single bundle containing all 10 widgets)
- How synced: During `sync` command, contents pushed to ThingsBoard via API

**widgets/types/**
- Purpose: Individual widget type definitions (complete widget implementation)
- Contains: 10 JSON files, each with full widget spec including JS code
- Key files: All eco_*.json files (timeseries and latest-value widgets)
- Structure per file: fqn, name, descriptor (type, html, css, controllerScript, settingsSchema, defaultConfig)
- How synced: During `sync` command, contents pushed to ThingsBoard via API

**backups/**
- Purpose: Versioned snapshots of changed widget files before sync
- Contains: Timestamped directories (YYYY-MM-DD_HH-MM-SS/) with copies of widgets/ subdirs
- Key files: `.sync-status.json` (operation metadata)
- When created: Automatically during `sync` command (only changed files backed up)
- When used: `rollback` command restores from latest backup

## Key File Locations

**Entry Points:**
- `sync/sync.js`: CLI entry point (user runs `node sync/sync.js <command>`)
- `package.json` scripts: npm shortcuts (e.g., `npm run sync` → `node sync/sync.js sync`)

**Configuration:**
- `.env`: Environment variables (TB_BASE_URL, TB_USERNAME, TB_PASSWORD) - read by `sync/config.js`
- `sync/config.js`: Loads .env via dotenv, validates required credentials

**Core Logic:**
- `sync/sync.js`: Main CLI, command routing, file loading/saving (23-374 lines)
- `sync/api.js`: ThingsBoard REST API client, authentication, CRUD operations (100+ lines)
- `sync/backup.js`: Timestamped backup creation, rollback, status tracking

**Testing:**
- No test files present (see CONCERNS.md)

**Widget Assets:**
- Bundle definition: `widgets/bundles/eco_custom_widgets.json`
- Widget types: `widgets/types/eco_*.json` (10 files)
  - Timeseries widgets (7): zoom_sync, load_duration_curve, line_confidence_band, candlestick_basic, candlestick_brush, boxplot, heatmap_cartesian, calendar_heatmap
  - Latest-value widgets (2): treemap, sankey_levels

## Naming Conventions

**Files:**

- **Bundles:** `[lowercase_alias].json` (e.g., `eco_custom_widgets.json`)
  - Pattern: Matches bundle FQN prefix

- **Widget types:** `[lowercase_fqn].json` with dots replaced by underscores
  - Example: FQN `eco_custom_widgets.eco_timeseries_zoom_sync` → `eco_custom_widgets_eco_timeseries_zoom_sync.json`
  - Actually observed: `eco_[widget_name].json` (e.g., `eco_timeseries_zoom_sync.json`)
  - Note: Sanitized via sanitizeFilename() function in sync.js (lowercase, underscores, trim leading/trailing underscores)

- **Backup directories:** `YYYY-MM-DD_HH-MM-SS` (e.g., `2026-01-23_17-34-52`)
  - Format: ISO date + underscore + 24-hour time with hyphens (getTimestamp() in backup.js)

**Directories:**

- `bundles/`, `types/`: Plural form indicating collections
- `backups/`: Plural indicating multiple versions
- `sync/`: Action verb indicating tool purpose

**JSON Properties:**

- `alias`: Bundle identifier (kebab-case, e.g., `eco_custom_widgets`)
- `fqn`: Fully qualified name (format: `alias.widget_name`)
- `controllerScript`: JavaScript code as escaped string
- `descriptor`: Widget configuration object (contains type, html, css, etc.)
- `settingsSchema`: JSON Schema for widget configuration form

## Where to Add New Code

**New Widget Type:**
1. Create `widgets/types/eco_[widget_name].json` with structure:
   ```json
   {
     "fqn": "eco_custom_widgets.eco_widget_name",
     "name": "Display Name",
     "descriptor": {
       "type": "timeseries" or "latest",
       "sizeX": 8,
       "sizeY": 5,
       "resources": [{"url": "https://cdn.jsdelivr.net/npm/echarts@5.5.0/dist/echarts.min.js"}],
       "templateHtml": "...",
       "templateCss": "...",
       "controllerScript": "...",
       "settingsSchema": {...},
       "defaultConfig": "..."
     }
   }
   ```
2. Run `node sync/sync.js pull-bundle eco_custom_widgets` to get latest server state
3. Run `node sync/sync.js sync` to push new widget to ThingsBoard
4. Widget automatically added to eco_custom_widgets bundle during sync

**New Sync Command:**
1. Add handler function in `sync/sync.js` (after line 400, before main())
2. Example pattern (for listBundlesCommand):
   ```javascript
   async function newCommandName(args) {
     const config = loadConfig();
     const api = new ThingsBoardApi({ ...config, logger });
     await api.login();
     // ... do work with api
   }
   ```
3. Add case clause in main() switch statement (line 432-458)
4. Update printUsage() to document new command (line 401-420)

**New API Method:**
1. Add method to ThingsBoardApi class in `sync/api.js`
2. Pattern: Use `this.request(method, path, body)` which handles auth and token refresh
3. Example: `async getWidgetsBundles()` at line ~130 in api.js

**New Backup/Restore Feature:**
1. Add function to `sync/backup.js`
2. Use getTimestamp() for consistency in naming
3. Use ensureDir(), pathExists(), copyDir() utility functions
4. Update `.sync-status.json` via updateStatus() to track new operation

## Special Directories

**backups/:**
- Purpose: Versioned snapshots of widget files
- Generated: Yes (created by backup.js during sync)
- Committed: Yes (timestamped dirs preserved for rollback)
- Cleanup: Manual (old backups not auto-deleted; user responsibility)
- Status file: `.sync-status.json` tracks operation history

**node_modules/:**
- Purpose: Installed npm dependencies
- Generated: Yes (by `npm install`)
- Committed: No (in .gitignore typically)
- Contents: dotenv package only (single dependency)

**widgets/bundles/ and widgets/types/:**
- Purpose: Working copies of widget definitions from ThingsBoard
- Generated: Yes (by `pull-bundle` command)
- Committed: Yes (source of truth for editing, pushed back via sync)
- Tracking: .sync-status.json records when pulled/synced

---

*Structure analysis: 2026-01-24*
