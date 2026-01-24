# External Integrations

**Analysis Date:** 2026-01-24

## APIs & External Services

**ThingsBoard REST API:**
- Service: ThingsBoard 4.2 PE (Professional Edition)
- What it's used for: Widget bundle and widget type management (CRUD operations)
  - Login/authentication endpoint: `/api/auth/login`
  - Widget bundles endpoint: `/api/widgetsBundle` (GET, POST, DELETE)
  - Widget types endpoint: `/api/widgetType` (GET, POST, DELETE)
  - Widget types by FQN: `/api/widgetType?fqn={fqn}`
  - Bundle widget type FQNs: `/api/widgetsBundle/{bundleId}/widgetTypeFqns`
  - Token refresh: `/api/auth/token`
- SDK/Client: Custom `ThingsBoardApi` class in `sync/api.js`
- Auth: JWT token-based via Bearer token in `X-Authorization` header
- Env vars: `TB_BASE_URL`, `TB_USERNAME`, `TB_PASSWORD`

**ECharts CDN:**
- Service: cdn.jsdelivr.net
- What it's used for: Client-side charting library for all widget visualizations
- URL: `https://cdn.jsdelivr.net/npm/echarts@5.5.0/dist/echarts.min.js`
- Type: External CDN (cannot be customized without modifying widget definitions)

## Data Storage

**Databases:**
- None - This is a widget library with no persistent storage

**File Storage:**
- Local filesystem: Backup system stores widget definitions
  - Path: `backups/` directory with timestamped folders
  - Purpose: Version control for widget JSON files before syncing to server

**Caching:**
- Token caching: JWT tokens cached in memory (`ThingsBoardApi.token`, `ThingsBoardApi.refreshToken`)
- Token expiration checked before each API request

## Authentication & Identity

**Auth Provider:**
- ThingsBoard built-in authentication
  - Implementation: JWT token-based with refresh token support
  - Credentials: Username (email) and password from `.env`
  - Token endpoint: `/api/auth/login` and `/api/auth/token`
  - Token expiration: Parsed from JWT payload (`exp` claim)
  - Automatic re-authentication: If token refresh fails or refresh token missing, full login performed

## Monitoring & Observability

**Error Tracking:**
- None detected - No third-party error tracking service

**Logs:**
- Console logging via `console` object passed to API client
- Log points: `sync/api.js` and `sync/sync.js` main commands
- No log persistence or aggregation

## CI/CD & Deployment

**Hosting:**
- ThingsBoard instance (external SaaS or self-hosted)
- Target: diagnostics.ecoenergygroup.com (from `.env`)

**CI Pipeline:**
- None detected - No automated CI/CD configured

**Deployment Method:**
- Manual: `node sync/sync.js sync` CLI command pushes local widget definitions to ThingsBoard via REST API

## Environment Configuration

**Required env vars:**
- `TB_BASE_URL` - ThingsBoard instance URL (e.g., https://diagnostics.ecoenergygroup.com)
- `TB_USERNAME` - Email/username for ThingsBoard account
- `TB_PASSWORD` - Password for ThingsBoard account

**Fallback env vars (legacy support):**
- `BASE_URL`, `USERNAME`, `PASSWORD` - Alternative names checked if TB_* not present

**Secrets location:**
- `.env` file (local, not committed)
- Example template: `.env.example`

## Webhooks & Callbacks

**Incoming:**
- None - No webhook receiver implemented

**Outgoing:**
- Dashboard timewindow callbacks: Widgets trigger `self.ctx.dashboard.onUpdateTimewindow(startTime, endTime)` to sync zoom across dashboard
  - Used in: `eco_timeseries_zoom_sync` widget and others with `enableZoomSync` setting
  - Type: Internal ThingsBoard dashboard event, not external webhook

## API Client Implementation

**Location:** `sync/api.js` - `ThingsBoardApi` class

**Features:**
- Automatic token refresh 60 seconds before expiration
- Fallback to full login if refresh fails
- Configurable base URL, username, password
- JSON request/response handling
- Error messages include HTTP status and response body
- Supports both Node.js (dynamic fetch import) and browser environments

**Supported endpoints (partial list):**
- Widget bundle operations: list, get, save, delete
- Widget type operations: list, get by ID, get by FQN, save, delete
- Bundle widget type FQN management: add/update widget types in bundle

---

*Integration audit: 2026-01-24*
