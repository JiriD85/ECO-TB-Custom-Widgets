# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Project:** ECO-TB Custom Widgets
**Platform:** ThingsBoard 4.2 PE (Professional Edition)
**Purpose:** Custom ECharts-based widget library for ECO Smart Diagnostics

## Common Commands

```bash
# Sync local widgets to ThingsBoard (backs up changed files first)
node sync/sync.js sync

# Pull bundle and widget types from server (always do before editing)
node sync/sync.js pull-bundle eco_custom_widgets

# List resources on server
node sync/sync.js list-bundles
node sync/sync.js list-widget-types
node sync/sync.js list-widget-types eco_custom_widgets

# Backup/Rollback
node sync/sync.js backup
node sync/sync.js rollback
node sync/sync.js status
```

**Important Workflow:** Always `pull-bundle` before editing widgets to get the latest version from the server.

## Architecture

```
sync/                    # ThingsBoard sync tool
├── sync.js              # CLI entry point
├── api.js               # ThingsBoard REST API client
├── config.js            # .env loader
└── backup.js            # Backup/rollback system

widgets/
├── bundles/             # Widget bundle definitions (one per bundle)
│   └── eco_custom_widgets.json
└── types/               # Individual widget definitions (one per widget)
    └── eco_*.json

backups/                 # Auto-created on sync, timestamped folders
```

## Widget JSON Structure

### Bundle (`widgets/bundles/*.json`)
```json
{
  "alias": "eco_custom_widgets",  // Unique identifier, used in FQN prefix
  "title": "ECO Custom Widgets",
  "description": "..."
}
```

### Widget Type (`widgets/types/*.json`)
```json
{
  "fqn": "bundle_alias.widget_name",  // Fully qualified name
  "name": "Display Name",
  "descriptor": {
    "type": "timeseries",             // or "latest" for non-time widgets
    "sizeX": 8, "sizeY": 5,           // Default grid size
    "resources": [{"url": "https://cdn.jsdelivr.net/npm/echarts@5.5.0/dist/echarts.min.js"}],
    "templateHtml": "...",
    "templateCss": "...",
    "controllerScript": "...",        // Widget JS as string (escaped)
    "settingsSchema": {...},          // JSON Schema for settings form
    "defaultConfig": "..."            // Stringified JSON default config
  }
}
```

## Available Widgets

| FQN | Type | Description |
|-----|------|-------------|
| `eco_timeseries_zoom_sync` | timeseries | Line/bar/area with dashboard zoom sync |
| `eco_load_duration_curve` | timeseries | Duration curve (Dauerkennlinie) with thresholds |
| `eco_line_confidence_band` | timeseries | Line with upper/lower confidence band |
| `eco_candlestick_basic` | timeseries | OHLC candlestick with optional MA |
| `eco_candlestick_brush` | timeseries | Candlestick + volume with brush selection |
| `eco_boxplot` | timeseries | Statistical boxplot with auto quartiles |
| `eco_heatmap_cartesian` | timeseries | X-Y grid heatmap with time grouping |
| `eco_calendar_heatmap` | timeseries | GitHub-style yearly calendar |
| `eco_treemap` | latest | Hierarchical treemap (supports entity relations) |
| `eco_sankey_levels` | latest | Sankey flow diagram with level colors |

## Common Widget Settings

All ECharts widgets share these settings in `settingsSchema`:
```json
{
  "enableZoomSync": true,        // Sync zoom with dashboard timewindow
  "zoomSyncDebounce": 150,       // Debounce ms
  "showDataZoomSlider": true,    // Zoom slider control
  "enableExport": true,          // PNG/Data export toolbox
  "showTooltip": true,
  "showLegend": true
}
```

## Editing controllerScript

The `controllerScript` is JavaScript stored as an escaped string. To edit:
1. Extract and format the script in a `.js` file
2. Test in browser DevTools console
3. Re-stringify (with escaped newlines/quotes) back into JSON

**Key pattern for zoom sync:**
```javascript
self.ctx.dashboard.onUpdateTimewindow(startTime, endTime);
```

## Environment Setup

Copy `.env.example` to `.env`:
```
TB_BASE_URL=https://your-thingsboard-instance.com
TB_USERNAME=your-email@example.com
TB_PASSWORD=your-password
```

Install: `npm install`
