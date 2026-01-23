# CLAUDE.md

This file provides guidance to Claude Code when working with this repository.

## Project Overview

**Project:** ECO-TB Custom Widgets
**Platform:** ThingsBoard 4.2 PE (Professional Edition)
**Purpose:** Custom Widget Library for ECO Smart Diagnostics

## Common Commands

### Widget Sync Tool

```bash
# List widget bundles on server
node sync/sync.js list-bundles

# List widget types (all or by bundle)
node sync/sync.js list-widget-types
node sync/sync.js list-widget-types eco_custom_widgets

# Pull bundle and widget types from server
node sync/sync.js pull-bundle eco_custom_widgets

# Sync local widgets to ThingsBoard
node sync/sync.js sync

# Backup/Rollback
node sync/sync.js backup
node sync/sync.js rollback
node sync/sync.js status
```

**Important Workflow:** Always `pull-bundle` before editing widgets to get the latest version from the server.

## Directory Structure

```
ECO-TB-Custom-Widgets/
├── .env                          # ThingsBoard credentials
├── package.json
├── CLAUDE.md
├── README.md
├── sync/
│   ├── api.js                    # ThingsBoard API with widget methods
│   ├── config.js                 # Config loader
│   ├── backup.js                 # Backup/Rollback
│   └── sync.js                   # CLI
├── widgets/
│   ├── bundles/                  # Widget bundle definitions
│   │   └── eco_custom_widgets.json
│   └── types/                    # Individual widget type definitions
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
└── backups/                      # Automatic backups
```

## Widget Structure

### Widget Bundle (`widgets/bundles/*.json`)

```json
{
  "alias": "eco_custom_widgets",     // Unique identifier
  "title": "ECO Custom Widgets",     // Display name
  "description": "Description text"
}
```

### Widget Type (`widgets/types/*.json`)

```json
{
  "fqn": "bundle_alias.widget_name",  // Fully qualified name
  "name": "Display Name",
  "description": "Widget description",
  "descriptor": {
    "type": "timeseries",             // Widget type
    "sizeX": 8,                       // Default width
    "sizeY": 5,                       // Default height
    "resources": [...],               // External JS/CSS
    "templateHtml": "...",            // Widget HTML
    "templateCss": "...",             // Widget CSS
    "controllerScript": "...",        // Widget JS controller
    "settingsSchema": {...},          // Settings form schema
    "defaultConfig": "..."            // Default configuration JSON string
  },
  "tags": [...]
}
```

## Available Widgets

### 1. Load Duration Curve (Dauerkennlinie)
- **FQN:** `eco_custom_widgets.eco_load_duration_curve`
- **Type:** timeseries
- **Features:**
  - Duration curve display (sorted values, highest first)
  - Optional split view with time series + duration curve
  - Auto-detection of base load (10th percentile) and peak load (95th percentile)
  - Manual threshold override
  - Threshold markers with colored areas
  - PNG/Data export via ECharts toolbox

### 2. Synced Zoom Time Series
- **FQN:** `eco_custom_widgets.eco_timeseries_zoom_sync`
- **Type:** timeseries
- **Features:**
  - Zoom synchronization across all dashboard widgets
  - Updates dashboard timewindow on zoom
  - Configurable debounce (default 150ms)
  - Line, bar, or area chart types
  - Optional stacking
  - Legend and tooltip customization

### 3. Line with Confidence Band
- **FQN:** `eco_custom_widgets.eco_line_confidence_band`
- **Type:** timeseries
- **Data Keys:** `value`, `upper`, `lower`
- **Features:**
  - Main line with shaded confidence band
  - Uses stacked area technique for band visualization
  - Zoom sync with dashboard
  - PNG/Data export

### 4. Basic Candlestick Chart
- **FQN:** `eco_custom_widgets.eco_candlestick_basic`
- **Type:** timeseries
- **Data Keys:** `open`, `high`, `low`, `close`
- **Features:**
  - OHLC candlestick display
  - Optional Moving Average overlay
  - Configurable up/down colors
  - Zoom sync support

### 5. Candlestick with Brush & Volume
- **FQN:** `eco_custom_widgets.eco_candlestick_brush`
- **Type:** timeseries
- **Data Keys:** `open`, `high`, `low`, `close`, `volume` (optional)
- **Features:**
  - Dual-grid layout (candlestick + volume)
  - Brush selection for highlighting ranges
  - Synchronized zoom between grids
  - Volume bars colored by price direction

### 6. Statistical Boxplot
- **FQN:** `eco_custom_widgets.eco_boxplot`
- **Type:** timeseries
- **Data Keys:** `value` (raw mode) or `min`, `q1`, `median`, `q3`, `max` (precalculated)
- **Features:**
  - Auto-calculates quartiles from raw data
  - Grouping by hour/day/week/month
  - Outlier detection and display
  - Customizable colors

### 7. Heatmap Cartesian
- **FQN:** `eco_custom_widgets.eco_heatmap_cartesian`
- **Type:** timeseries
- **Features:**
  - X-Y grid heatmap with time or category axes
  - Time grouping (hour, dayOfWeek, day, week, month)
  - Multiple color schemes (blue, green, red, temperature)
  - Visual map legend

### 8. Calendar Heatmap
- **FQN:** `eco_custom_widgets.eco_calendar_heatmap`
- **Type:** timeseries
- **Features:**
  - GitHub-style yearly calendar view
  - Daily value aggregation
  - Multiple color schemes (github, blue, green, etc.)
  - Configurable cell size

### 9. Treemap
- **FQN:** `eco_custom_widgets.eco_treemap`
- **Type:** latest
- **Features:**
  - Hierarchical treemap visualization
  - Manual mode (from datasource values)
  - Relations mode (loads ThingsBoard entity relations)
  - Drill-down navigation with breadcrumb
  - Depth-based coloring

### 10. Sankey Diagram with Levels
- **FQN:** `eco_custom_widgets.eco_sankey_levels`
- **Type:** latest
- **Features:**
  - Flow visualization between nodes
  - Manual mode (source/target/value keys)
  - Relations mode (loads entity relations)
  - Level-based node coloring
  - Horizontal or vertical orientation
  - Gradient, source, or target link colors

## Common Widget Settings

All ECharts widgets share these settings:
```json
{
  "enableZoomSync": true,        // Sync zoom with dashboard timewindow
  "zoomSyncDebounce": 150,       // Debounce ms for zoom events
  "showDataZoomSlider": true,    // Show zoom slider control
  "enableExport": true,          // PNG/Data export toolbox
  "showTooltip": true,           // Tooltip on hover
  "showLegend": true             // Legend display
}
```

## Development Tips

### Editing Controller Script

The `controllerScript` is a string in JSON. To edit:
1. Copy the script to a `.js` file for editing
2. Test in browser console
3. Stringify and escape for JSON
4. Replace in widget JSON file

### Key ThingsBoard Widget APIs

```javascript
self.ctx                    // Widget context
self.ctx.data               // Current data array
self.ctx.settings           // Widget settings
self.ctx.timeWindow         // Current time window
self.ctx.$container         // jQuery container
self.ctx.dashboard          // Dashboard controller

// Lifecycle hooks
self.onInit()               // Widget initialized
self.onDataUpdated()        // New data received
self.onResize()             // Container resized
self.onDestroy()            // Widget destroyed
```

### Zoom Sync Pattern

```javascript
// Update dashboard timewindow (syncs all widgets)
self.ctx.dashboard.onUpdateTimewindow(startTime, endTime);
```

## Environment Setup

Copy `.env.example` to `.env` and fill in credentials:
```
TB_BASE_URL=https://your-thingsboard-instance.com
TB_USERNAME=your-email@example.com
TB_PASSWORD=your-password
```

Install dependencies:
```bash
npm install
```
