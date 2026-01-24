# Coding Conventions

**Analysis Date:** 2026-01-24

## Naming Patterns

**Files:**
- JavaScript files: kebab-case (e.g., `sync.js`, `api.js`, `backup.js`)
- JSON configuration files: kebab-case with `.json` extension (e.g., `eco_timeseries_zoom_sync.json`)
- Widget bundle files: `[bundle-alias].json` (e.g., `eco_custom_widgets.json`)
- Widget type files: `[fqn-with-dots-as-underscores].json` (e.g., `eco_candlestick_basic.json`)

**Variables & Functions:**
- camelCase for variables and function names
- Examples from `sync/sync.js`: `readJsonFiles`, `loadJson`, `pathExists`, `syncCommand`, `syncBundles`
- Examples from `sync/api.js`: `isTokenExpired`, `decodeJwtExp`, `getWidgetsBundles`
- CONSTANT_CASE for module-level constants (e.g., `SOURCE_DIRS`, `BACKUP_ROOT`, `STATUS_FILE`)

**Types & Constructors:**
- PascalCase for class names (e.g., `ThingsBoardApi` in `sync/api.js`)

**Data Keys in Widget Settings:**
- camelCase for settings properties (e.g., `enableZoomSync`, `chartType`, `smoothLine`, `zoomSyncDebounce`)
- snake_case for widget FQN identifiers (e.g., `eco_timeseries_zoom_sync`, `eco_candlestick_basic`)

## Code Style

**Formatting:**
- No automatic formatter detected (no ESLint or Prettier config files)
- 2-space indentation observed throughout
- Semicolons used consistently
- Single quotes for string literals in sync tools, quotes vary in widget JSON

**Linting:**
- No linting rules enforced (no .eslintrc* or eslint.config.* files)
- No TypeScript configuration (JavaScript only)

**Quotes:**
- Single quotes preferred in Node.js source files
- Double quotes in JSON (standard JSON requirement)

**Async/Await:**
- async/await pattern used throughout async operations
- Example pattern from `sync/sync.js`:
  ```javascript
  async function syncCommand(args) {
    const config = loadConfig();
    const api = new ThingsBoardApi({ ...config, logger });
    await api.login();
    // ... operations
  }
  ```

## Import Organization

**Node.js Module Style (CommonJS):**
- Using `require()` consistently (not ES6 imports)
- Pattern observed in all sync files:
  ```javascript
  const fs = require('fs').promises;
  const path = require('path');
  const { loadConfig } = require('./config');
  const { ThingsBoardApi } = require('./api');
  ```

**Order:**
1. Built-in Node.js modules first (`fs`, `path`, `buffer`)
2. External package imports (`dotenv`, `node-fetch`)
3. Local module imports (relative paths with `./`)

**Destructuring:**
- Named exports destructured at import time
- Examples from `sync/sync.js`:
  ```javascript
  const {
    backupFiles,
    createBackup,
    listBackups,
    restoreLatestBackup,
    readStatus,
    recordSync,
  } = require('./backup');
  ```

**Module Exports:**
- Using `module.exports` with object syntax
- Example from `sync/api.js`:
  ```javascript
  module.exports = { ThingsBoardApi };
  ```
- Example from `sync/backup.js`:
  ```javascript
  module.exports = {
    createBackup,
    backupFiles,
    listBackups,
    restoreLatestBackup,
    readStatus,
    updateStatus,
    recordSync,
  };
  ```

## Error Handling

**Patterns:**
- Try-catch blocks for file operations and API calls
- Logged errors with context (file path, HTTP status, error message)
- Examples from `sync/sync.js`:
  ```javascript
  try {
    const raw = await fs.readFile(filePath, 'utf8');
    return JSON.parse(raw);
  } catch (err) {
    throw new Error(`Invalid JSON in ${filePath}: ${err.message}`);
  }
  ```

**Error Propagation:**
- Errors thrown with descriptive messages including context
- Example from `sync/api.js`:
  ```javascript
  if (!response.ok) {
    const text = await response.text();
    throw new Error(
      `Request failed: ${method} ${path} ${response.status} ${text}`
    );
  }
  ```

**Graceful Degradation:**
- Empty arrays returned when directories don't exist (e.g., `return []`)
- Example from `sync/sync.js`:
  ```javascript
  async function getJsonFiles(dirName) {
    const dirPath = path.join(process.cwd(), dirName);
    try {
      return await readJsonFiles(dirPath);
    } catch (err) {
      return [];
    }
  }
  ```

**Logger Usage:**
- All error messages logged through `logger` object (defaults to `console`)
- Pattern: `logger.error()`, `logger.warn()`, `logger.log()`
- Example from `sync/sync.js`:
  ```javascript
  const logger = console;
  logger.log('Sync completed');
  logger.error(`Bundle ${path.basename(file)} missing 'alias' field`);
  ```

## Logging

**Framework:** Node.js `console` object (customizable via logger parameter)

**Patterns:**
- All async functions accept optional `logger = console` parameter
- Informational messages use `logger.log()`
- Warnings use `logger.warn()`
- Errors use `logger.error()`
- Messages include context: operation name, file names, HTTP status codes
- Example from `sync/api.js`:
  ```javascript
  this.logger.log('Logged in to ThingsBoard');
  this.logger.warn('Token refresh failed, re-authenticating');
  ```

**When to Log:**
- Before/after major operations (API calls, file operations)
- State changes (login success, backup created, sync completed)
- Errors and warnings with context
- Skipped operations with reasons
- Progress updates for multi-step operations

## Comments

**When to Comment:**
- Complex logic requiring explanation (rare; most code is self-documenting)
- Non-obvious API details (e.g., ThingsBoard FQN format, zoom sync threshold logic)
- Sections delineated with comment headers for clarity
- Example pattern from `sync/sync.js`:
  ```javascript
  // ==================== Sync Command ====================
  // ==================== List Commands ====================
  ```

**Inline Comments:**
- Minimal use; code is kept simple and readable
- Used only for non-obvious behavior
- Example from `sync/api.js`:
  ```javascript
  // Bundle might be empty
  // Bundle might not have any widget types yet
  ```

**JSDoc/TSDoc:**
- Not used (no TypeScript, limited documentation)

## Function Design

**Size:**
- Functions kept small and focused (typically 10-30 lines)
- Larger functions broken into helper functions
- Example: `syncWidgetTypes()` delegates to `fileChanged()`, `backupFiles()`, etc.

**Parameters:**
- Minimal parameters (usually 1-3)
- Optional logger always last parameter: `function(data, logger = console)`
- Configuration objects passed rather than long parameter lists
- Example from `sync/api.js`:
  ```javascript
  constructor({ baseUrl, username, password, logger = console }) {
    this.baseUrl = baseUrl.replace(/\/+$/, '');
    this.username = username;
    this.password = password;
    this.logger = logger;
  }
  ```

**Return Values:**
- Explicit return of data or objects with metadata
- Example from `sync/backup.js`:
  ```javascript
  return { backupDir, timestamp, count: changedFiles.length };
  ```
- Promises returned from async functions (always)
- Null/empty arrays for "no data" cases rather than throwing errors

**Naming Conventions for Functions:**
- Verb-noun pattern: `readJsonFiles()`, `loadJson()`, `syncBundles()`, `syncWidgetTypes()`
- Boolean-returning functions prefixed with `is`: `isTokenExpired()`, `pathExists()`
- Handler functions suffixed with `Handler`: `handleZoomSync()` (in widget scripts)
- Command functions suffixed with `Command`: `syncCommand()`, `listBundlesCommand()`

## Module Design

**Single Responsibility:**
- `sync/config.js`: Only configuration loading (loadConfig)
- `sync/api.js`: Only ThingsBoard API communication (ThingsBoardApi class)
- `sync/backup.js`: Only file backup/restore operations
- `sync/sync.js`: CLI orchestration and business logic

**Exports Pattern:**
- Each module exports specific functions/classes needed by others
- Config module exports minimal: `{ loadConfig }`
- API module exports single class: `{ ThingsBoardApi }`
- Backup module exports utility functions: `{ createBackup, backupFiles, ... }`

**Barrel Files:**
- Not used (each module directly imported by path)

**No Circular Dependencies:**
- Clear dependency flow: config → api, backup → none, sync.js imports all
- API layer doesn't depend on higher layers

## Widget Controller Script Conventions

**Scope:**
- Self-contained scripts embedded as escaped JSON strings in widget JSON files
- Access ThingsBoard context via `self.ctx` (provided by ThingsBoard widget framework)
- Access to: `self.ctx.data`, `self.ctx.settings`, `self.ctx.timeWindow`, `self.ctx.dashboard`

**Lifecycle Functions:**
- `self.onInit()`: Initialize chart when widget loads
- `self.onDataUpdated()`: Update chart when data changes
- `self.onResize()`: Handle widget resize events
- `self.onDestroy()`: Clean up chart and event listeners
- `self.typeParameters()`: Return widget metadata

**Variable Scope Pattern:**
- Top-level variables for state: `var chart = null;`, `var chartContainer = null;`
- Flag patterns for controlling behavior: `var isExternalUpdate = false;`
- Timer variables for debouncing: `var zoomDebounceTimer = null;`

**Common Widget Patterns:**
- All widgets initialize ECharts: `chart = echarts.init(chartContainer);`
- Zoom sync pattern replicated across widgets with debounce
- Settings pattern: `var settings = self.ctx.settings || {}; var enableZoomSync = settings.enableZoomSync !== false;`
- Data loading pattern: `var data = self.ctx.data || []; if (!data.length) { return; }`
- Cleanup pattern: `chart.off('datazoom'); chart.dispose(); chart = null;`

**ECharts Option Building:**
- Standard pattern: build series array, then create option object with config
- Conditional inclusion: `filter(function(x) { return x !== null; })` for optional features
- Color handling: default colors array or customizable via settings
- Tooltip formatter: custom formatting with color squares and data display

## Timestamp & Formatting

**Timestamp Function:**
- Custom implementation in `sync/backup.js`:
  ```javascript
  function getTimestamp() {
    const now = new Date();
    const pad = (value) => String(value).padStart(2, '0');
    return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}_${pad(now.getHours())}-${pad(now.getMinutes())}-${pad(now.getSeconds())}`;
  }
  ```
- Format: `YYYY-MM-DD_HH-mm-ss` (ISO-like with underscore separator)

**JSON Formatting:**
- File writes use 2-space indent: `JSON.stringify(bundle, null, 2)`
- Consistent across all modules

---

*Convention analysis: 2026-01-24*
