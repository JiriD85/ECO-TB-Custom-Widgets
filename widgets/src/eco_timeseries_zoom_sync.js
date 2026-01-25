/**
 * ECO Timeseries Zoom Sync Widget
 *
 * Time series visualization with configurable chart types, multi-series support,
 * dual Y-axes, statistics cards, and timewindow selector.
 */

var chart = null;
var chartContainer = null;
var statsCardContainers = {};
var timewindowContainer = null;
var resizeObserver = null;

// Timewindow Selector State
var twState = {
    mode: 'custom',      // 'day', 'week', 'month', 'custom'
    currentDate: new Date(),
    customStart: null,   // User-selected start (via datepicker)
    customEnd: null      // User-selected end (via datepicker)
};

// ========================================
// Initialization
// ========================================
self.onInit = function() {
    chartContainer = self.ctx.$container.find('#chart-container')[0];
    timewindowContainer = self.ctx.$container.find('#timewindow-selector')[0];
    statsCardContainers = {
        top: self.ctx.$container.find('#stats-card-top')[0],
        bottom: self.ctx.$container.find('#stats-card-bottom')[0],
        left: self.ctx.$container.find('#stats-card-left')[0],
        right: self.ctx.$container.find('#stats-card-right')[0]
    };

    if (!chartContainer) {
        console.error('ECO Timeseries: Chart container not found');
        return;
    }

    if (typeof echarts === 'undefined') {
        console.error('ECO Timeseries: ECharts not loaded');
        return;
    }

    chart = echarts.init(chartContainer);

    // Initialize timewindow selector
    initTimewindowSelector();

    updateChart();

    // Resize handling
    [100, 250, 500, 1000].forEach(function(delay) {
        setTimeout(function() {
            if (chart && chartContainer) {
                chart.resize({ width: chartContainer.offsetWidth, height: chartContainer.offsetHeight });
            }
        }, delay);
    });

    if (typeof ResizeObserver !== 'undefined') {
        resizeObserver = new ResizeObserver(function() {
            requestAnimationFrame(function() {
                if (chart && chartContainer) {
                    chart.resize({ width: chartContainer.offsetWidth, height: chartContainer.offsetHeight });
                }
            });
        });
        resizeObserver.observe(chartContainer);
    }
};

self.onDataUpdated = function() {
    updateChart();
};

self.onResize = function() {
    if (chart && chartContainer) {
        chart.resize({ width: chartContainer.offsetWidth, height: chartContainer.offsetHeight });
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

// ========================================
// Timewindow Selector
// ========================================
function initTimewindowSelector() {
    var settings = self.ctx.settings || {};

    // Set initial mode from settings
    twState.mode = settings.twSelectorDefaultMode || 'custom';
    twState.currentDate = new Date();

    // Apply initial timewindow based on settings
    if (settings.twCustomStartTime) {
        // If custom start time is configured, apply it on init
        applyTimewindow();
    }
}

function renderTimewindowSelector() {
    if (!timewindowContainer) return;

    var settings = self.ctx.settings || {};
    var showSelector = settings.showTimewindowSelector === true;

    if (!showSelector) {
        timewindowContainer.style.display = 'none';
        return;
    }

    // Clear container
    while (timewindowContainer.firstChild) {
        timewindowContainer.removeChild(timewindowContainer.firstChild);
    }

    // Determine accent color
    var accentColor = settings.twSelectorColor || '#2196F3';
    if (!settings.twSelectorColor && self.ctx.data && self.ctx.data[0] && self.ctx.data[0].dataKey) {
        accentColor = self.ctx.data[0].dataKey.color || '#2196F3';
    }

    // Position
    var positionMap = { left: 'flex-start', center: 'center', right: 'flex-end' };
    var position = settings.twSelectorPosition || 'center';

    timewindowContainer.style.display = 'flex';
    timewindowContainer.style.alignItems = 'center';
    timewindowContainer.style.justifyContent = positionMap[position] || 'center';
    timewindowContainer.style.padding = '8px';

    // Main wrapper
    var wrapper = document.createElement('div');
    wrapper.style.cssText = 'display: flex; align-items: center; gap: 6px; background: ' + accentColor + '; border-radius: 6px; padding: 6px 10px; box-shadow: 0 2px 6px rgba(0,0,0,0.12);';

    // Navigation buttons (only for D, W, M)
    if (twState.mode !== 'custom') {
        var navLeft = createButton('◀', function() { navigate(-1); });
        wrapper.appendChild(navLeft);
    }

    // Mode buttons
    var btnContainer = document.createElement('div');
    btnContainer.style.cssText = 'display: flex; gap: 4px;';

    var modes = [
        { id: 'day', label: 'D', title: 'Tag' },
        { id: 'week', label: 'W', title: 'Woche' },
        { id: 'month', label: 'M', title: 'Monat' },
        { id: 'custom', label: 'C', title: 'Custom' }
    ];

    modes.forEach(function(m) {
        var isActive = twState.mode === m.id;
        var btn = document.createElement('button');
        btn.textContent = m.label;
        btn.title = m.title;
        btn.style.cssText = 'border: none; width: 28px; height: 24px; border-radius: 4px; cursor: pointer; font-size: 11px; font-weight: 600; transition: all 0.2s;';

        if (isActive) {
            btn.style.background = 'white';
            btn.style.color = accentColor;
        } else {
            btn.style.background = 'rgba(255,255,255,0.2)';
            btn.style.color = 'white';
        }

        btn.onmouseover = function() {
            if (!isActive) btn.style.background = 'rgba(255,255,255,0.35)';
        };
        btn.onmouseout = function() {
            if (!isActive) btn.style.background = 'rgba(255,255,255,0.2)';
        };
        btn.onclick = function() { selectMode(m.id); };

        btnContainer.appendChild(btn);
    });

    wrapper.appendChild(btnContainer);

    // Navigation buttons (only for D, W, M)
    if (twState.mode !== 'custom') {
        var navRight = createButton('▶', function() { navigate(1); });
        wrapper.appendChild(navRight);
    }

    // Label
    var label = document.createElement('span');
    label.style.cssText = 'color: white; font-size: 11px; margin-left: 8px; opacity: 0.9;';
    label.textContent = formatLabel();
    wrapper.appendChild(label);

    // Calendar button for custom mode
    if (twState.mode === 'custom') {
        var calBtn = createButton('📅', function(e) {
            e.stopPropagation();
            showDatePicker(wrapper, accentColor);
        });
        calBtn.title = 'Zeitraum wählen';
        calBtn.style.marginLeft = '4px';
        wrapper.appendChild(calBtn);
    }

    timewindowContainer.appendChild(wrapper);
}

function createButton(text, onClick) {
    var btn = document.createElement('button');
    btn.textContent = text;
    btn.style.cssText = 'background: rgba(255,255,255,0.2); border: none; color: white; width: 24px; height: 24px; border-radius: 4px; cursor: pointer; font-size: 10px; display: flex; align-items: center; justify-content: center; transition: background 0.2s;';
    btn.onmouseover = function() { btn.style.background = 'rgba(255,255,255,0.35)'; };
    btn.onmouseout = function() { btn.style.background = 'rgba(255,255,255,0.2)'; };
    btn.onclick = onClick;
    return btn;
}

function selectMode(mode) {
    twState.mode = mode;
    if (mode !== 'custom') {
        twState.currentDate = new Date();
        twState.customStart = null;
        twState.customEnd = null;
    }
    applyTimewindow();
    renderTimewindowSelector();
}

function navigate(direction) {
    var d = new Date(twState.currentDate);

    switch (twState.mode) {
        case 'day':
            d.setDate(d.getDate() + direction);
            break;
        case 'week':
            d.setDate(d.getDate() + (direction * 7));
            break;
        case 'month':
            d.setMonth(d.getMonth() + direction);
            break;
    }

    twState.currentDate = d;
    applyTimewindow();
    renderTimewindowSelector();
}

function applyTimewindow() {
    var range = calculateRange();
    if (!range) return;

    var settings = self.ctx.settings || {};

    var timewindow = {
        history: {
            fixedTimewindow: { startTimeMs: range.start, endTimeMs: range.end },
            historyType: 0
        },
        aggregation: {
            type: settings.twAggregationType || 'NONE',
            limit: settings.twMaxDataPoints || 100000
        }
    };

    var useDashboardTw = self.ctx.widget && self.ctx.widget.config ?
        self.ctx.widget.config.useDashboardTimewindow : true;

    if (useDashboardTw !== false) {
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

function calculateRange() {
    var settings = self.ctx.settings || {};
    var d = new Date(twState.currentDate);
    var start, end;

    switch (twState.mode) {
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

        case 'custom':
            // Priority: 1) User-selected via datepicker, 2) Settings, 3) Dashboard TW (no change)
            if (twState.customStart && twState.customEnd) {
                return { start: twState.customStart, end: twState.customEnd };
            }

            if (settings.twCustomStartTime) {
                var startMs = resolveTimeValue(settings.twCustomStartTime);
                var endMs = settings.twCustomEndTime ? resolveTimeValue(settings.twCustomEndTime) : Date.now();
                if (startMs) {
                    return { start: startMs, end: endMs || Date.now() };
                }
            }

            // No custom settings - don't change timewindow
            return null;
    }

    return { start: start.getTime(), end: end.getTime() };
}

function resolveTimeValue(valueStr) {
    if (!valueStr || valueStr === '') return null;

    // Check for ${attribute} pattern
    var varMatch = valueStr.match(/^\$\{(.+)\}$/);
    if (varMatch) {
        var attrName = varMatch[1];
        if (self.ctx.datasources && self.ctx.datasources[0]) {
            var ds = self.ctx.datasources[0];
            if (ds.entity && ds.entity.attributes && ds.entity.attributes[attrName] !== undefined) {
                return Number(ds.entity.attributes[attrName]);
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
        return null;
    }

    // Try as number (timestamp)
    var numVal = Number(valueStr);
    if (!isNaN(numVal) && numVal > 0) return numVal;

    // Try as date string
    var dateVal = Date.parse(valueStr);
    if (!isNaN(dateVal)) return dateVal;

    return null;
}

function formatLabel() {
    var settings = self.ctx.settings || {};
    var d = twState.currentDate;

    switch (twState.mode) {
        case 'day':
            return formatDate(d, settings.twSelectorDayFormat || 'DD.MM.YYYY');

        case 'week':
            var range = calculateRange();
            if (range) {
                var startD = new Date(range.start);
                var endD = new Date(range.end);
                var fmt = settings.twSelectorWeekFormat || 'DD.MM.YYYY - DD.MM.YYYY';
                if (fmt.indexOf(' - ') !== -1) {
                    var parts = fmt.split(' - ');
                    return formatDate(startD, parts[0]) + ' - ' + formatDate(endD, parts[1] || parts[0]);
                }
                return formatDate(startD, 'DD.MM.YYYY') + ' - ' + formatDate(endD, 'DD.MM.YYYY');
            }
            return '';

        case 'month':
            return formatDate(d, settings.twSelectorMonthFormat || 'MMMM YYYY');

        case 'custom':
            if (twState.customStart && twState.customEnd) {
                return formatDate(new Date(twState.customStart), 'DD.MM.YY') + ' - ' +
                       formatDate(new Date(twState.customEnd), 'DD.MM.YY');
            }
            if (self.ctx.dashboard && self.ctx.dashboard.dashboardTimewindow) {
                var tw = self.ctx.dashboard.dashboardTimewindow;
                if (tw.history && tw.history.fixedTimewindow) {
                    return formatDate(new Date(tw.history.fixedTimewindow.startTimeMs), 'DD.MM.YY') + ' - ' +
                           formatDate(new Date(tw.history.fixedTimewindow.endTimeMs), 'DD.MM.YY');
                }
            }
            return 'Dashboard';
    }
    return '';
}

function formatDate(date, format) {
    var monthsShort = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    var monthsFull = ['Januar', 'Februar', 'März', 'April', 'Mai', 'Juni', 'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'];
    var d = new Date(date);

    format = format || 'DD.MM.YYYY';

    return format
        .replace('YYYY', d.getFullYear())
        .replace('YY', String(d.getFullYear()).slice(-2))
        .replace('MMMM', monthsFull[d.getMonth()])
        .replace('MMM', monthsShort[d.getMonth()])
        .replace('MM', String(d.getMonth() + 1).padStart(2, '0'))
        .replace('DD', String(d.getDate()).padStart(2, '0'))
        .replace(/D(?!e)/g, String(d.getDate()));
}

function showDatePicker(anchor, accentColor) {
    // Remove existing picker
    var existing = document.getElementById('eco-tw-datepicker');
    if (existing) {
        existing.remove();
        return;
    }

    // Get current dates
    var startDate = new Date();
    var endDate = new Date();
    startDate.setDate(startDate.getDate() - 7);

    if (twState.customStart && twState.customEnd) {
        startDate = new Date(twState.customStart);
        endDate = new Date(twState.customEnd);
    } else if (self.ctx.dashboard && self.ctx.dashboard.dashboardTimewindow) {
        var tw = self.ctx.dashboard.dashboardTimewindow;
        if (tw.history && tw.history.fixedTimewindow) {
            startDate = new Date(tw.history.fixedTimewindow.startTimeMs);
            endDate = new Date(tw.history.fixedTimewindow.endTimeMs);
        }
    }

    function toInputDate(d) {
        return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
    }

    // Create picker
    var picker = document.createElement('div');
    picker.id = 'eco-tw-datepicker';
    picker.style.cssText = 'position: absolute; top: 100%; left: 50%; transform: translateX(-50%); margin-top: 4px; background: white; border-radius: 8px; padding: 12px; box-shadow: 0 4px 20px rgba(0,0,0,0.25); z-index: 10000; min-width: 280px;';

    // Title
    var title = document.createElement('div');
    title.style.cssText = 'font-size: 12px; font-weight: 600; color: #333; margin-bottom: 10px;';
    title.textContent = 'Zeitraum wählen';
    picker.appendChild(title);

    // Inputs row
    var inputsRow = document.createElement('div');
    inputsRow.style.cssText = 'display: flex; gap: 8px;';

    // Start
    var startDiv = document.createElement('div');
    startDiv.style.cssText = 'flex: 1;';
    var startLabel = document.createElement('label');
    startLabel.style.cssText = 'font-size: 10px; color: #666; display: block; margin-bottom: 2px;';
    startLabel.textContent = 'Von';
    var startInput = document.createElement('input');
    startInput.type = 'date';
    startInput.value = toInputDate(startDate);
    startInput.style.cssText = 'width: 100%; padding: 6px; border: 1px solid #ddd; border-radius: 4px; font-size: 12px; box-sizing: border-box;';
    startDiv.appendChild(startLabel);
    startDiv.appendChild(startInput);
    inputsRow.appendChild(startDiv);

    // End
    var endDiv = document.createElement('div');
    endDiv.style.cssText = 'flex: 1;';
    var endLabel = document.createElement('label');
    endLabel.style.cssText = 'font-size: 10px; color: #666; display: block; margin-bottom: 2px;';
    endLabel.textContent = 'Bis';
    var endInput = document.createElement('input');
    endInput.type = 'date';
    endInput.value = toInputDate(endDate);
    endInput.style.cssText = 'width: 100%; padding: 6px; border: 1px solid #ddd; border-radius: 4px; font-size: 12px; box-sizing: border-box;';
    endDiv.appendChild(endLabel);
    endDiv.appendChild(endInput);
    inputsRow.appendChild(endDiv);

    picker.appendChild(inputsRow);

    // Buttons
    var btnRow = document.createElement('div');
    btnRow.style.cssText = 'display: flex; gap: 6px; justify-content: flex-end; margin-top: 10px;';

    var cancelBtn = document.createElement('button');
    cancelBtn.textContent = 'Abbrechen';
    cancelBtn.style.cssText = 'padding: 6px 12px; border: 1px solid #ddd; background: white; border-radius: 4px; font-size: 11px; cursor: pointer;';
    cancelBtn.onclick = function(e) { e.stopPropagation(); picker.remove(); };

    var applyBtn = document.createElement('button');
    applyBtn.textContent = 'Anwenden';
    applyBtn.style.cssText = 'padding: 6px 12px; border: none; background: ' + accentColor + '; color: white; border-radius: 4px; font-size: 11px; cursor: pointer; font-weight: 500;';
    applyBtn.onclick = function(e) {
        e.stopPropagation();
        var newStart = new Date(startInput.value);
        var newEnd = new Date(endInput.value);
        newEnd.setHours(23, 59, 59, 999);

        twState.customStart = newStart.getTime();
        twState.customEnd = newEnd.getTime();

        applyTimewindow();
        picker.remove();
        renderTimewindowSelector();
    };

    btnRow.appendChild(cancelBtn);
    btnRow.appendChild(applyBtn);
    picker.appendChild(btnRow);

    anchor.style.position = 'relative';
    anchor.appendChild(picker);

    // Close on outside click
    setTimeout(function() {
        document.addEventListener('click', function closeHandler(e) {
            if (!picker.contains(e.target)) {
                picker.remove();
                document.removeEventListener('click', closeHandler);
            }
        });
    }, 100);
}

// ========================================
// Chart Update
// ========================================
function updateChart() {
    if (!chart) return;

    var settings = self.ctx.settings || {};
    var data = self.ctx.data || [];

    // Render timewindow selector
    renderTimewindowSelector();

    // Chart settings
    var chartType = settings.chartType || 'line';
    var smoothLine = settings.smoothLine !== false;
    var showDataZoomSlider = settings.showDataZoomSlider !== false;
    var showToolbox = settings.showToolbox !== false;
    var toolboxFeatures = settings.toolboxFeatures || ['saveAsImage', 'dataView', 'dataZoom', 'restore'];

    if (!data.length) {
        showNoData('No data available');
        return;
    }

    // Process series
    var seriesConfigs = [];
    var defaultColors = ['#2196F3', '#4CAF50', '#FF9800', '#E91E63', '#9C27B0', '#00BCD4'];

    for (var i = 0; i < data.length; i++) {
        var ds = data[i];
        if (!ds.data || !ds.data.length) continue;

        var dataKey = ds.dataKey || {};
        var label = dataKey.label || dataKey.name || 'Series ' + (i + 1);
        var color = dataKey.color || defaultColors[i % defaultColors.length];
        var units = dataKey.units || '';

        var seriesData = [];
        for (var j = 0; j < ds.data.length; j++) {
            var ts = ds.data[j][0];
            var val = ds.data[j][1];
            if (val !== null && !isNaN(val)) {
                seriesData.push([ts, val]);
            }
        }

        if (seriesData.length === 0) continue;

        seriesConfigs.push({
            label: label,
            color: color,
            units: units,
            data: seriesData
        });
    }

    if (seriesConfigs.length === 0) {
        showNoData('No valid data');
        return;
    }

    // Build option
    var series = seriesConfigs.map(function(sc) {
        var s = {
            name: sc.label,
            type: chartType === 'bar' ? 'bar' : 'line',
            data: sc.data,
            smooth: smoothLine && chartType === 'line',
            symbol: chartType === 'line' ? 'none' : undefined,
            lineStyle: { color: sc.color, width: 2 },
            itemStyle: { color: sc.color }
        };
        if (chartType === 'area') {
            s.areaStyle = { color: sc.color, opacity: 0.3 };
        }
        return s;
    });

    var legendData = seriesConfigs.map(function(s) { return s.label; });

    var option = {
        tooltip: {
            trigger: 'axis',
            formatter: function(params) {
                if (!params || !params.length) return '';
                var d = new Date(params[0].value[0]);
                var result = d.toLocaleString() + '<br/>';
                params.forEach(function(p) {
                    if (p.value && p.value[1] !== null) {
                        result += '<span style="display:inline-block;margin-right:4px;border-radius:10px;width:10px;height:10px;background-color:' + p.color + ';"></span>';
                        result += p.seriesName + ': ' + p.value[1].toFixed(2) + '<br/>';
                    }
                });
                return result;
            }
        },
        legend: { data: legendData, bottom: showDataZoomSlider ? 30 : 5 },
        grid: { left: 60, right: 20, top: 40, bottom: showDataZoomSlider ? 60 : 40 },
        xAxis: { type: 'time', axisLabel: { fontSize: 10 } },
        yAxis: { type: 'value', axisLabel: { fontSize: 10 } },
        dataZoom: showDataZoomSlider ? [
            { type: 'inside' },
            { type: 'slider', bottom: 5, height: 20 }
        ] : [{ type: 'inside' }],
        toolbox: showToolbox ? {
            show: true,
            right: 10,
            top: 5,
            feature: {
                saveAsImage: toolboxFeatures.indexOf('saveAsImage') !== -1 ? { show: true } : undefined,
                dataZoom: toolboxFeatures.indexOf('dataZoom') !== -1 ? { show: true } : undefined,
                restore: toolboxFeatures.indexOf('restore') !== -1 ? { show: true } : undefined
            }
        } : null,
        series: series
    };

    chart.setOption(option, true);

    // Resize
    setTimeout(function() {
        if (chart && chartContainer) {
            chart.resize({ width: chartContainer.offsetWidth, height: chartContainer.offsetHeight });
        }
    }, 100);
}

function showNoData(msg) {
    if (!chart) return;
    chart.setOption({
        title: { text: msg, left: 'center', top: 'middle', textStyle: { color: '#999', fontSize: 14 } }
    }, true);
}

self.typeParameters = function() {
    return {
        previewWidth: '100%',
        previewHeight: '100%',
        embedTitlePanel: false,
        hasDataExportAction: true
    };
};
