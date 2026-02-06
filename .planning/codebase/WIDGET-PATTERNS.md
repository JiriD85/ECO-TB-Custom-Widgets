# Widget Development Patterns

Detailed patterns and best practices for ECO ThingsBoard widgets.

## Settings Schema Patterns

### Dropdown (rc-select)
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

### Color Picker
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

### Conditional Visibility
```json
{
  "key": "legendAlign",
  "type": "rc-select",
  "condition": "model.showLegend === true && model.legendStyle === 'card'",
  "items": [...]
}
```

### Multi-Select (checkboxes)
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

### groupInfoes Pattern (Required)
```json
"settingsSchema": {
  "schema": { ... },
  "form": [
    [ /* Group 0: Chart Settings */ ],
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

---

## Standard Settings Properties

### Legend Settings
```json
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

### Data Processing Settings
```json
"removeOutliers": { "title": "Remove Outliers", "type": "boolean", "default": false },
"outlierMethod": { "title": "Outlier Method", "type": "string", "default": "iqr", "enum": ["iqr", "zscore", "manual"] },
"outlierIqrMultiplier": { "title": "IQR Multiplier", "type": "number", "default": 1.5 },
"outlierZscoreThreshold": { "title": "Z-Score Threshold", "type": "number", "default": 3 },
"outlierMinValue": { "title": "Minimum Value", "type": "number" },
"outlierMaxValue": { "title": "Maximum Value", "type": "number" },
"smoothingEnabled": { "title": "Enable Smoothing", "type": "boolean", "default": false },
"smoothingWindowMinutes": { "title": "Smoothing Window (minutes)", "type": "number", "default": 15 }
```

### Toolbox Settings
```json
"showToolbox": { "title": "Show Toolbox", "type": "boolean", "default": true },
"toolboxFeatures": { "title": "Toolbox Features", "type": "array", "items": { "type": "string" }, "default": ["saveAsImage", "dataView", "dataZoom", "restore"] }
```

### Timewindow Selector Settings
```json
"showTimewindowSelector": { "title": "Show Timewindow Selector", "type": "boolean", "default": false },
"twSelectorColor": { "title": "Selector Color", "type": "string", "default": "" },
"twSelectorPosition": { "title": "Selector Position", "type": "string", "default": "center", "enum": ["left", "center", "right"] },
"twSelectorDayFormat": { "title": "Day Format", "type": "string", "default": "D MMM YYYY" },
"twAggregationType": { "title": "Aggregation", "type": "string", "default": "NONE", "enum": ["NONE", "AVG", "MIN", "MAX", "SUM", "COUNT"] },
"twMaxDataPoints": { "title": "Max Data Points", "type": "number", "default": 100000 }
```

---

## Template HTML Structure

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

**Key points:**
- `flex: 1; min-height: 0;` prevents content from overflowing
- All position containers start with `display: none`
- JS selectively shows the active container

---

## Resize Fix Pattern

When widgets have DOM elements (like stats cards) that render after ECharts initialization:

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

---

## Timewindow Selector Pattern

```javascript
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

---

## ECharts Grid Layout

**Problem:** Using `height: '32%'` causes charts to overlap when widget is resized.

**Solution:** Use `bottom` and `top` positioning instead of `height`:

```javascript
// BAD - causes overlap
grids = [
    { left: 60, right: 20, top: 40, height: '32%' },
    { left: 60, right: 20, top: '50%', height: '32%' }
];

// GOOD - prevents overlap
grids = [
    { left: 60, right: 20, top: 40, bottom: '55%' },
    { left: 60, right: 20, top: '55%', bottom: 45 }
];
```

**Margins:**
- `bottom: 45` leaves room for x-axis labels
- `top: 40` leaves room for title/toolbox

---

## typeParameters Configuration

```javascript
self.typeParameters = function() {
    return {
        previewWidth: '100%',
        previewHeight: '100%',
        embedTitlePanel: false,     // false = show ThingsBoard card title/icon
        hasDataExportAction: true,  // Card-level export button
        hasRealtimeAction: false,
        defaultDataKeysCount: 1,
        datasourcesOptional: false
    };
};
```

---

## Color Utilities

```javascript
function adjustColor(hex, amount) {
    var num = parseInt(hex.replace('#', ''), 16);
    var r = Math.min(255, Math.max(0, (num >> 16) + amount));
    var g = Math.min(255, Math.max(0, ((num >> 8) & 0x00FF) + amount));
    var b = Math.min(255, Math.max(0, (num & 0x0000FF) + amount));
    return '#' + (0x1000000 + (r << 16) + (g << 8) + b).toString(16).slice(1);
}

// Usage
adjustColor('#2196F3', -40);  // Darken
adjustColor('#2196F3', 40);   // Lighten
```

---

## ECO Widget Utils Library

Load via CDN:
```json
"resources": [
  { "url": "https://cdn.jsdelivr.net/npm/echarts@5.5.0/dist/echarts.min.js" },
  { "url": "https://cdn.jsdelivr.net/gh/JiriD85/ECO-TB-Custom-Widgets@main/widgets/resources/eco-widget-utils.js" }
]
```

**Modules:**
- `utils.timewindow.init()` / `.render()` / `.hide()`
- `utils.stats.calculate(values)` → { mean, median, min, max, sum, count }
- `utils.dataProcessing.removeOutliers(values, timestamps, options)`
- `utils.statsCard.render(containers, config)`
- `utils.format.value()` / `.timestamp()` / `.date()`
- `utils.color.adjust()` / `.getDefault()`

---

## Common Issues & Solutions

| Issue | Cause | Solution |
|-------|-------|----------|
| Charts overlap on resize | Using `height: 'X%'` in grid | Use `bottom: 'X%'` and `top: 'X%'` |
| Axis labels cut off | Insufficient margin | Increase `bottom`/`left` margin (45px) |
| Card title not showing | `embedTitlePanel: true` | Set `embedTitlePanel: false` |
| Legend card too wide | Fixed width | Use `width: fit-content` |
| Settings not saving | Wrong schema type | Check type matches (string/boolean/array) |
| Color picker not working | Wrong form type | Use `"type": "color"` in form |
| Conditional field not hiding | Wrong condition syntax | Use `model.fieldName === value` |
| Widget bottom cut off | ECharts captures size before stats cards | Use resize fix pattern |
| Changes not appearing | Browser cache | Hard reload (Cmd+Shift+R) |

---

*Last updated: 2026-02-04*
