/**
 * Script to inject Timewindow Selector functions into ECO widget controllerScripts
 *
 * Usage: node scripts/inject-tw-selector.js
 */

const fs = require('fs');
const path = require('path');

// Timewindow selector code to inject
const TW_VARIABLES = `
// Timewindow selector state
var twState = {
    mode: 'day',  // 'day', 'week', 'month', 'custom'
    currentDate: new Date()  // Reference date for navigation
};

// Cached settings for timewindow selector
var twSettings = {};
var timewindowSelectorContainer = null;
`;

const TW_INIT_CODE = `
    timewindowSelectorContainer = self.ctx.$container.find('#timewindow-selector')[0];
`;

const TW_UPDATE_CHART_CODE = `
    // Timewindow selector settings
    var showTimewindowSelector = settings.showTimewindowSelector === true;

    // Cache timewindow selector settings for use in render function
    twSettings = {
        color: settings.twSelectorColor || '',
        position: settings.twSelectorPosition || 'center',
        dayFormat: settings.twSelectorDayFormat || 'D MMM YYYY',
        weekFormat: settings.twSelectorWeekFormat || 'D-D MMM',
        monthFormat: settings.twSelectorMonthFormat || 'MMM YYYY',
        customStartTime: settings.twCustomStartTime || '',
        customEndTime: settings.twCustomEndTime || '',
        aggregationType: settings.twAggregationType || 'NONE',
        maxDataPoints: settings.twMaxDataPoints || 100000
    };

    // Render timewindow selector if enabled
    if (showTimewindowSelector && self.ctx.dashboard) {
        renderTimewindowSelector();
    } else if (timewindowSelectorContainer) {
        timewindowSelectorContainer.style.display = 'none';
    }
`;

const TW_FUNCTIONS = `
// ========================================
// Timewindow Selector Functions
// ========================================

function renderTimewindowSelector() {
    if (!timewindowSelectorContainer) return;

    while (timewindowSelectorContainer.firstChild) {
        timewindowSelectorContainer.removeChild(timewindowSelectorContainer.firstChild);
    }

    var positionMap = { left: 'flex-start', center: 'center', right: 'flex-end' };
    var position = twSettings.position || 'center';

    timewindowSelectorContainer.style.display = 'flex';
    timewindowSelectorContainer.style.alignItems = 'center';
    timewindowSelectorContainer.style.justifyContent = positionMap[position] || 'center';
    timewindowSelectorContainer.style.gap = '8px';
    timewindowSelectorContainer.style.padding = '8px';

    var accentColor = '#2196F3';
    if (twSettings.color && twSettings.color !== '') {
        accentColor = twSettings.color;
    } else if (self.ctx.data && self.ctx.data[0] && self.ctx.data[0].dataKey && self.ctx.data[0].dataKey.color) {
        accentColor = self.ctx.data[0].dataKey.color;
    }

    var wrapper = document.createElement('div');
    wrapper.style.cssText = 'display: flex; align-items: center; gap: 6px; background: ' + accentColor + '; border-radius: 6px; padding: 6px 10px; box-shadow: 0 2px 6px rgba(0,0,0,0.12);';

    var hasCustomRange = twSettings.customStartTime || twSettings.customEndTime;

    if (twState.mode !== 'custom') {
        var prevBtn = createNavButton('◀', accentColor, function() { navigateTimewindow(-1); });
        wrapper.appendChild(prevBtn);
    }

    var periodBtns = document.createElement('div');
    periodBtns.style.cssText = 'display: flex; gap: 4px;';

    ['day', 'week', 'month'].forEach(function(mode) {
        var btn = createPeriodButton(mode, accentColor);
        periodBtns.appendChild(btn);
    });

    if (hasCustomRange) {
        var customBtn = createPeriodButton('custom', accentColor);
        periodBtns.appendChild(customBtn);
    }

    wrapper.appendChild(periodBtns);

    if (twState.mode !== 'custom') {
        var nextBtn = createNavButton('▶', accentColor, function() { navigateTimewindow(1); });
        wrapper.appendChild(nextBtn);
    }

    var periodLabel = document.createElement('span');
    periodLabel.id = 'tw-period-label';
    periodLabel.style.cssText = 'color: white; font-size: 11px; margin-left: 8px; opacity: 0.9;';
    periodLabel.textContent = formatPeriodLabel(twState.mode, twState.currentDate);
    wrapper.appendChild(periodLabel);

    timewindowSelectorContainer.appendChild(wrapper);
}

function createNavButton(symbol, accentColor, onClick) {
    var btn = document.createElement('button');
    btn.textContent = symbol;
    btn.style.cssText = 'background: rgba(255,255,255,0.2); border: none; color: white; width: 24px; height: 24px; border-radius: 4px; cursor: pointer; font-size: 10px; display: flex; align-items: center; justify-content: center; transition: background 0.2s;';
    btn.onmouseover = function() { btn.style.background = 'rgba(255,255,255,0.35)'; };
    btn.onmouseout = function() { btn.style.background = 'rgba(255,255,255,0.2)'; };
    btn.onclick = onClick;
    return btn;
}

function createPeriodButton(mode, accentColor) {
    var labels = { day: 'D', week: 'W', month: 'M', custom: 'C' };
    var titles = { day: 'Day', week: 'Week', month: 'Month', custom: 'Custom Range' };

    var btn = document.createElement('button');
    btn.textContent = labels[mode];
    btn.title = titles[mode];
    btn.setAttribute('data-mode', mode);

    var isActive = twState.mode === mode;
    var baseStyle = 'border: none; width: 28px; height: 24px; border-radius: 4px; cursor: pointer; font-size: 11px; font-weight: 600; transition: all 0.2s;';
    var activeStyle = 'background: white; color: ' + accentColor + ';';
    var inactiveStyle = 'background: rgba(255,255,255,0.2); color: white;';

    btn.style.cssText = baseStyle + (isActive ? activeStyle : inactiveStyle);

    btn.onmouseover = function() { if (twState.mode !== mode) { btn.style.background = 'rgba(255,255,255,0.35)'; } };
    btn.onmouseout = function() { if (twState.mode !== mode) { btn.style.background = 'rgba(255,255,255,0.2)'; } };
    btn.onclick = function() { selectPeriodMode(mode); };

    return btn;
}

function selectPeriodMode(mode) {
    twState.mode = mode;
    if (mode !== 'custom') {
        twState.currentDate = new Date();
    }
    applyTimewindow();
    renderTimewindowSelector();
}

function navigateTimewindow(direction) {
    var d = new Date(twState.currentDate);

    switch (twState.mode) {
        case 'day': d.setDate(d.getDate() + direction); break;
        case 'week': d.setDate(d.getDate() + (direction * 7)); break;
        case 'month': d.setMonth(d.getMonth() + direction); break;
    }

    twState.currentDate = d;
    applyTimewindow();
    updatePeriodLabel();
}

function applyTimewindow() {
    var range;

    if (twState.mode === 'custom') {
        range = calculateCustomTimeRange();
    } else {
        range = calculateTimeRange(twState.mode, twState.currentDate);
    }

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

    var useDashboardTimewindow = self.ctx.widget.config.useDashboardTimewindow;

    if (useDashboardTimewindow !== false) {
        if (self.ctx.dashboard && self.ctx.dashboard.updateDashboardTimewindow) {
            self.ctx.dashboard.updateDashboardTimewindow(timewindow);
        } else if (self.ctx.dashboard && self.ctx.dashboard.onUpdateTimewindow) {
            self.ctx.dashboard.onUpdateTimewindow(range.start, range.end);
        }
    } else {
        if (self.ctx.timewindowFunctions && self.ctx.timewindowFunctions.onUpdateTimewindow) {
            self.ctx.timewindowFunctions.onUpdateTimewindow(range.start, range.end);
        }
    }
}

function calculateCustomTimeRange() {
    var startStr = twSettings.customStartTime || '';
    var endStr = twSettings.customEndTime || '';

    var startMs = resolveTimeValue(startStr);
    var endMs = resolveTimeValue(endStr);

    if (startMs === null) {
        var now = new Date();
        startMs = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0).getTime();
    }
    if (endMs === null) {
        var now2 = new Date();
        endMs = new Date(now2.getFullYear(), now2.getMonth(), now2.getDate(), 23, 59, 59, 999).getTime();
    }

    return { start: startMs, end: endMs };
}

function resolveTimeValue(valueStr) {
    if (!valueStr || valueStr === '') return null;

    var varMatch = valueStr.match(/^\\$\\{(.+)\\}$/);
    if (varMatch) {
        var attrName = varMatch[1];
        return resolveEntityAttribute(attrName);
    }

    var numVal = Number(valueStr);
    if (!isNaN(numVal) && numVal > 0) return numVal;

    var dateVal = Date.parse(valueStr);
    if (!isNaN(dateVal)) return dateVal;

    return null;
}

function resolveEntityAttribute(attrName) {
    if (self.ctx.datasources && self.ctx.datasources.length > 0) {
        var ds = self.ctx.datasources[0];
        if (ds.entity) {
            if (ds.entity.attributes && ds.entity.attributes[attrName] !== undefined) {
                return Number(ds.entity.attributes[attrName]);
            }
            if (ds.entity.sharedAttributes && ds.entity.sharedAttributes[attrName] !== undefined) {
                return Number(ds.entity.sharedAttributes[attrName]);
            }
        }
        if (self.ctx.latestData) {
            for (var i = 0; i < self.ctx.latestData.length; i++) {
                var ld = self.ctx.latestData[i];
                if (ld.dataKey && ld.dataKey.name === attrName && ld.data && ld.data.length > 0) {
                    return Number(ld.data[ld.data.length - 1][1]);
                }
            }
        }
    }
    return null;
}

function calculateTimeRange(mode, referenceDate) {
    var start, end;
    var d = new Date(referenceDate);

    switch (mode) {
        case 'day':
            start = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0);
            end = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999);
            break;
        case 'week':
            var dayOfWeek = d.getDay();
            var diffToMonday = (dayOfWeek === 0 ? -6 : 1) - dayOfWeek;
            var monday = new Date(d);
            monday.setDate(d.getDate() + diffToMonday);
            start = new Date(monday.getFullYear(), monday.getMonth(), monday.getDate(), 0, 0, 0, 0);
            var sunday = new Date(monday);
            sunday.setDate(monday.getDate() + 6);
            end = new Date(sunday.getFullYear(), sunday.getMonth(), sunday.getDate(), 23, 59, 59, 999);
            break;
        case 'month':
            start = new Date(d.getFullYear(), d.getMonth(), 1, 0, 0, 0, 0);
            end = new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59, 999);
            break;
    }

    return { start: start.getTime(), end: end.getTime() };
}

function formatPeriodLabel(mode, date) {
    var d = new Date(date);

    switch (mode) {
        case 'day':
            return formatDateString(d, twSettings.dayFormat || 'D MMM YYYY');
        case 'week':
            var range = calculateTimeRange('week', d);
            var startD = new Date(range.start);
            var endD = new Date(range.end);
            if (startD.getMonth() === endD.getMonth()) {
                return startD.getDate() + '-' + endD.getDate() + ' ' + getMonthShort(startD.getMonth());
            } else {
                return startD.getDate() + ' ' + getMonthShort(startD.getMonth()) + ' - ' + endD.getDate() + ' ' + getMonthShort(endD.getMonth());
            }
        case 'month':
            return formatDateString(d, twSettings.monthFormat || 'MMM YYYY');
        case 'custom':
            var customRange = calculateCustomTimeRange();
            if (customRange) {
                var startDate = new Date(customRange.start);
                var endDate = new Date(customRange.end);
                return formatDateString(startDate, 'DD.MM.YY') + ' - ' + formatDateString(endDate, 'DD.MM.YY');
            }
            return 'Custom';
    }

    return '';
}

function formatDateString(date, format) {
    var months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    var d = new Date(date);

    return format
        .replace('YYYY', d.getFullYear())
        .replace('YY', String(d.getFullYear()).slice(-2))
        .replace('MMM', months[d.getMonth()])
        .replace('MM', String(d.getMonth() + 1).padStart(2, '0'))
        .replace('DD', String(d.getDate()).padStart(2, '0'))
        .replace('D', d.getDate());
}

function getMonthShort(monthIndex) {
    var months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return months[monthIndex];
}

function updatePeriodLabel() {
    var labelEl = document.getElementById('tw-period-label');
    if (labelEl) {
        labelEl.textContent = formatPeriodLabel(twState.mode, twState.currentDate);
    }
}

// ========================================
// End Timewindow Selector Functions
// ========================================
`;

// List of widgets to update (timeseries only)
const WIDGETS_TO_UPDATE = [
    'eco_load_duration_curve',
    'eco_boxplot',
    'eco_candlestick_basic',
    'eco_candlestick_brush',
    'eco_calendar_heatmap',
    'eco_heatmap_cartesian',
    'eco_line_confidence_band'
];

function injectTwSelector(widgetPath) {
    console.log(`Processing: ${widgetPath}`);

    try {
        const widgetJson = JSON.parse(fs.readFileSync(widgetPath, 'utf8'));
        let controllerScript = widgetJson.descriptor.controllerScript;

        // Check if already has TW selector
        if (controllerScript.includes('twState')) {
            console.log(`  - Already has timewindow selector, skipping`);
            return false;
        }

        // 1. Add TW variables after existing variable declarations
        // Look for "var chart = null;" or "var resizeObserver = null;"
        const varPattern = /var resizeObserver = null;/;
        if (varPattern.test(controllerScript)) {
            controllerScript = controllerScript.replace(
                varPattern,
                `var resizeObserver = null;${TW_VARIABLES}`
            );
        } else {
            // Alternative: add after first var declaration block
            controllerScript = controllerScript.replace(
                /(var chart = null;)/,
                `$1${TW_VARIABLES}`
            );
        }

        // 2. Add TW container initialization in onInit
        // Look for statsCardContainers initialization
        const initPattern = /(statsCardContainers = \{[^}]+\};)/;
        if (initPattern.test(controllerScript)) {
            controllerScript = controllerScript.replace(
                initPattern,
                `$1${TW_INIT_CODE}`
            );
        }

        // 3. Add TW settings check in updateChart (after var settings = ...)
        const settingsPattern = /(var settings = self\.ctx\.settings \|\| \{\};)/;
        if (settingsPattern.test(controllerScript)) {
            controllerScript = controllerScript.replace(
                settingsPattern,
                `$1${TW_UPDATE_CHART_CODE}`
            );
        }

        // 4. Add TW functions before self.onResize
        const resizePattern = /(self\.onResize = function\(\))/;
        if (resizePattern.test(controllerScript)) {
            controllerScript = controllerScript.replace(
                resizePattern,
                `${TW_FUNCTIONS}\n\n$1`
            );
        }

        // Update the widget JSON
        widgetJson.descriptor.controllerScript = controllerScript;

        // Write back
        fs.writeFileSync(widgetPath, JSON.stringify(widgetJson, null, 2));
        console.log(`  - Successfully injected timewindow selector`);
        return true;

    } catch (error) {
        console.error(`  - Error: ${error.message}`);
        return false;
    }
}

// Main execution
const widgetsDir = path.join(__dirname, '..', 'widgets', 'types');

console.log('ECO Widget Timewindow Selector Injector\n');
console.log('This script adds timewindow selector functionality to ECO widgets.\n');

let successCount = 0;
let skipCount = 0;
let errorCount = 0;

WIDGETS_TO_UPDATE.forEach(widgetName => {
    const widgetPath = path.join(widgetsDir, `${widgetName}.json`);

    if (!fs.existsSync(widgetPath)) {
        console.log(`Widget not found: ${widgetName}`);
        errorCount++;
        return;
    }

    const result = injectTwSelector(widgetPath);
    if (result === true) {
        successCount++;
    } else if (result === false) {
        skipCount++;
    } else {
        errorCount++;
    }
});

console.log(`\nComplete: ${successCount} updated, ${skipCount} skipped, ${errorCount} errors`);
console.log('\nRun "node sync/sync.js sync" to push changes to ThingsBoard.');
