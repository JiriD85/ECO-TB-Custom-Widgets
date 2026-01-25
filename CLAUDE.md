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
├── types/               # Individual widget definitions (one per widget)
│   └── eco_*.json
└── resources/           # Shared JavaScript libraries
    └── eco-widget-utils.js  # Common utilities for all ECO widgets

scripts/                 # Development utilities
├── inject-tw-selector.js    # Inject TW selector into widgets
└── update-settings-schema.js # Update widget settings schemas

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

All ECO widgets MUST include these standardized setting groups using the `groupInfoes` pattern for organized UI display.

### Required Settings Groups (in order)

1. **Chart Settings** - Widget-specific chart configuration (varies per widget)
2. **Legend Settings** - Statistics card display options
3. **Y-Axis Settings** - Axis min/max configuration (if applicable)
4. **Data Processing** - Outlier removal, smoothing
5. **Toolbox Settings** - Export, data view, zoom controls
6. **Timewindow Selector** - Custom timewindow controls

### groupInfoes Pattern (REQUIRED for all widgets)

```json
"settingsSchema": {
  "schema": { ... },
  "form": [
    [ /* Group 0: Chart Settings - widget-specific */ ],
    [ /* Group 1: Legend Settings */ ],
    [ /* Group 2: Y-Axis Settings */ ],
    [ /* Group 3: Data Processing */ ],
    [ /* Group 4: Toolbox Settings */ ],
    [ /* Group 5: Timewindow Selector */ ]
  ],
  "groupInfoes": [
    { "formIndex": 0, "GroupTitle": "Chart Settings" },
    { "formIndex": 1, "GroupTitle": "Legend Settings" },
    { "formIndex": 2, "GroupTitle": "Y-Axis Settings" },
    { "formIndex": 3, "GroupTitle": "Data Processing" },
    { "formIndex": 4, "GroupTitle": "Toolbox Settings" },
    { "formIndex": 5, "GroupTitle": "Timewindow Selector" }
  ]
}
```

### Legend Settings (Standard)
```json
// Schema properties:
"showLegend": { "title": "Show Legend", "type": "boolean", "default": true },
"legendStyle": { "title": "Legend Style", "type": "string", "default": "classic", "enum": ["classic", "card"] },
"legendPosition": { "title": "Legend Position", "type": "string", "default": "bottom", "enum": ["top", "bottom", "left", "right"] },
"legendAlign": { "title": "Legend Alignment", "type": "string", "default": "center", "enum": ["left", "center", "right"] },
"legendCardColorMode": { "title": "Card Color Mode", "type": "string", "default": "auto", "enum": ["auto", "manual", "gradient"] },
"legendCardColor": { "title": "Card Color", "type": "string", "default": "#2196F3" },
"legendValues": { "title": "Statistics to Display", "type": "array", "items": { "type": "string" }, "default": ["current"] },
"showTimestamp": { "title": "Show Timestamp", "type": "boolean", "default": true },
"timestampFormat": { "title": "Timestamp Format", "type": "string", "default": "YYYY-MM-DD HH:mm:ss" }
```

### Data Processing Settings (Standard)
```json
// Schema properties:
"removeOutliers": { "title": "Remove Outliers", "type": "boolean", "default": false },
"outlierMethod": { "title": "Outlier Method", "type": "string", "default": "iqr", "enum": ["iqr", "zscore", "manual"] },
"outlierIqrMultiplier": { "title": "IQR Multiplier", "type": "number", "default": 1.5 },
"outlierZscoreThreshold": { "title": "Z-Score Threshold", "type": "number", "default": 3 },
"outlierMinValue": { "title": "Minimum Value", "type": "number" },
"outlierMaxValue": { "title": "Maximum Value", "type": "number" },
"smoothingEnabled": { "title": "Enable Smoothing", "type": "boolean", "default": false },
"smoothingWindowMinutes": { "title": "Smoothing Window (minutes)", "type": "number", "default": 15 }
```

### Toolbox Settings (Standard)
```json
// Schema properties:
"showToolbox": { "title": "Show Toolbox", "type": "boolean", "default": true },
"toolboxFeatures": { "title": "Toolbox Features", "type": "array", "items": { "type": "string" }, "default": ["saveAsImage", "dataView", "dataZoom", "restore"] }
```

### Timewindow Selector Settings (Standard)
```json
// Schema properties:
"showTimewindowSelector": { "title": "Show Timewindow Selector", "type": "boolean", "default": false },
"twSelectorColor": { "title": "Selector Color", "type": "string", "default": "" },
"twSelectorPosition": { "title": "Selector Position", "type": "string", "default": "center", "enum": ["left", "center", "right"] },
"twSelectorDayFormat": { "title": "Day Format", "type": "string", "default": "D MMM YYYY" },
"twSelectorWeekFormat": { "title": "Week Format", "type": "string", "default": "D-D MMM" },
"twSelectorMonthFormat": { "title": "Month Format", "type": "string", "default": "MMM YYYY" },
"twCustomStartTime": { "title": "Custom Start Time", "type": "string", "default": "" },
"twCustomEndTime": { "title": "Custom End Time", "type": "string", "default": "" },
"twAggregationType": { "title": "Aggregation", "type": "string", "default": "NONE", "enum": ["NONE", "AVG", "MIN", "MAX", "SUM", "COUNT"] },
"twMaxDataPoints": { "title": "Max Data Points", "type": "number", "default": 100000 }
```

### Timewindow Selector - applyTimewindow() Pattern (CRITICAL)
```javascript
// The timewindow selector MUST respect the widget's useDashboardTimewindow setting
function applyTimewindow() {
    var range = calculateTimeRange(twState.mode, twState.currentDate);
    if (!range) return;

    var timewindow = {
        history: {
            fixedTimewindow: { startTimeMs: range.start, endTimeMs: range.end },
            historyType: 0
        },
        aggregation: {
            type: twSettings.aggregationType || 'NONE',
            limit: twSettings.maxDataPoints || 100000
        }
    };

    // CRITICAL: Check if widget uses dashboard timewindow or its own
    var useDashboardTimewindow = self.ctx.widget.config.useDashboardTimewindow;

    if (useDashboardTimewindow !== false) {
        // Use dashboard timewindow (affects all widgets)
        if (self.ctx.dashboard && self.ctx.dashboard.updateDashboardTimewindow) {
            self.ctx.dashboard.updateDashboardTimewindow(timewindow);
        } else if (self.ctx.dashboard && self.ctx.dashboard.onUpdateTimewindow) {
            self.ctx.dashboard.onUpdateTimewindow(range.start, range.end);
        }
    } else {
        // Use widget's own timewindow (affects only this widget)
        if (self.ctx.timewindowFunctions && self.ctx.timewindowFunctions.onUpdateTimewindow) {
            self.ctx.timewindowFunctions.onUpdateTimewindow(range.start, range.end);
        }
    }
}
```

### Template HTML with Timewindow Selector
```html
<div id="widget-wrapper" style="width: 100%; height: 100%; display: flex; flex-direction: column;">
  <div id="timewindow-selector" style="display: none;"></div>
  <div id="stats-card-top" style="padding: 4px 8px; display: none;"></div>
  <div style="flex: 1; min-height: 0; display: flex;">
    <div id="stats-card-left" style="padding: 4px; display: none;"></div>
    <div id="chart-container" style="flex: 1; min-height: 0;"></div>
    <div id="stats-card-right" style="padding: 4px; display: none;"></div>
  </div>
  <div id="stats-card-bottom" style="padding: 4px 8px; display: none;"></div>
</div>
```

### Reference Widget
Use **eco_timeseries_zoom_sync** as the reference implementation for all standard settings.

---

## ECO Widget Utils Library

**IMPORTANT: For new widgets, use the shared utility library instead of copying code.**

The `eco-widget-utils.js` library provides common functionality used across all ECO widgets. This centralizes maintenance - changes only need to be made once.

### Loading the Library

Add to widget resources (in widget JSON or ThingsBoard UI):
```json
"resources": [
  { "url": "https://cdn.jsdelivr.net/npm/echarts@5.5.0/dist/echarts.min.js" },
  { "url": "https://cdn.jsdelivr.net/gh/JiriD85/ECO-TB-Custom-Widgets@main/widgets/resources/eco-widget-utils.js" }
]
```

**Note:** The library is served via jsDelivr CDN from the GitHub repo. After updating `widgets/resources/eco-widget-utils.js`, commit and push to GitHub - jsDelivr will automatically serve the new version.

### Available Modules

#### Timewindow Selector
```javascript
var utils = window.ECOWidgetUtils;

// In onInit:
var twContainer = self.ctx.$container.find('#timewindow-selector')[0];
utils.timewindow.init(twContainer, {
    color: settings.twSelectorColor,
    position: settings.twSelectorPosition,
    dayFormat: settings.twSelectorDayFormat,
    customStartTime: settings.twCustomStartTime,
    customEndTime: settings.twCustomEndTime,
    aggregationType: settings.twAggregationType,
    maxDataPoints: settings.twMaxDataPoints
}, self.ctx);

// In updateChart:
if (settings.showTimewindowSelector) {
    utils.timewindow.render();
} else {
    utils.timewindow.hide();
}
```

#### Statistics
```javascript
var stats = utils.stats.calculate(values);
// Returns: { mean, median, min, max, sum, count }

var p90 = utils.stats.percentile(sortedValues, 90);
var stdDev = utils.stats.stdDev(values, stats.mean);
```

#### Data Processing
```javascript
// Remove outliers
var result = utils.dataProcessing.removeOutliers(values, timestamps, {
    method: 'iqr',  // 'iqr', 'zscore', or 'manual'
    iqrMultiplier: 1.5,
    zscoreThreshold: 3,
    minValue: 0,
    maxValue: 100
});
// Returns: { values, timestamps, removed }

// Smoothing
var windowSize = utils.dataProcessing.getWindowSizeFromMinutes(timestamps, 15);
var smoothed = utils.dataProcessing.movingAverage(values, windowSize);
```

#### Statistics Card
```javascript
utils.statsCard.render(statsCardContainers, {
    showLegend: true,
    legendStyle: 'card',
    legendPosition: 'bottom',
    legendAlign: 'center',
    legendCardColorMode: 'auto',
    legendValues: ['current', 'min', 'max', 'mean'],
    showTimestamp: true,
    timestampFormat: 'YYYY-MM-DD HH:mm:ss',
    allStats: [{ label: 'Temp', units: '°C', decimals: 1, color: '#2196F3', stats: stats }]
});
```

#### Formatting
```javascript
utils.format.value(123.456, 2);  // "123.46"
utils.format.timestamp(Date.now(), 'YYYY-MM-DD HH:mm:ss');
utils.format.date(new Date(), 'D MMM YYYY');  // "25 Jan 2026"
```

#### Color Utilities
```javascript
utils.color.adjust('#2196F3', -40);  // Darken
utils.color.adjust('#2196F3', 40);   // Lighten
utils.color.getDefault(0);  // '#2196F3' (color palette)
```

### Migration Path

When migrating existing widgets to use the library:
1. Add the library URL to widget resources
2. Replace inline functions with library calls
3. Remove duplicated code
4. Test thoroughly

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

---

## Widget Development Guide

This section documents patterns and best practices for creating/modifying ThingsBoard widgets.

### Settings Schema Patterns

#### Dropdown (rc-select)
```json
// In settingsSchema.schema.properties:
"legendStyle": {
  "title": "Legend Style",
  "type": "string",
  "default": "classic",
  "enum": ["classic", "card"]
}

// In settingsSchema.form:
{
  "key": "legendStyle",
  "type": "rc-select",
  "multiple": false,
  "items": [
    {"value": "classic", "label": "Classic (Text)"},
    {"value": "card", "label": "Statistics Card"}
  ]
}
```

#### Color Picker
```json
// In settingsSchema.schema.properties:
"legendCardColor": {
  "title": "Card Color",
  "type": "string",
  "default": "#2196F3"
}

// In settingsSchema.form:
{
  "key": "legendCardColor",
  "type": "color"
}
```

#### Conditional Visibility
Use `condition` with Angular expression to show/hide settings:
```json
{
  "key": "legendAlign",
  "type": "rc-select",
  "condition": "model.showLegend === true && model.legendStyle === 'card'",
  "items": [...]
}
```

#### Multi-Select (checkboxes)
```json
// In schema.properties:
"legendValues": {
  "title": "Values to Display",
  "type": "array",
  "items": { "type": "string" },
  "default": ["min", "max", "mean"]
}

// In form:
{
  "key": "legendValues",
  "type": "checkboxes",
  "titleMap": [
    {"value": "min", "name": "Minimum"},
    {"value": "max", "name": "Maximum"},
    {"value": "mean", "name": "Mean"},
    {"value": "median", "name": "Median"}
  ]
}
```

### Template HTML Structure

For flexible positioning of custom UI elements (cards, legends), use a wrapper with containers for all four positions:

```html
<div id="widget-wrapper" style="width: 100%; height: 100%; display: flex; flex-direction: column;">
  <div id="stats-card-top" style="padding: 4px 8px; display: none;"></div>
  <div style="flex: 1; min-height: 0; display: flex;">
    <div id="stats-card-left" style="padding: 4px; display: none;"></div>
    <div id="chart-container" style="flex: 1; min-height: 0;"></div>
    <div id="stats-card-right" style="padding: 4px; display: none;"></div>
  </div>
  <div id="stats-card-bottom" style="padding: 4px 8px; display: none;"></div>
</div>
```

**Key points:**
- `flex: 1; min-height: 0;` prevents content from overflowing
- All position containers start with `display: none`
- JS selectively shows the active container

### DOM-Based UI Elements (Stats Card Pattern)

When creating custom UI elements, use safe DOM methods instead of innerHTML:

```javascript
// Initialize containers in onInit
var statsCardContainers = {};

self.onInit = function() {
    statsCardContainers = {
        top: self.ctx.$container.find('#stats-card-top')[0],
        bottom: self.ctx.$container.find('#stats-card-bottom')[0],
        left: self.ctx.$container.find('#stats-card-left')[0],
        right: self.ctx.$container.find('#stats-card-right')[0]
    };
};

// Render function pattern
function renderStatsCard(config) {
    // 1. Clear all containers first
    ['top', 'bottom', 'left', 'right'].forEach(function(pos) {
        var container = statsCardContainers[pos];
        if (container) {
            container.style.display = 'none';
            while (container.firstChild) {
                container.removeChild(container.firstChild);
            }
        }
    });

    // 2. Get active container based on position setting
    var position = config.legendPosition || 'bottom';
    var container = statsCardContainers[position];
    if (!container) return;

    // 3. Set up flexbox alignment
    var isVertical = (position === 'left' || position === 'right');
    var alignMap = { left: 'flex-start', center: 'center', right: 'flex-end' };

    container.style.display = 'flex';
    if (isVertical) {
        container.style.flexDirection = 'column';
        container.style.alignItems = alignMap[config.legendAlign || 'center'];
    } else {
        container.style.justifyContent = alignMap[config.legendAlign || 'center'];
    }

    // 4. Create card with DOM methods
    var card = document.createElement('div');
    card.style.cssText = 'background: #2196F3; border-radius: 6px; padding: 8px 12px; color: white; width: fit-content;';

    var label = document.createElement('span');
    label.textContent = 'Label: ';  // Use textContent, not innerHTML
    card.appendChild(label);

    container.appendChild(card);
}
```

### Color Handling

#### Using Series Color
```javascript
var seriesColor = '#2196F3'; // default fallback

// Get color from datasource
if (self.ctx.data && self.ctx.data[0] && self.ctx.data[0].dataKey) {
    seriesColor = self.ctx.data[0].dataKey.color || seriesColor;
}
```

#### Color Adjustment (Darken/Lighten)
```javascript
function adjustColor(hex, amount) {
    var num = parseInt(hex.replace('#', ''), 16);
    var r = Math.min(255, Math.max(0, (num >> 16) + amount));
    var g = Math.min(255, Math.max(0, ((num >> 8) & 0x00FF) + amount));
    var b = Math.min(255, Math.max(0, (num & 0x0000FF) + amount));
    return '#' + (0x1000000 + (r << 16) + (g << 8) + b).toString(16).slice(1);
}
```

#### Gradient Background
```javascript
var colorMode = config.legendCardColorMode || 'auto'; // 'auto', 'manual', 'gradient'
var bgColor = colorMode === 'manual' ? config.legendCardColor : seriesColor;
var bgStyle;

if (colorMode === 'gradient') {
    var gradientDir = isVertical ? '180deg' : '135deg';
    bgStyle = 'linear-gradient(' + gradientDir + ', ' + bgColor + ' 0%, ' + adjustColor(bgColor, -40) + ' 100%)';
} else {
    bgStyle = bgColor;
}

card.style.background = bgStyle;
```

### ECharts Grid Layout Best Practices

**Problem:** Using `height: '32%'` causes charts to overlap when widget is resized.

**Solution:** Use `bottom` and `top` positioning instead of `height`:

```javascript
// BAD - causes overlap
grids = [
    { left: 60, right: 20, top: 40, height: '32%' },  // Don't use height
    { left: 60, right: 20, top: '50%', height: '32%' }
];

// GOOD - prevents overlap
grids = [
    { left: 60, right: 20, top: 40, bottom: '55%' },  // top chart ends at 55%
    { left: 60, right: 20, top: '55%', bottom: 45 }   // bottom chart starts at 55%
];
```

**Margin considerations:**
- `bottom: 45` leaves room for x-axis labels (30px is too small, causes cutoff)
- `top: 40` leaves room for title/toolbox
- Adjust based on label font size and rotation

### typeParameters Configuration

```javascript
self.typeParameters = function() {
    return {
        previewWidth: '100%',
        previewHeight: '100%',
        embedTitlePanel: false,     // false = show ThingsBoard card title/icon
        hasDataExportAction: true,  // Card-level export button
        hasRealtimeAction: false,
        defaultDataKeysCount: 1,
        datasourcesOptional: false,
        // Data viewer integration
        dataKeySettingsSchema: {...},
        dataKeySettingsForm: [...]
    };
};
```

**Important:** `embedTitlePanel: false` shows the standard ThingsBoard card title bar with icon. Set to `true` only if widget draws its own title.

### Workflow: Editing Widget Code

1. **Pull latest from server:**
   ```bash
   node sync/sync.js pull-bundle eco_custom_widgets
   ```

2. **Edit source file:** `widgets/src/eco_widget_name.js`

3. **CRITICAL - Update JSON from source:** The sync script only uploads JSON files. You MUST update the `controllerScript` in the JSON file before syncing:
   ```bash
   node -e "
   const fs = require('fs');
   const widgetName = 'eco_widget_name';  // Change this
   const js = fs.readFileSync('widgets/src/' + widgetName + '.js', 'utf8');
   const json = JSON.parse(fs.readFileSync('widgets/types/' + widgetName + '.json', 'utf8'));
   json.descriptor.controllerScript = js;
   fs.writeFileSync('widgets/types/' + widgetName + '.json', JSON.stringify(json, null, 2));
   console.log('Updated ' + widgetName + '.json');
   "
   ```

4. **Sync to server:**
   ```bash
   node sync/sync.js sync
   ```

5. **Test in ThingsBoard:** Hard reload (Cmd+Shift+R) to bypass cache, check widget preview

### Common Issues & Solutions

| Issue | Cause | Solution |
|-------|-------|----------|
| Charts overlap on resize | Using `height: 'X%'` in grid | Use `bottom: 'X%'` and `top: 'X%'` |
| Axis labels cut off | Insufficient margin | Increase `bottom`/`left` margin (45px for bottom) |
| Card title not showing | `embedTitlePanel: true` | Set `embedTitlePanel: false` |
| Legend card too wide | Fixed width | Use `width: fit-content` |
| Settings not saving | Wrong schema type | Check type matches (string, boolean, array) |
| Color picker not working | Wrong form type | Use `"type": "color"` in form |
| Conditional field not hiding | Wrong condition syntax | Use `model.fieldName === value` |
| Widget bottom cut off on load | ECharts captures size before stats cards render | Use resize fix pattern (see below) |
| Changes not appearing after sync | JSON controllerScript not updated | Run conversion script before sync (step 3) |

### Resize Fix Pattern (Stats Cards + ECharts)

When widgets have DOM elements (like stats cards) that render after ECharts initialization, the chart captures the wrong container size. Use this pattern to fix:

```javascript
var chart = null;
var chartContainer = null;
var resizeObserver = null;

self.onInit = function() {
    chartContainer = self.ctx.$container.find('#chart-container')[0];
    chart = echarts.init(chartContainer);
    updateChart();

    // Multiple delayed resizes for ThingsBoard's async layout
    [100, 250, 500, 1000].forEach(function(delay) {
        setTimeout(function() {
            if (chart && chartContainer) {
                chart.resize({
                    width: chartContainer.offsetWidth,
                    height: chartContainer.offsetHeight
                });
            }
        }, delay);
    });

    // ResizeObserver for dynamic container changes
    if (typeof ResizeObserver !== 'undefined') {
        resizeObserver = new ResizeObserver(function() {
            requestAnimationFrame(function() {
                if (chart && chartContainer) {
                    chart.resize({
                        width: chartContainer.offsetWidth,
                        height: chartContainer.offsetHeight
                    });
                }
            });
        });
        resizeObserver.observe(chartContainer);
    }
};

self.onResize = function() {
    if (chart && chartContainer) {
        chart.resize({
            width: chartContainer.offsetWidth,
            height: chartContainer.offsetHeight
        });
    }
};

self.onDestroy = function() {
    if (resizeObserver) {
        resizeObserver.disconnect();
        resizeObserver = null;
    }
    if (chart) {
        chart.dispose();
        chart = null;
    }
};
```

**Key points:**
- Always use explicit dimensions: `chart.resize({ width: w, height: h })`
- `chart.resize()` without params often fails to detect new container size
- Multiple setTimeout delays handle ThingsBoard's async widget loading
- ResizeObserver handles dynamic container changes (e.g., after stats cards render)
- Clean up ResizeObserver in onDestroy to prevent memory leaks

### Multi-Series Stats Card Pattern

When widget displays multiple datasources/dataKeys, each series gets its own stats card:

```javascript
// Iterate all datasources and dataKeys
var allSeries = [];
for (var i = 0; i < self.ctx.data.length; i++) {
    var ds = self.ctx.data[i];
    var dataKey = ds.dataKey || {};
    var color = dataKey.color || getDefaultColor(i);

    allSeries.push({
        label: dataKey.label || dataKey.name,
        color: color,
        values: ds.data.map(function(d) { return d[1]; }),
        lastTimestamp: ds.data.length ? ds.data[ds.data.length - 1][0] : null
    });
}

// Render card for each series
allSeries.forEach(function(series) {
    var stats = calculateStatistics(series.values);
    renderSingleCard(container, series, stats, config);
});
```

### Dual Y-Axis Configuration

For widgets with different units (e.g., temperature + humidity):

```javascript
// Detect if dual axes needed based on units
var unitGroups = {};
allSeries.forEach(function(s, i) {
    var unit = s.units || '';
    if (!unitGroups[unit]) unitGroups[unit] = [];
    unitGroups[unit].push(i);
});

var needsDualAxis = Object.keys(unitGroups).length === 2;

// Configure Y axes
var yAxes = [{
    type: 'value',
    name: firstUnit,
    position: 'left'
}];

if (needsDualAxis) {
    yAxes.push({
        type: 'value',
        name: secondUnit,
        position: 'right'
    });
}

// Assign yAxisIndex to each series
series.forEach(function(s, i) {
    s.yAxisIndex = unitGroups[s.units].includes(i) && needsDualAxis ? 1 : 0;
});
```

### Toolbox Visibility Settings

Configure ECharts toolbox with granular visibility:

```javascript
var toolboxConfig = {
    show: settings.showToolbox !== false,
    right: 10,
    top: 5,
    feature: {
        saveAsImage: {
            show: settings.showSaveAsImage !== false,
            title: 'Save as PNG',
            pixelRatio: 2
        },
        dataView: {
            show: settings.showDataView !== false,
            title: 'Data View',
            readOnly: true
        },
        dataZoom: {
            show: settings.showDataZoom !== false,
            title: { zoom: 'Zoom', back: 'Reset' }
        },
        restore: {
            show: settings.showRestore !== false,
            title: 'Restore'
        }
    }
};
```

Settings schema pattern:
```json
"showToolbox": { "type": "boolean", "default": true },
"showSaveAsImage": { "type": "boolean", "default": true },
"showDataView": { "type": "boolean", "default": true },
"showDataZoom": { "type": "boolean", "default": true },
"showRestore": { "type": "boolean", "default": true }
```

Form with conditions:
```json
{ "key": "showSaveAsImage", "condition": "model.showToolbox === true" },
{ "key": "showDataView", "condition": "model.showToolbox === true" },
{ "key": "showDataZoom", "condition": "model.showToolbox === true" },
{ "key": "showRestore", "condition": "model.showToolbox === true" }
```

### Reference Widget

**eco_timeseries_zoom_sync** serves as the reference implementation for:
- Multi-series data handling
- Statistics cards with flexible positioning
- Dual Y-axis auto-detection
- Toolbox with granular settings
- Card-level platform integration (hasDataExportAction)

Source: `widgets/src/eco_timeseries_zoom_sync.js`
