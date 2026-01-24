# Testing Patterns

**Analysis Date:** 2026-01-24

## Current Testing Status

**Framework:** Not detected

**Runner:** None

**Assertion Library:** None

**Coverage:** Not configured

**Status:** No automated tests present in codebase. Testing is manual/external only.

## Test Framework Setup (Not Currently Used)

If testing is added in the future:

**Recommended Setup for Node.js:**
- **Test Runner:** Jest or Vitest (both work with CommonJS)
- **Assertion Library:** Built-in or Jest's expect() / Vitest's expect()
- **Mocking:** Jest's built-in mocking or Vitest's Vitest.mock()

**Package.json would need:**
```json
{
  "devDependencies": {
    "jest": "^29.0.0"
  },
  "scripts": {
    "test": "jest",
    "test:watch": "jest --watch",
    "test:coverage": "jest --coverage"
  }
}
```

## Code Structure Enabling Testing

**Testable Modules:**
- `sync/config.js` - Pure function `loadConfig()`: testable with environment mocking
- `sync/api.js` - Class `ThingsBoardApi`: testable with fetch mocking
- `sync/backup.js` - File system functions: testable with fs mocking
- `sync/sync.js` - Command functions: testable with module mocking

**Issues for Testing:**

1. **Global Logger:** Functions hardcode `console` or use passed logger
   ```javascript
   async function backupFiles(logger = console, filePaths = []) { ... }
   ```
   - Better approach: Inject logger throughout or use dependency injection

2. **Process.cwd() Dependencies:** Many functions assume cwd is project root
   ```javascript
   const envPath = path.join(process.cwd(), '.env');
   const dirPath = path.join(process.cwd(), SOURCE_DIRS.bundles);
   ```
   - Testing would require controlling cwd or mocking path.join

3. **process.argv Dependency:** sync.js directly reads process.argv
   ```javascript
   const [, , command, ...args] = process.argv;
   ```
   - Would need to mock process.argv or refactor command parsing to accept argv array

4. **Embedded Fetch Library:** api.js uses conditional fetch loading
   ```javascript
   const fetchFn = getFetch();
   ```
   - Harder to mock fetch; would need to mock at module level

5. **File I/O Heavy:** Backup and sync operations heavily dependent on filesystem
   ```javascript
   await fs.readFile(filePath, 'utf8');
   await fs.mkdir(dirPath, { recursive: true });
   ```
   - Could use `memfs` or similar for filesystem mocking

6. **No Exported Helper Functions:** Functions not exported separately for unit testing
   - Example: `sanitizeFilename()` is not exported, only used internally in `pullBundleCommand()`

## Test Organization (If Implemented)

**Suggested Structure:**
```
ECO-TB-Custom-Widgets/
├── sync/
│   ├── *.js                  # Source files
│   └── __tests__/            # Co-located tests
│       ├── api.test.js
│       ├── backup.test.js
│       ├── config.test.js
│       └── sync.test.js
└── jest.config.js            # Jest config
```

**Location Pattern:** Tests would be co-located near source files in `__tests__/` subdirectory

## Potential Test Patterns

### 1. Configuration Tests (sync/config.js)

**What should be tested:**
```javascript
describe('loadConfig', () => {
  // Test: throws error when TB_BASE_URL missing
  // Test: throws error when TB_USERNAME missing
  // Test: throws error when TB_PASSWORD missing
  // Test: loads from .env file when present
  // Test: loads from environment variables when .env missing
  // Test: strips trailing slash from baseUrl
  // Test: returns { baseUrl, username, password }
});
```

**Setup would need:**
- Mocking `dotenv.config()`
- Mocking `process.env` variables
- Mocking `fs.existsSync()`

### 2. API Tests (sync/api.js)

**What should be tested:**
```javascript
describe('ThingsBoardApi', () => {
  describe('login()', () => {
    // Test: success case returns token and refreshToken
    // Test: failure case throws error with status
    // Test: decodes JWT to extract expiration
  });

  describe('ensureToken()', () => {
    // Test: skips refresh if token valid
    // Test: calls refresh if token expired
  });

  describe('request()', () => {
    // Test: adds Authorization header
    // Test: retries on 401 after refresh
    // Test: throws on non-200 response
    // Test: handles 204 No Content
    // Test: parses JSON responses
  });

  describe('getWidgetsBundles()', () => {
    // Test: makes GET request
    // Test: returns response.data array
    // Test: returns empty array if no data
  });

  describe('saveWidgetType()', () => {
    // Test: POSTs widget type data
    // Test: includes version for updates
  });
});
```

**Setup would need:**
- Mocking fetch() globally
- Mocking Buffer.from() for JWT decoding
- Constructing mock response objects

### 3. Backup Tests (sync/backup.js)

**What should be tested:**
```javascript
describe('backup module', () => {
  describe('getTimestamp()', () => {
    // Test: returns string in YYYY-MM-DD_HH-mm-ss format
    // Test: pads single-digit month/day/time components with 0
  });

  describe('pathExists()', () => {
    // Test: returns true if path accessible
    // Test: returns false if path not accessible
  });

  describe('backupFiles()', () => {
    // Test: creates timestamped backup directory
    // Test: copies changed files only
    // Test: generates CHANGELOG.md
    // Test: updates status file
    // Test: returns { backupDir, timestamp, count }
  });

  describe('listBackups()', () => {
    // Test: returns sorted array of backup directory names
    // Test: returns empty array if no backups
  });

  describe('restoreLatestBackup()', () => {
    // Test: restores latest backup to original location
    // Test: throws error if no backups available
    // Test: updates status file with rollback timestamp
  });
});
```

**Setup would need:**
- Using memfs or fs.promises mocking
- Temporary directory creation/cleanup
- Date mocking for timestamp testing

### 4. Sync Command Tests (sync/sync.js)

**What should be tested:**
```javascript
describe('sync commands', () => {
  describe('readJsonFiles()', () => {
    // Test: returns array of .json file paths
    // Test: ignores non-JSON files
    // Test: returns empty array if directory empty
  });

  describe('loadJson()', () => {
    // Test: parses valid JSON
    // Test: throws error with filename on invalid JSON
  });

  describe('syncCommand()', () => {
    // Test: backs up changed files before sync
    // Test: syncs bundles first, then widget types
    // Test: records sync timestamp
    // Integration test: full sync flow
  });

  describe('sanitizeFilename()', () => {
    // Test: converts to lowercase
    // Test: replaces invalid chars with underscore
    // Test: removes leading/trailing underscores
  });
});
```

**Setup would need:**
- Mocking ThingsBoardApi class
- Mocking file system operations
- Mocking process.cwd()
- Mock logger to verify log calls

## Mocking Framework

**If Jest were used:**

Example of mocking fetch:
```javascript
global.fetch = jest.fn();

describe('ThingsBoardApi.login', () => {
  it('logs in successfully', async () => {
    global.fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        token: 'test-token',
        refreshToken: 'test-refresh'
      })
    });

    const api = new ThingsBoardApi({
      baseUrl: 'http://test.com',
      username: 'user',
      password: 'pass'
    });

    await api.login();
    expect(api.token).toBe('test-token');
  });
});
```

Example of mocking fs:
```javascript
jest.mock('fs/promises');
const fs = require('fs/promises');

describe('backupFiles', () => {
  it('creates backup directory', async () => {
    fs.mkdir.mockResolvedValueOnce(undefined);
    fs.readdir.mockResolvedValueOnce([]);

    await backupFiles(console, []);

    expect(fs.mkdir).toHaveBeenCalled();
  });
});
```

## What NOT to Test

**Don't test:**
- Third-party library behavior (ECharts, dotenv, node-fetch)
- Node.js built-in API behavior (fs, path, Buffer)
- Actual ThingsBoard API responses (integration tests would handle this)

**Why:**
- Waste of effort; those are tested by their maintainers
- Fragile to version changes
- Slow if making real API calls

## What to Test First (Priority Order)

**High Priority:**
1. Configuration loading (loadConfig) - Catches setup errors early
2. API error handling (request method) - Critical for reliability
3. Backup file change detection (fileChanged) - Prevents losing data

**Medium Priority:**
4. Widget bundle sync logic (syncBundles) - Core feature
5. Widget type sync logic (syncWidgetTypes) - Core feature
6. Timestamp formatting (getTimestamp) - Used throughout

**Low Priority:**
7. Command parsing (CLI) - Less critical; UI for user
8. List commands - Read-only operations

## Coverage Goals (If Implemented)

**Recommended Targets:**
- **Core modules (api.js, backup.js):** 80%+ coverage
- **CLI commands (sync.js):** 60%+ coverage (integration testing preferred)
- **Configuration (config.js):** 100% coverage (small, critical)

**Run with:**
```bash
npm run test:coverage
```

**View coverage:**
```bash
# Command (if jest configured)
jest --coverage
```

**Coverage limitations:**
- Cannot easily test process.argv without refactoring
- Cannot test actual file operations without mocking
- Widget-level testing would require browser/ThingsBoard environment

## Manual Testing Currently Done

**Observed testing patterns in codebase:**

1. **Check command exists:** Scripts test commands like `list-bundles`, `pull-bundle`
   ```bash
   npm run list-bundles
   npm run list-widget-types
   ```

2. **Backup/Rollback testing:**
   - Manual: create backup, modify files, run rollback
   - Status command verifies: `npm run status`

3. **Sync testing:**
   - Full workflow: pull → edit JSON → sync
   - Manual verification: check ThingsBoard UI for changes

4. **Environment testing:**
   - `.env.example` provided for local setup
   - Manual test: run commands with valid credentials

**Evidence of manual testing:**
- CLAUDE.md includes workflow instructions
- README.md documents command usage
- Multiple backup directories exist (proof of repeated testing)

## Integration Testing (Not Currently Used)

**If integration tests were added:**

```javascript
// tests/integration/sync-workflow.test.js
describe('Full sync workflow', () => {
  it('should sync bundle and widgets to ThingsBoard', async () => {
    const config = loadConfig(); // Uses real .env
    const api = new ThingsBoardApi(config);

    await api.login();
    const bundle = await api.getWidgetsBundleByAlias('eco_custom_widgets');

    expect(bundle).toBeDefined();
    expect(bundle.alias).toBe('eco_custom_widgets');
  });
});
```

**Requirements for integration tests:**
- Real ThingsBoard instance running
- Valid credentials in .env
- Test database/widgets separate from production
- Longer timeout for API calls

---

*Testing analysis: 2026-01-24*
