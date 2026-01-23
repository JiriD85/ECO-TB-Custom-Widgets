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
│       ├── eco_load_duration_curve.json
│       └── eco_timeseries_zoom_sync.json
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
