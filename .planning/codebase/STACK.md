# Technology Stack

**Analysis Date:** 2026-01-24

## Languages

**Primary:**
- JavaScript (Node.js) - Sync CLI tool and widget controller scripts
- JSON - Widget bundle and type definitions

## Runtime

**Environment:**
- Node.js >= 18.0.0

**Package Manager:**
- npm
- Lockfile: package-lock.json (present)

## Frameworks

**Core:**
- ThingsBoard 4.2 PE (Professional Edition) - Widget hosting and dashboard platform
- ECharts 5.5.0 - Client-side charting library (CDN-loaded in widgets)

**Development/CLI:**
- dotenv 16.3.1 - Environment variable loading for configuration

## Key Dependencies

**Critical:**
- `dotenv` 16.3.1 - Configuration management for ThingsBoard credentials (TB_BASE_URL, TB_USERNAME, TB_PASSWORD)

**Infrastructure:**
- `node-fetch` - Dynamic fallback for HTTP requests in Node.js environments (imported conditionally in `sync/api.js`)

## Configuration

**Environment:**
- `.env` file with ThingsBoard connection credentials
- Three required env vars: `TB_BASE_URL`, `TB_USERNAME`, `TB_PASSWORD`
- Example provided in `.env.example`

**Build:**
- No build tool configured (raw Node.js scripts)
- Direct CLI entry point: `sync/sync.js`

## Platform Requirements

**Development:**
- Node.js 18+ installed
- npm for dependency management
- ThingsBoard 4.2 PE instance with API access
- Internet access to ThingsBoard instance and CDN for ECharts

**Production:**
- Node.js 18+ runtime
- Network access to ThingsBoard REST API
- Network access to CDN (cdn.jsdelivr.net) for ECharts library in widget contexts

## Widget Runtime Stack

**Client-side (in ThingsBoard dashboards):**
- ECharts 5.5.0 library (loaded via CDN from widgets)
- JavaScript ES5+ (no transpilation, runs in ThingsBoard's widget context)
- ThingsBoard widget API context (`self.ctx`, dashboard object)

---

*Stack analysis: 2026-01-24*
