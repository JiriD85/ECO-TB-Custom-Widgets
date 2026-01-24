# Architecture

**Analysis Date:** 2026-01-24

## Pattern Overview

**Overall:** Bidirectional ThingsBoard Widget Synchronization System

This is a client-server synchronization tool following a **Pull-Push-Backup-Restore** pattern. The system maintains local widget definitions that can be synced to a ThingsBoard server, pulled from the server for editing, backed up automatically, and rolled back if needed.

**Key Characteristics:**
- File-based widget definitions (JSON) stored locally and synchronized with ThingsBoard REST API
- CLI-driven orchestration with multiple command patterns (sync, pull, list, backup, rollback)
- Automatic backup-before-sync to ensure recoverability
- Token-based authentication with refresh handling
- Bundle-centric architecture: widgets are organized into logical bundles on the server

## Layers

**CLI Layer:**
- Purpose: Parse commands and route to appropriate handlers
- Location: `sync/sync.js` (main entry point)
- Contains: Command dispatch logic, help text, argument parsing
- Depends on: Config layer, API layer, Backup layer
- Used by: Node.js runtime (user invokes `node sync/sync.js <command>`)

**Command Handlers:**
- Purpose: Execute specific operations (sync, pull, list, backup, rollback)
- Location: Functions in `sync/sync.js` (syncCommand, pullBundleCommand, etc.)
- Contains: Business logic for each operation, file I/O orchestration
- Depends on: API layer, Backup layer, Config layer
- Used by: CLI layer

**API Layer:**
- Purpose: Wrap ThingsBoard REST API calls with authentication and token refresh
- Location: `sync/api.js`
- Contains: ThingsBoardApi class with methods like login(), getWidgetsBundles(), saveWidgetsBundle(), saveWidgetType()
- Depends on: Fetch API (node-fetch or native fetch)
- Used by: Command handlers

**Configuration Layer:**
- Purpose: Load and validate environment credentials from .env
- Location: `sync/config.js`
- Contains: loadConfig() function for reading TB_BASE_URL, TB_USERNAME, TB_PASSWORD
- Depends on: dotenv package, filesystem
- Used by: API layer initialization

**Backup & Recovery Layer:**
- Purpose: Manage timestamped backups, rollback functionality, and sync status tracking
- Location: `sync/backup.js`
- Contains: createBackup(), restoreLatestBackup(), backupFiles(), readStatus(), recordSync()
- Depends on: Filesystem
- Used by: Command handlers

**Data Storage:**
- Purpose: Persistent storage of widget definitions and backups
- Location: `widgets/bundles/` (bundle definitions), `widgets/types/` (widget type definitions), `backups/` (timestamped backups)
- Contains: JSON files representing ThingsBoard widget entities
- Depends on: Filesystem
- Used by: Command handlers, API layer

## Data Flow

**Sync Flow (Push local changes to ThingsBoard):**

1. User runs `node sync/sync.js sync`
2. CLI routes to syncCommand()
3. syncCommand() loads all files from `widgets/bundles/` and `widgets/types/`
4. backupFiles() creates backup in `backups/[timestamp]/` of changed files only
5. Config layer loads credentials from .env
6. API layer instantiated with credentials
7. API.login() authenticates to ThingsBoard server
8. syncBundles():
   - API.getWidgetsBundles() fetches existing bundles from server
   - For each local bundle file: if exists on server, update with ID/version; else create new
   - API.saveWidgetsBundle() persists each bundle
9. syncWidgetTypes():
   - API.getAllWidgetTypes() fetches all widget types from server
   - For each local widget type: if exists on server (by FQN), fetch current version and update; else create new
   - API.saveWidgetType() persists each widget type
10. API.addWidgetTypesToBundle() associates widget types with their bundle
11. recordSync() updates `.sync-status.json` with timestamp
12. Success logged

**Pull Flow (Download widgets from ThingsBoard for editing):**

1. User runs `node sync/sync.js pull-bundle <alias>`
2. CLI routes to pullBundleCommand()
3. Config layer loads credentials from .env
4. API.login() authenticates
5. API.getWidgetsBundleByAlias() fetches specific bundle definition
6. Creates/ensures `widgets/bundles/` and `widgets/types/` directories
7. Saves bundle JSON to `widgets/bundles/[sanitized-alias].json`
8. API.getBundleWidgetTypesDetails() fetches all widget types in bundle with full definitions
9. For each widget type: saves to `widgets/types/[sanitized-fqn].json`
10. updateStatus() records lastPull timestamp in `.sync-status.json`
11. Success logged

**List Flow (View server resources):**

1. User runs `node sync/sync.js list-bundles` or `list-widget-types [alias]`
2. API authenticates and fetches bundles or widget types from server
3. Pretty-prints results with ID, name, FQN

**Backup/Restore Flow:**

1. Backup is created automatically during sync by backupFiles()
2. backupFiles() compares files against latest backup, copies only changed files
3. Timestamps in format: `YYYY-MM-DD_HH-MM-SS` stored in `backups/[timestamp]/widgets/`
4. `.sync-status.json` tracks lastBackup, lastSync, lastPull, lastRollback
5. restoreLatestBackup() restores from most recent timestamped backup directory

**State Management:**

- **Server-driven:** ThingsBoard server is source of truth for prod state
- **Local files:** Working copies of widgets for editing
- **Backups:** Snapshots before each sync operation
- **Status file:** `.planning/codebase/backups/.sync-status.json` tracks operations

## Key Abstractions

**Widget Bundle:**
- Purpose: Logical grouping of related widgets (e.g., "eco_custom_widgets")
- Examples: `widgets/bundles/eco_custom_widgets.json`
- Pattern: Simple JSON with alias, title, description, image, order
- Used by: ThingsBoard to organize widget market/gallery

**Widget Type:**
- Purpose: Complete widget definition including UI, settings, behavior
- Examples: `widgets/types/eco_timeseries_zoom_sync.json`, `eco_load_duration_curve.json`
- Pattern: FQN (fully qualified name) of format `bundle_alias.widget_name`
  - Contains descriptor with: type (timeseries/latest), templateHtml, templateCss, controllerScript (JavaScript as string)
  - Contains settingsSchema (JSON Schema for configuration form)
  - Contains defaultConfig (stringified JSON widget instance config)
- Structure allows embedding complete widget as self-contained entity

**ECharts Integration:**
- Purpose: Render interactive charts in widgets
- Pattern: ECharts library loaded from CDN (jsdelivr) in `resources`
- Controller script initializes echarts.init(), sets option, handles events
- All 10 widgets use ECharts for visualization

**Zoom Sync Pattern:**
- Purpose: Coordinate zoom across dashboard widgets
- Pattern: Widget listens to datazoom events, calls `self.ctx.dashboard.onUpdateTimewindow(startTime, endTime)`
- Implemented in: eco_timeseries_zoom_sync (primary), others inherit concept
- Used by: All timeseries widgets to coordinate time range selection

## Entry Points

**CLI Entry Point:**
- Location: `sync/sync.js`
- Triggers: User executes `node sync/sync.js <command> [args]`
- Responsibilities: Parse argv, route to command handler, catch errors, exit with appropriate code

**API Entry Point:**
- Location: `sync/api.js` (ThingsBoardApi class)
- Triggers: Command handler instantiates with config
- Responsibilities: Manage HTTP requests to ThingsBoard, handle auth, token refresh, error handling

**Backup Entry Point:**
- Location: `sync/backup.js`
- Triggers: Called from syncCommand() before API operations
- Responsibilities: Create timestamped backups, compare changes, manage restore points

## Error Handling

**Strategy:** Fail-fast with detailed error messages, no silent failures

**Patterns:**

- **Missing credentials:** loadConfig() throws Error if any of TB_BASE_URL, TB_USERNAME, TB_PASSWORD missing
- **Network errors:** API requests throw Error with HTTP status code and response text
- **Invalid JSON:** JSON.parse() wrapped in try-catch with file context in error message
- **File operations:** pathExists() returns false for missing paths; operations check existence before attempting
- **Token expiration:** isTokenExpired() checks JWT exp claim; if expired, refresh() called automatically
- **Optimistic locking:** When updating widget types, current version fetched to avoid conflicts (line 195-205 in sync.js)

## Cross-Cutting Concerns

**Logging:**
- Implementation: console object (can be injected)
- Pattern: logger.log(), logger.warn(), logger.error() called throughout
- Usage: Progress messages, error details, operation summaries

**Validation:**
- Bundle sync: Checks for required 'alias' field; skips invalid bundles
- Widget sync: Checks for required 'fqn' field; skips invalid types
- FQN parsing: Extracts bundle alias from FQN format (bundle_alias.widget_name)

**Authentication:**
- Pattern: POST to `/api/auth/login` with username/password
- Token storage: In-memory token and refreshToken
- Auto-refresh: Checked before each request via ensureToken()
- Fallback: If refresh fails, re-authenticate with login()

---

*Architecture analysis: 2026-01-24*
