/**
 * Script to update ECO widget settings schemas with standard groupInfoes pattern
 * and timewindow selector settings
 *
 * Usage: node scripts/update-settings-schema.js
 */

const fs = require('fs');
const path = require('path');

// Standard timewindow selector settings to add to schema
const TW_SETTINGS = {
    showTimewindowSelector: { title: "Show Timewindow Selector", type: "boolean", default: false },
    twSelectorColor: { title: "Selector Color", type: "string", default: "" },
    twSelectorPosition: { title: "Selector Position", type: "string", default: "center", enum: ["left", "center", "right"] },
    twSelectorDayFormat: { title: "Day Format", type: "string", default: "D MMM YYYY" },
    twSelectorWeekFormat: { title: "Week Format", type: "string", default: "D-D MMM" },
    twSelectorMonthFormat: { title: "Month Format", type: "string", default: "MMM YYYY" },
    twCustomStartTime: { title: "Custom Start Time", type: "string", default: "" },
    twCustomEndTime: { title: "Custom End Time", type: "string", default: "" },
    twAggregationType: { title: "Aggregation", type: "string", default: "NONE", enum: ["NONE", "AVG", "MIN", "MAX", "SUM", "COUNT"] },
    twMaxDataPoints: { title: "Max Data Points", type: "number", default: 100000 }
};

// Standard timewindow selector form group
const TW_FORM_GROUP = [
    "showTimewindowSelector",
    { key: "twSelectorColor", type: "color", condition: "model.showTimewindowSelector === true", description: "Leave empty for auto (uses series color)" },
    { key: "twSelectorPosition", type: "rc-select", multiple: false, condition: "model.showTimewindowSelector === true", items: [{ value: "left", label: "Left" }, { value: "center", label: "Center" }, { value: "right", label: "Right" }] },
    { key: "twSelectorDayFormat", condition: "model.showTimewindowSelector === true", description: "Format: D=day, MMM=month, YYYY=year" },
    { key: "twSelectorWeekFormat", condition: "model.showTimewindowSelector === true" },
    { key: "twSelectorMonthFormat", condition: "model.showTimewindowSelector === true" },
    { key: "twCustomStartTime", condition: "model.showTimewindowSelector === true", description: "Use ${attributeName} for entity attributes" },
    { key: "twCustomEndTime", condition: "model.showTimewindowSelector === true", description: "Use ${attributeName} for entity attributes" },
    { key: "twAggregationType", type: "rc-select", multiple: false, condition: "model.showTimewindowSelector === true", items: [{ value: "NONE", label: "None (Raw Data)" }, { value: "AVG", label: "Average" }, { value: "MIN", label: "Minimum" }, { value: "MAX", label: "Maximum" }, { value: "SUM", label: "Sum" }, { value: "COUNT", label: "Count" }] },
    { key: "twMaxDataPoints", condition: "model.showTimewindowSelector === true", description: "Maximum data points (default: 100000)" }
];

// Standard legend settings to add if missing
const LEGEND_SETTINGS = {
    showLegend: { title: "Show Legend", type: "boolean", default: true },
    legendStyle: { title: "Legend Style", type: "string", default: "classic", enum: ["classic", "card"] },
    legendPosition: { title: "Legend Position", type: "string", default: "bottom", enum: ["top", "bottom", "left", "right"] },
    legendAlign: { title: "Legend Alignment", type: "string", default: "center", enum: ["left", "center", "right"] },
    legendCardColorMode: { title: "Card Color Mode", type: "string", default: "auto", enum: ["auto", "manual", "gradient"] },
    legendCardColor: { title: "Card Color", type: "string", default: "#2196F3" },
    legendValues: { title: "Statistics to Display", type: "array", items: { type: "string" }, default: ["current"] },
    showTimestamp: { title: "Show Timestamp", type: "boolean", default: true },
    timestampFormat: { title: "Timestamp Format", type: "string", default: "YYYY-MM-DD HH:mm:ss" },
    showTooltip: { title: "Show Tooltip", type: "boolean", default: true }
};

// Standard data processing settings
const DATA_PROCESSING_SETTINGS = {
    removeOutliers: { title: "Remove Outliers", type: "boolean", default: false },
    outlierMethod: { title: "Outlier Method", type: "string", default: "iqr", enum: ["iqr", "zscore", "manual"] },
    outlierIqrMultiplier: { title: "IQR Multiplier", type: "number", default: 1.5 },
    outlierZscoreThreshold: { title: "Z-Score Threshold", type: "number", default: 3 },
    outlierMinValue: { title: "Minimum Value", type: "number" },
    outlierMaxValue: { title: "Maximum Value", type: "number" },
    smoothingEnabled: { title: "Enable Smoothing", type: "boolean", default: false },
    smoothingWindowMinutes: { title: "Smoothing Window (minutes)", type: "number", default: 15 }
};

// Standard toolbox settings
const TOOLBOX_SETTINGS = {
    showToolbox: { title: "Show Toolbox", type: "boolean", default: true },
    toolboxFeatures: { title: "Toolbox Features", type: "array", items: { type: "string" }, default: ["saveAsImage", "dataView", "dataZoom", "restore"] }
};

// Widgets that need updating (skip eco_timeseries_zoom_sync as it's the reference)
const WIDGETS_TO_UPDATE = [
    'eco_boxplot',
    'eco_candlestick_basic',
    'eco_candlestick_brush',
    'eco_calendar_heatmap',
    'eco_heatmap_cartesian',
    'eco_line_confidence_band'
    // eco_load_duration_curve was already updated manually
];

function updateWidgetSchema(widgetPath) {
    console.log(`Processing: ${path.basename(widgetPath)}`);

    try {
        const widgetJson = JSON.parse(fs.readFileSync(widgetPath, 'utf8'));
        const settingsSchema = widgetJson.descriptor.settingsSchema;

        if (!settingsSchema || !settingsSchema.schema || !settingsSchema.schema.properties) {
            console.log(`  - No valid settings schema found, skipping`);
            return false;
        }

        const properties = settingsSchema.schema.properties;
        let modified = false;

        // Add TW settings if not present
        if (!properties.showTimewindowSelector) {
            Object.assign(properties, TW_SETTINGS);
            modified = true;
            console.log(`  - Added timewindow selector settings`);
        }

        // Add legend settings if not present (check for key settings)
        if (!properties.legendStyle) {
            Object.assign(properties, LEGEND_SETTINGS);
            modified = true;
            console.log(`  - Added legend settings`);
        }

        // Add data processing settings if not present
        if (!properties.removeOutliers) {
            Object.assign(properties, DATA_PROCESSING_SETTINGS);
            modified = true;
            console.log(`  - Added data processing settings`);
        }

        // Add toolbox settings if not present
        if (!properties.showToolbox) {
            Object.assign(properties, TOOLBOX_SETTINGS);
            modified = true;
            console.log(`  - Added toolbox settings`);
        }

        // Check if groupInfoes already exists
        if (settingsSchema.groupInfoes) {
            console.log(`  - groupInfoes already exists, skipping form restructure`);
        } else {
            // Need to restructure form into groups and add groupInfoes
            // This is complex and widget-specific, so we'll add a basic TW group
            console.log(`  - Note: Form restructuring to groupInfoes requires manual work`);
        }

        if (modified) {
            // Write back
            fs.writeFileSync(widgetPath, JSON.stringify(widgetJson, null, 2));
            console.log(`  - Saved changes`);
            return true;
        } else {
            console.log(`  - No changes needed`);
            return false;
        }

    } catch (error) {
        console.error(`  - Error: ${error.message}`);
        return null;
    }
}

// Update templateHtml to include timewindow-selector container
function updateTemplateHtml(widgetPath) {
    try {
        const widgetJson = JSON.parse(fs.readFileSync(widgetPath, 'utf8'));
        let templateHtml = widgetJson.descriptor.templateHtml;

        if (!templateHtml.includes('timewindow-selector')) {
            // Add timewindow-selector container after widget-wrapper opening
            templateHtml = templateHtml.replace(
                /<div id="widget-wrapper"([^>]*)>/,
                '<div id="widget-wrapper"$1><div id="timewindow-selector" style="display: none;"></div>'
            );
            widgetJson.descriptor.templateHtml = templateHtml;
            fs.writeFileSync(widgetPath, JSON.stringify(widgetJson, null, 2));
            console.log(`  - Added timewindow-selector container to HTML`);
            return true;
        }
        return false;
    } catch (error) {
        console.error(`  - Error updating HTML: ${error.message}`);
        return false;
    }
}

// Main execution
const widgetsDir = path.join(__dirname, '..', 'widgets', 'types');

console.log('ECO Widget Settings Schema Updater\n');

WIDGETS_TO_UPDATE.forEach(widgetName => {
    const widgetPath = path.join(widgetsDir, `${widgetName}.json`);

    if (!fs.existsSync(widgetPath)) {
        console.log(`Widget not found: ${widgetName}\n`);
        return;
    }

    updateWidgetSchema(widgetPath);
    updateTemplateHtml(widgetPath);
    console.log('');
});

console.log('Complete! Run "node sync/sync.js sync" to push changes to ThingsBoard.');
