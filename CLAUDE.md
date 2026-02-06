# CLAUDE.md

Custom ECharts widget library for ThingsBoard 4.2 PE. 10 widgets in `widgets/types/`, sync tool in `sync/`.

## Commands

```bash
# ALWAYS pull before editing
node sync/sync.js pull-bundle eco_custom_widgets

# Sync local changes to server
node sync/sync.js sync

# List resources
node sync/sync.js list-bundles
node sync/sync.js list-widget-types eco_custom_widgets

# Backup/Rollback
node sync/sync.js backup
node sync/sync.js rollback
node sync/sync.js status
```

## Skill Reference

| Task | Skill | Notes |
|------|-------|-------|
| **Widget Wissen** | `/wk` | ECharts + TB API + Projekt-Patterns |
| Debug widget UI | `/tb-ui` | Screenshot + Console + Network |
| Find widget code | `/tb-widget` | Extract controllerScript, settings |
| Search dashboards | `/tb-find` | Find widgets, actions, text |
| Inspect DOM | `/tb-inspect` | Find element IDs, attributes |
| Analyze states | `/tb-state` | Dashboard state navigation |
| Deep debugging | `/tb-debug` | Console logs, JS execution |
| Pull from server | `/tbpull` | Single resource download |
| Push to server | `/tbsync` | Detect & sync changes |
| Validate code | `/validate` | JSON, JS, i18n validation |
| SSH to gateway | `/ssh` | IoT Gateway commands |
| Commit changes | `/commit` | Auto-generate commit message |
| Full deploy | `/deploy` | TB Sync + Commit + Push |

**Use subagents for:**
- Codebase exploration → `Task` with `subagent_type=Explore`
- Planning implementation → `Task` with `subagent_type=Plan`
- Multi-file analysis → `Task` with `subagent_type=general-purpose`

## Project Structure

```
widgets/
├── bundles/eco_custom_widgets.json   # Bundle definition
├── types/eco_*.json                  # Widget definitions (10 widgets)
└── resources/eco-widget-utils.js     # Shared library (CDN via jsDelivr)

sync/                                 # CLI sync tool
├── sync.js, api.js, config.js, backup.js

.planning/                            # Detailed docs (read on-demand)
├── codebase/ARCHITECTURE.md          # Sync tool architecture
├── codebase/CONVENTIONS.md           # Code style, patterns
├── codebase/STRUCTURE.md             # File organization
└── PROJECT.md                        # Current requirements
```

## Widget Essentials

**Widget JSON:** `widgets/types/eco_*.json`
- `fqn`: `bundle_alias.widget_name`
- `descriptor.controllerScript`: Widget JS (escaped string)
- `descriptor.settingsSchema`: JSON Schema for settings UI

**Edit workflow:**
1. Pull: `node sync/sync.js pull-bundle eco_custom_widgets`
2. Edit JSON in `widgets/types/`
3. Sync: `node sync/sync.js sync`
4. Test: Hard reload (Cmd+Shift+R) in ThingsBoard

**Key ThingsBoard APIs:**
```javascript
self.ctx.data              // Current data
self.ctx.settings          // Widget settings
self.ctx.timeWindow        // Time range
self.ctx.$container        // jQuery container
self.ctx.dashboard.onUpdateTimewindow(start, end)  // Zoom sync
```

**Reference widget:** `eco_timeseries_zoom_sync` - most complete implementation

## Environment

Copy `.env.example` to `.env`:
```
TB_BASE_URL=https://your-thingsboard.com
TB_USERNAME=email
TB_PASSWORD=password
```

---

**For detailed documentation:** Read `.planning/codebase/*.md` on-demand.
**For widget patterns:** See `.planning/codebase/WIDGET-PATTERNS.md` (settings schema, resize fix, etc.)
