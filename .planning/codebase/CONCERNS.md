# Codebase Concerns

**Analysis Date:** 2026-01-24

## Security Issues

**Credentials committed to repository:**
- Issue: Real ThingsBoard API credentials (username, password, base URL) are committed in `.env` file
- Files: `.env` (should be in .gitignore but credentials are already in git history)
- Risk: Repository is likely pushed to remote with credentials exposed. Any developer or person with access can read the production credentials
- Impact: Production ThingsBoard instance vulnerable to unauthorized access, data modification, widget tampering
- Fix approach:
  1. Rotate all ThingsBoard credentials immediately
  2. Remove `.env` file from git history (git filter-branch or BFG Repo-Cleaner)
  3. Ensure `.env` is properly gitignored (already listed in `.gitignore` but credentials already exist in history)
  4. Document secure credential management (e.g., 1Password, AWS Secrets Manager, or CI/CD secrets)
  5. Update contributor guidelines to never commit `.env`

**No password validation or rate limiting in auth:**
- Issue: `api.js` has no protection against brute force or credential leaks
- Files: `/Users/jiridockal/development/ECO-TB-Custom-Widgets/sync/api.js` (lines 24-44)
- Risk: If credentials are leaked, attacker can make unlimited API requests
- Current mitigation: Relies on ThingsBoard server-side rate limiting
- Recommendations:
  1. Add client-side retry limits and exponential backoff
  2. Consider JWT token pinning or certificate pinning for HTTPS
  3. Add audit logging of all API requests with timestamps and actions

**Credentials passed as plaintext in fetch:**
- Issue: Username/password sent in request body over HTTPS but stored in memory
- Files: `/Users/jiridockal/development/ECO-TB-Custom-Widgets/sync/api.js` (lines 25-31)
- Risk: If process memory is dumped, credentials exposed
- Mitigation: Verify HTTPS certificate validation is enforced; consider environment-based auth tokens instead of passwords

## Performance Bottlenecks

**Sequential widget type fetching without concurrency:**
- Problem: `getBundleWidgetTypes()` fetches each widget type one-by-one in a for loop
- Files: `/Users/jiridockal/development/ECO-TB-Custom-Widgets/sync/api.js` (lines 185-197)
- Cause: Line 189 `await this.getWidgetTypeByFqn(fqn)` blocks on each iteration
- Improvement path:
  1. Use Promise.all() to fetch all widget types concurrently
  2. Batch FQN requests if API supports it
  3. Add configurable concurrency limit to prevent overwhelming server (e.g., 5-10 concurrent requests)
  4. Current impact: Syncing 10 widgets with average 500ms per fetch = 5 seconds vs ~500ms with parallelism

**No pagination handling for large datasets:**
- Problem: Hardcoded pageSize=1000 in API calls; will fail with >1000 widget bundles or types
- Files: `/Users/jiridockal/development/ECO-TB-Custom-Widgets/sync/api.js` (lines 123, 229)
- Cause: Line 123 `'/api/widgetsBundles?pageSize=1000&page=0'` assumes all bundles fit in one page
- Improvement path:
  1. Implement pagination loop that continues while `data.length === pageSize`
  2. Add pagination progress logging
  3. Test with >1000 bundles/types

**No timeout configuration for HTTP requests:**
- Problem: `fetchFn` calls have no timeout; network hangs will block indefinitely
- Files: `/Users/jiridockal/development/ECO-TB-Custom-Widgets/sync/api.js` (lines 86-99)
- Risk: Long-running sync operations can hang forever, consuming memory
- Improvement path:
  1. Wrap fetch calls in AbortController with 30-60 second timeout
  2. Add timeout configuration to constructor
  3. Log timeout events for monitoring

## Tech Debt

**Inconsistent error handling:**
- Issue: Some functions silently catch all errors, others throw; inconsistent logging
- Files: `/Users/jiridockal/development/ECO-TB-Custom-Widgets/sync/sync.js` (lines 59-89), `/Users/jiridockal/development/ECO-TB-Custom-Widgets/sync/backup.js` (lines 194-214)
- Problems:
  - Line 35-36: `getJsonFiles()` silently returns empty array on any error (catches permission errors, missing dirs, and JSON errors equally)
  - Line 145: Widget sync continues on error but logs it; unclear if partial sync is acceptable
  - Line 256: Bundle add fails but sync continues; user may not notice widgets weren't added
- Impact: User doesn't know sync was partially successful; may have incomplete widget deployments
- Fix approach:
  1. Define error categories: fatal (stop sync), warning (log and continue), info (log only)
  2. Explicitly throw fatal errors
  3. Return detailed sync report with success/failure counts
  4. Require explicit approval for partial syncs

**No input validation:**
- Issue: Widget JSON files not validated against ThingsBoard schema before sync
- Files: `/Users/jiridockal/development/ECO-TB-Custom-Widgets/sync/sync.js` (lines 118-145)
- Risk: Invalid widget definitions sync to server, breaking dashboards that use them
- Fix approach:
  1. Add JSON schema validation for bundle and widget type payloads
  2. Validate required fields (fqn, alias, descriptor, etc.) before API calls
  3. Dry-run mode to show what would be synced without applying changes

**No state validation for version conflicts:**
- Issue: "optimistic locking" handled, but no protection against concurrent edits from multiple sources
- Files: `/Users/jiridockal/development/ECO-TB-Custom-Widgets/sync/sync.js` (lines 194-205)
- Problem: If user edits widget in ThingsBoard UI while sync is running, both changes may collide
- Impact: User's server edits could be lost or create conflicts
- Fix approach:
  1. Add conflict resolution strategies (server wins, local wins, merge)
  2. Pre-sync validation that local version matches server (before making changes)
  3. Changelog/diff display before sync to warn user of overwrites

**Escaped JavaScript in JSON (widget controllers):**
- Issue: `controllerScript` is stored as escaped string in JSON; difficult to edit, version control, and test
- Files: All widget type files in `/Users/jiridockal/development/ECO-TB-Custom-Widgets/widgets/types/` (e.g., `eco_boxplot.json` line 18)
- Example: Newlines are `\n`, quotes are `\"`, making inline editing near impossible
- Impact:
  - No syntax highlighting or linting for JavaScript
  - Merge conflicts on large scripts are very difficult
  - Can't unit test widget logic
  - IDE can't refactor or analyze code
- Fix approach:
  1. Extract controllerScript to separate `.js` files for each widget
  2. Implement build step that reads JS files and escapes them into JSON at sync time
  3. Keep source JS files in version control, JSON as generated artifact
  4. Document this in contributor guidelines

**Lack of atomic operations:**
- Issue: Sync is not atomic; if it fails midway, server is left in inconsistent state
- Files: `/Users/jiridockal/development/ECO-TB-Custom-Widgets/sync/sync.js` (lines 82-85)
- Scenario: Bundles sync successfully but widget types fail; bundle exists without its widgets
- Impact: Partial deployments cause runtime errors in dashboards
- Fix approach:
  1. Add transaction support (all-or-nothing) if ThingsBoard supports it
  2. If not, add validation phase that checks all resources can be synced before starting
  3. Implement rollback on failure (use backup system)

## Fragile Areas

**Complex boxplot statistics calculation:**
- Files: `/Users/jiridockal/development/ECO-TB-Custom-Widgets/widgets/types/eco_boxplot.json` (controllerScript section)
- Why fragile:
  - Embedded JavaScript percentile calculation (`percentile()` function) uses linear interpolation; no unit tests
  - IQR-based outlier detection (line `var upperFence = q3 + 1.5 * iqr;`) matches statistical standard but not all use cases
  - Whisker min/max logic (lines scanning sorted array for fence bounds) has off-by-one risk
  - No validation that `q1 <= median <= q3` after calculation
- Test coverage: Zero; widget only tested via manual ThingsBoard UI
- Safe modification:
  1. Extract `calculateBoxplotStats()` to separate test file first
  2. Add unit tests for edge cases: all same values, single value, empty array, NaN values
  3. Test percentile calculation matches numpy.percentile() or similar library
  4. Run existing dashboard widgets through regression suite after any changes

**Token refresh logic with race conditions:**
- Files: `/Users/jiridockal/development/ECO-TB-Custom-Widgets/sync/api.js` (lines 46-75, 92-100)
- Why fragile:
  - If multiple concurrent requests happen when token is about to expire, multiple simultaneous refresh calls may occur
  - Line 92-99 retries once on 401, but if refresh happens in parallel, could cause conflicting refresh attempts
  - No locking mechanism to ensure only one refresh in flight at a time
- Safe modification:
  1. Add `_refreshPromise` to ensure only one refresh at a time (return same promise if refresh in progress)
  2. Test with 10 concurrent requests where first request finds token expired
  3. Verify only one refresh request sent to server, not N requests

**Bundle/widget FQN extraction from filename:**
- Files: `/Users/jiridockal/development/ECO-TB-Custom-Widgets/sync/sync.js` (lines 315-320)
- Why fragile: `sanitizeFilename()` converts `eco_custom_widgets.eco_boxplot` → `eco_custom_widgets_eco_boxplot`, losing the dot separator
- Problem: When pulling bundle, FQN is reconstructed from filename incorrectly
- Impact: If bundle alias and widget name both contain underscores, can't distinguish where split occurs
- Safe modification:
  1. Use FQN directly from JSON instead of deriving from filename
  2. If filename needed for readability, store FQN in file itself as comment
  3. Add validation that pulled FQN matches JSON payload FQN

**Backup/rollback without versioning:**
- Files: `/Users/jiridockal/development/ECO-TB-Custom-Widgets/sync/backup.js` (lines 190-217)
- Why fragile:
  - `restoreLatestBackup()` always restores from latest backup (line 196)
  - If user accidentally creates bad backup, they can't skip it
  - Backups are full directory copies; no delta/diff support
  - Storage grows quadratically with number of widgets
- Impact:
  - Restoring old backup while new one exists is not possible
  - Disk space can fill up undetected
  - No way to compare what changed between backups
- Safe modification:
  1. Add ability to restore from specific timestamp: `rollback --timestamp 2026-01-23_15-22-44`
  2. Implement differential backups (only changed files)
  3. Add automatic cleanup of backups older than N days
  4. Add `compare` command to show diff between backups

**Hardcoded resource URLs in widgets:**
- Files: All widget type files use hardcoded CDN: `https://cdn.jsdelivr.net/npm/echarts@5.5.0/dist/echarts.min.js`
- Why fragile:
  - If CDN is down or removed, all widgets break
  - ECharts library version is fixed; can't upgrade without editing all 10 widget files
  - No fallback if CDN fails (SPOF - single point of failure)
- Impact: ECharts 5.5.0 security updates would require manually editing 10 files
- Fix approach:
  1. Make ECharts version configurable in settings or environment
  2. Add fallback CDN (e.g., unpkg.com or cdnjs)
  3. Consider hosting ECharts locally or bundling with app
  4. Add version check/auto-update mechanism

## Scaling Limits

**Widget type list pagination limitation:**
- Current capacity: Up to 1000 widget types per page
- Limit: ThingsBoard instances with >1000 custom widgets will not be fully synced
- Scaling path:
  1. Implement pagination loop (see Performance Bottlenecks section)
  2. Test with >5000 widget types
  3. Consider streaming large sync operations

**Backup storage growth:**
- Current capacity: New full backup created for every sync; no cleanup
- Example: 10 widgets × 20 KB each = 200 KB per backup. After 100 syncs = 20 MB
- Limit: Long-running projects could accumulate GBs of backup data
- Scaling path:
  1. Implement differential backup (only store changed files)
  2. Add automatic cleanup policy (keep last N backups or all backups < X days old)
  3. Add compression for old backups
  4. Add disk usage warning when backups folder exceeds threshold

**In-memory widget processing:**
- Current capacity: All widget JSON loaded into memory before sync
- Limit: Unknown; would fail with extremely large controllerScript (hundreds of KB)
- Scaling path:
  1. Implement streaming file processing for very large widgets
  2. Add file size validation and chunking if needed

## Missing Critical Features

**No dry-run mode:**
- Problem: User can't see what will change before syncing
- Blocks: Users can't safely test sync in production without risking overwrites
- Solution:
  1. Add `--dry-run` flag to sync command
  2. Show detailed diff: what would be created, updated, deleted
  3. Estimate API calls that would be made
  4. Require explicit confirmation for updates to existing widgets

**No rollback to specific backup:**
- Problem: Can only rollback to latest backup
- Blocks: Users can't recover from "latest backup is bad" scenario
- Solution:
  1. Add `rollback --timestamp` parameter
  2. List available backups with descriptions
  3. Show diff before rollback

**No conflict resolution:**
- Problem: No handling when server and local versions diverge
- Blocks: Multiple developers or server-side edits break sync workflow
- Solution:
  1. Implement 3-way merge (server, local, common base)
  2. Add conflict markers in JSON
  3. Manual review mode for conflicts

**No audit logging:**
- Problem: Who synced what, when, and from where is not tracked
- Blocks: Can't investigate who broke a widget or when changes occurred
- Solution:
  1. Log all sync operations with user, timestamp, changes
  2. Store logs separately from backups (versioned in git?)
  3. Generate sync reports per run

## Test Coverage Gaps

**No tests for widget JavaScript logic:**
- What's not tested: All 10 widgets' `controllerScript` JavaScript functions
- Files: All widget type files have complex JavaScript (zoom sync, statistics, rendering)
- Risk: Widget behavior changes could go unnoticed; ECharts API misuse only caught by users
- Priority: High (widgets are customer-facing; broken zoom sync = broken dashboard)
- Improvement:
  1. Extract JS to separate files and add Jest/Mocha tests
  2. Mock ECharts library
  3. Test key scenarios: empty data, all NaN, extreme values, zoom sync firing, resize

**No tests for API client:**
- What's not tested: Token refresh race conditions, 401 retry logic, pagination
- Files: `/Users/jiridockal/development/ECO-TB-Custom-Widgets/sync/api.js`
- Risk: Concurrent requests or network errors cause silent failures
- Priority: Medium
- Improvement:
  1. Add mock ThingsBoard server (using nock or msw)
  2. Test concurrent request handling with token refresh
  3. Test all error codes: 401, 403, 404, 500, timeout

**No tests for sync workflow:**
- What's not tested: Full bundle+widget sync, partial failure scenarios, backup/rollback
- Files: `/Users/jiridockal/development/ECO-TB-Custom-Widgets/sync/sync.js`
- Risk: Complex workflows like "create bundle, add widgets, rollback on error" are untested
- Priority: Medium
- Improvement:
  1. Integration test with mock API
  2. Test partial success: sync 5 widgets, 3 succeed, 2 fail
  3. Test rollback after failed sync

**No tests for backup system:**
- What's not tested: File comparison, differential backup, restore edge cases
- Files: `/Users/jiridockal/development/ECO-TB-Custom-Widgets/sync/backup.js`
- Risk: Restore could fail silently or restore incomplete state
- Priority: Medium
- Improvement:
  1. Unit tests for `fileChanged()`, `copyDir()`, `restoreLatestBackup()`
  2. Test restore with missing files in backup
  3. Test concurrent backup operations

---

*Concerns audit: 2026-01-24*
