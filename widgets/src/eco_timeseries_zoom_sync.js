/**
 * ECO Timeseries Zoom Sync Widget
 *
 * Time series visualization with configurable display modes:
 * - Single Chart: All series overlaid in one chart
 * - Stacked Charts: Each series in its own chart (vertically stacked)
 *
 * Features: Multi-series support, dual Y-axes, statistics cards, timewindow selector
 */

var chart = null;
var chartContainer = null;
var statsCardContainers = {};
var timewindowContainer = null;
var resizeObserver = null;

// Timewindow Selector State
var twState = {
    mode: 'custom',
    currentDate: new Date(),
    customStart: null,
    customEnd: null
};

// Cached entity attributes
var entityAttributes = {};

// User language
var userLanguage = 'en';

// ========================================
// Utility Functions - Statistics
// ========================================
var statsUtils = {
    calculate: function(values) {
        if (!values || values.length === 0) {
            return { mean: 0, median: 0, min: 0, max: 0, sum: 0, count: 0, current: null };
        }
        var sorted = values.slice().sort(function(a, b) { return a - b; });
        var sum = 0;
        for (var i = 0; i < values.length; i++) sum += values[i];
        return {
            mean: sum / values.length,
            median: this.percentile(sorted, 50),
            min: sorted[0],
            max: sorted[sorted.length - 1],
            sum: sum,
            count: values.length,
            current: values[values.length - 1]
        };
    },
    percentile: function(sortedValues, p) {
        if (sortedValues.length === 0) return 0;
        if (sortedValues.length === 1) return sortedValues[0];
        var index = (p / 100) * (sortedValues.length - 1);
        var lower = Math.floor(index);
        var upper = Math.ceil(index);
        var weight = index - lower;
        if (upper >= sortedValues.length) return sortedValues[sortedValues.length - 1];
        return sortedValues[lower] * (1 - weight) + sortedValues[upper] * weight;
    },
    stdDev: function(values, mean) {
        if (values.length === 0) return 0;
        var sumSquares = 0;
        for (var i = 0; i < values.length; i++) sumSquares += Math.pow(values[i] - mean, 2);
        return Math.sqrt(sumSquares / values.length);
    }
};

// ========================================
// Utility Functions - Data Processing
// ========================================
var dataProcessingUtils = {
    removeOutliers: function(values, timestamps, options) {
        var method = (options && options.method) || 'iqr';
        var cleanValues = [];
        var cleanTimestamps = [];
        var removed = 0;

        if (method === 'manual') {
            var minVal = (options.minValue !== undefined && options.minValue !== null) ? options.minValue : -Infinity;
            var maxVal = (options.maxValue !== undefined && options.maxValue !== null) ? options.maxValue : Infinity;
            for (var i = 0; i < values.length; i++) {
                if (values[i] >= minVal && values[i] <= maxVal) {
                    cleanValues.push(values[i]);
                    cleanTimestamps.push(timestamps[i]);
                } else removed++;
            }
        } else if (method === 'zscore') {
            var threshold = (options && options.zscoreThreshold) || 3;
            var stats = statsUtils.calculate(values);
            var stdDev = statsUtils.stdDev(values, stats.mean);
            if (stdDev === 0) return { values: values, timestamps: timestamps, removed: 0 };
            for (var j = 0; j < values.length; j++) {
                var zscore = Math.abs((values[j] - stats.mean) / stdDev);
                if (zscore <= threshold) {
                    cleanValues.push(values[j]);
                    cleanTimestamps.push(timestamps[j]);
                } else removed++;
            }
        } else {
            var multiplier = (options && options.iqrMultiplier) || 1.5;
            var sorted = values.slice().sort(function(a, b) { return a - b; });
            var q1 = statsUtils.percentile(sorted, 25);
            var q3 = statsUtils.percentile(sorted, 75);
            var iqr = q3 - q1;
            var lowerFence, upperFence;
            if (iqr === 0) {
                var median = statsUtils.percentile(sorted, 50);
                var range = Math.abs(median) * 0.5;
                if (range === 0) range = 1;
                lowerFence = median - range;
                upperFence = median + range;
            } else {
                lowerFence = q1 - (multiplier * iqr);
                upperFence = q3 + (multiplier * iqr);
            }
            for (var k = 0; k < values.length; k++) {
                if (values[k] >= lowerFence && values[k] <= upperFence) {
                    cleanValues.push(values[k]);
                    cleanTimestamps.push(timestamps[k]);
                } else removed++;
            }
        }
        return { values: cleanValues, timestamps: cleanTimestamps, removed: removed };
    },
    movingAverage: function(values, windowSize) {
        var result = [];
        var halfWindow = Math.floor(windowSize / 2);
        for (var i = 0; i < values.length; i++) {
            var start = Math.max(0, i - halfWindow);
            var end = Math.min(values.length, i + halfWindow + 1);
            var sum = 0;
            for (var j = start; j < end; j++) sum += values[j];
            result.push(sum / (end - start));
        }
        return result;
    },
    getWindowSizeFromMinutes: function(timestamps, minutes) {
        if (timestamps.length < 2) return 1;
        var totalTimeMs = timestamps[timestamps.length - 1] - timestamps[0];
        var avgIntervalMs = totalTimeMs / (timestamps.length - 1);
        var windowMs = minutes * 60 * 1000;
        return Math.max(1, Math.round(windowMs / avgIntervalMs));
    }
};

// ========================================
// Utility Functions - Color
// ========================================
var colorUtils = {
    adjust: function(color, amount) {
        var usePound = false;
        if (color[0] === '#') { color = color.slice(1); usePound = true; }
        var num = parseInt(color, 16);
        var r = Math.min(255, Math.max(0, (num >> 16) + amount));
        var g = Math.min(255, Math.max(0, ((num >> 8) & 0x00FF) + amount));
        var b = Math.min(255, Math.max(0, (num & 0x0000FF) + amount));
        return (usePound ? '#' : '') + (0x1000000 + (r << 16) + (g << 8) + b).toString(16).slice(1);
    },
    getDefault: function(index) {
        var colors = ['#2196F3', '#4CAF50', '#FF9800', '#E91E63', '#9C27B0', '#00BCD4', '#795548', '#607D8B'];
        return colors[index % colors.length];
    }
};

// ========================================
// Utility Functions - Formatting
// ========================================
var formatUtils = {
    value: function(value, decimals) {
        if (value === null || value === undefined) return '-';
        if (decimals === undefined || decimals === null) {
            if (Math.abs(value) >= 1000) return value.toFixed(0);
            if (Math.abs(value) >= 100) return value.toFixed(1);
            return value.toFixed(2);
        }
        return value.toFixed(decimals);
    },
    timestamp: function(ts, format) {
        var d = new Date(ts);
        format = format || 'YYYY-MM-DD HH:mm:ss';
        return format
            .replace('YYYY', d.getFullYear())
            .replace('MM', String(d.getMonth() + 1).padStart(2, '0'))
            .replace('DD', String(d.getDate()).padStart(2, '0'))
            .replace('HH', String(d.getHours()).padStart(2, '0'))
            .replace('mm', String(d.getMinutes()).padStart(2, '0'))
            .replace('ss', String(d.getSeconds()).padStart(2, '0'));
    },
    date: function(date, format, lang) {
        lang = lang || userLanguage || 'en';
        var monthsShort = {
            en: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
            de: ['Jan', 'Feb', 'Mär', 'Apr', 'Mai', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dez']
        };
        var monthsFull = {
            en: ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'],
            de: ['Januar', 'Februar', 'März', 'April', 'Mai', 'Juni', 'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember']
        };
        var d = new Date(date);
        var shortMonths = monthsShort[lang] || monthsShort.en;
        var fullMonths = monthsFull[lang] || monthsFull.en;
        format = format || 'D MMM YYYY';
        var result = format
            .replace('YYYY', '{{YYYY}}').replace('YY', '{{YY}}')
            .replace('MMMM', '{{MMMM}}').replace('MMM', '{{MMM}}').replace('MM', '{{MM}}').replace('DD', '{{DD}}');
        result = result.replace(/D(?!D|\})/g, '{{D}}').replace(/M(?!M|\})/g, '{{M}}');
        return result
            .replace('{{YYYY}}', d.getFullYear())
            .replace('{{YY}}', String(d.getFullYear()).slice(-2))
            .replace('{{MMMM}}', fullMonths[d.getMonth()])
            .replace('{{MMM}}', shortMonths[d.getMonth()])
            .replace('{{MM}}', String(d.getMonth() + 1).padStart(2, '0'))
            .replace('{{M}}', String(d.getMonth() + 1))
            .replace('{{DD}}', String(d.getDate()).padStart(2, '0'))
            .replace('{{D}}', String(d.getDate()));
    }
};

// ========================================
// Translations
// ========================================
var translations = {
    en: { selectPeriod: 'Select Period', from: 'From', to: 'To', cancel: 'Cancel', apply: 'Apply', day: 'Day', week: 'Week', month: 'Month', custom: 'Custom' },
    de: { selectPeriod: 'Zeitraum wählen', from: 'Von', to: 'Bis', cancel: 'Abbrechen', apply: 'Anwenden', day: 'Tag', week: 'Woche', month: 'Monat', custom: 'Custom' }
};

function t(key) {
    var lang = userLanguage || 'en';
    var langStrings = translations[lang] || translations.en;
    return langStrings[key] || translations.en[key] || key;
}

// ========================================
// Language Detection
// ========================================
function detectUserLanguage() {
    try {
        if (self.ctx && self.ctx.$scope && self.ctx.$scope.$injector) {
            var translate = self.ctx.$scope.$injector.get('$translate');
            if (translate && translate.use) {
                var tbLang = translate.use();
                if (tbLang) { userLanguage = tbLang.substring(0, 2).toLowerCase(); return; }
            }
        }
    } catch (e) {}
    try {
        var tbSettings = localStorage.getItem('thingsboard');
        if (tbSettings) {
            var parsed = JSON.parse(tbSettings);
            if (parsed && parsed.language) { userLanguage = parsed.language.substring(0, 2).toLowerCase(); return; }
        }
    } catch (e) {}
    var browserLang = navigator.language || navigator.userLanguage || 'en';
    userLanguage = browserLang.substring(0, 2).toLowerCase();
}

// ========================================
// Stats Card Rendering
// ========================================
function renderStatsCard(config) {
    ['top', 'bottom', 'left', 'right'].forEach(function(pos) {
        var container = statsCardContainers[pos];
        if (container) {
            container.style.display = 'none';
            while (container.firstChild) container.removeChild(container.firstChild);
        }
    });

    var legendValues = config.legendValues || [];
    var legendStyle = config.legendStyle || 'classic';
    var showCard = config.showLegend && legendStyle === 'card' && config.allStats && config.allStats.length > 0;

    if (!showCard) return;

    var position = config.legendPosition || 'bottom';
    var align = config.legendAlign || 'center';
    var container = statsCardContainers[position];
    if (!container) return;

    var isVertical = (position === 'left' || position === 'right');
    var justifyMap = { left: 'flex-start', center: 'center', right: 'flex-end' };

    container.style.display = 'flex';
    container.style.flexWrap = 'wrap';
    container.style.gap = '8px';

    if (isVertical) {
        container.style.flexDirection = 'column';
        container.style.alignItems = justifyMap[align];
        container.style.justifyContent = 'flex-start';
    } else {
        container.style.flexDirection = 'row';
        container.style.justifyContent = justifyMap[align];
        container.style.alignItems = 'flex-start';
    }

    config.allStats.forEach(function(seriesInfo) {
        var card = createStatsCard(seriesInfo, config, isVertical);
        container.appendChild(card);
    });
}

function createStatsCard(seriesInfo, config, isVertical) {
    var stats = seriesInfo.stats;
    var unit = seriesInfo.units || '';
    var dec = seriesInfo.decimals !== undefined ? seriesInfo.decimals : 2;
    var seriesColor = seriesInfo.color || '#2196F3';
    var colorMode = config.legendCardColorMode || 'auto';
    var manualColor = config.legendCardColor || '#2196F3';
    var legendValues = config.legendValues || [];

    var bgColor = colorMode === 'manual' ? manualColor : seriesColor;
    var bgStyle;
    if (colorMode === 'gradient') {
        var gradientDir = isVertical ? '180deg' : '135deg';
        bgStyle = 'linear-gradient(' + gradientDir + ', ' + bgColor + ' 0%, ' + colorUtils.adjust(bgColor, -40) + ' 100%)';
    } else {
        bgStyle = bgColor;
    }

    var card = document.createElement('div');
    card.style.cssText = 'background: ' + bgStyle + '; border-radius: 6px; padding: ' + (isVertical ? '10px 8px' : '8px 12px') + '; color: white; box-shadow: 0 2px 6px rgba(0,0,0,0.12); width: fit-content;';

    var titleEl = document.createElement('div');
    titleEl.style.cssText = 'font-size: ' + (isVertical ? '11px' : '12px') + '; font-weight: 600; margin-bottom: 8px; opacity: 0.95;' + (isVertical ? ' text-align: center;' : '');
    titleEl.textContent = seriesInfo.label + (unit ? ' (' + unit + ')' : '');
    card.appendChild(titleEl);

    var statsRow = document.createElement('div');
    statsRow.style.cssText = 'display: flex; flex-wrap: wrap; gap: 6px;' + (isVertical ? ' flex-direction: column;' : '');

    var statDefs = {
        current: { label: 'Current', icon: '●', value: stats.current },
        min: { label: 'Min', icon: '↓', value: stats.min },
        max: { label: 'Max', icon: '↑', value: stats.max },
        mean: { label: 'Mean', icon: 'μ', value: stats.mean },
        median: { label: 'Median', icon: '~', value: stats.median },
        sum: { label: 'Sum', icon: 'Σ', value: stats.sum },
        count: { label: 'Count', icon: 'n', value: stats.count }
    };

    legendValues.forEach(function(val) {
        var def = statDefs[val];
        if (def && def.value !== undefined && def.value !== null) {
            var formattedVal = val === 'count' ? String(def.value) : formatUtils.value(def.value, dec);
            var statBox = document.createElement('div');
            statBox.style.cssText = 'background: rgba(255,255,255,0.18); border-radius: 4px; padding: ' + (isVertical ? '4px 6px' : '4px 8px') + ';' + (isVertical ? ' text-align: center;' : ' min-width: 60px;');
            var labelEl = document.createElement('div');
            labelEl.style.cssText = 'font-size: 9px; opacity: 0.85;';
            labelEl.textContent = def.icon + ' ' + def.label;
            statBox.appendChild(labelEl);
            var valueEl = document.createElement('div');
            valueEl.style.cssText = 'font-size: ' + (isVertical ? '12px' : '13px') + '; font-weight: 600;';
            valueEl.textContent = formattedVal;
            statBox.appendChild(valueEl);
            statsRow.appendChild(statBox);
        }
    });

    card.appendChild(statsRow);

    if (config.showTimestamp && stats.lastTimestamp) {
        var timestampEl = document.createElement('div');
        timestampEl.style.cssText = 'font-size: 9px; opacity: 0.7; margin-top: 6px;' + (isVertical ? ' text-align: center;' : '');
        timestampEl.textContent = formatUtils.timestamp(stats.lastTimestamp, config.timestampFormat);
        card.appendChild(timestampEl);
    }

    return card;
}

// ========================================
// Initialization
// ========================================
self.onInit = function() {
    detectUserLanguage();

    chartContainer = self.ctx.$container.find('#chart-container')[0];
    timewindowContainer = self.ctx.$container.find('#timewindow-selector')[0];
    statsCardContainers = {
        top: self.ctx.$container.find('#stats-card-top')[0],
        bottom: self.ctx.$container.find('#stats-card-bottom')[0],
        left: self.ctx.$container.find('#stats-card-left')[0],
        right: self.ctx.$container.find('#stats-card-right')[0]
    };

    if (!chartContainer) { console.error('ECO Timeseries: Chart container not found'); return; }
    if (typeof echarts === 'undefined') { console.error('ECO Timeseries: ECharts not loaded'); return; }

    chart = echarts.init(chartContainer);

    fetchEntityAttributes(function() {
        initTimewindowSelector();
        updateChart();
    });

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

self.onDataUpdated = function() { updateChart(); };

self.onResize = function() {
    if (chart && chartContainer) {
        chart.resize({ width: chartContainer.offsetWidth, height: chartContainer.offsetHeight });
    }
};

self.onDestroy = function() {
    if (resizeObserver) { resizeObserver.disconnect(); resizeObserver = null; }
    if (chart) { chart.dispose(); chart = null; }
};

// ========================================
// Entity Attributes
// ========================================
function fetchEntityAttributes(callback) {
    var settings = self.ctx.settings || {};
    var attributesToFetch = [];
    var settingsToCheck = [settings.twCustomStartTime, settings.twCustomEndTime];
    settingsToCheck.forEach(function(val) {
        if (val && typeof val === 'string') {
            var match = val.match(/^\$\{(.+)\}$/);
            if (match && attributesToFetch.indexOf(match[1]) === -1) attributesToFetch.push(match[1]);
        }
    });
    if (attributesToFetch.length === 0) { callback(); return; }
    if (!self.ctx.datasources || self.ctx.datasources.length === 0) { callback(); return; }
    var ds = self.ctx.datasources[0];
    if (!ds.entity || !ds.entity.id) { callback(); return; }
    var entityId = ds.entity.id.id;
    var entityType = ds.entity.id.entityType;
    var keysParam = attributesToFetch.join(',');
    var url = '/api/plugins/telemetry/' + entityType + '/' + entityId + '/values/attributes?keys=' + keysParam;
    if (self.ctx.http) {
        self.ctx.http.get(url).subscribe(
            function(response) {
                if (response && Array.isArray(response)) {
                    response.forEach(function(attr) { entityAttributes[attr.key] = attr.value; });
                }
                callback();
            },
            function(error) { console.warn('ECO Timeseries: Failed to fetch attributes', error); callback(); }
        );
    } else { callback(); }
}

// ========================================
// Timewindow Selector
// ========================================
function initTimewindowSelector() {
    var settings = self.ctx.settings || {};
    twState.mode = settings.twSelectorDefaultMode || 'custom';
    twState.currentDate = new Date();
    if (settings.twCustomStartTime) applyTimewindow();
}

function renderTimewindowSelector() {
    if (!timewindowContainer) return;
    var settings = self.ctx.settings || {};
    var showSelector = settings.showTimewindowSelector === true;

    if (!showSelector) { timewindowContainer.style.display = 'none'; return; }

    while (timewindowContainer.firstChild) timewindowContainer.removeChild(timewindowContainer.firstChild);

    var accentColor = settings.twSelectorColor || '#2196F3';
    if (!settings.twSelectorColor && self.ctx.data && self.ctx.data[0] && self.ctx.data[0].dataKey) {
        accentColor = self.ctx.data[0].dataKey.color || '#2196F3';
    }

    var positionMap = { left: 'flex-start', center: 'center', right: 'flex-end' };
    var position = settings.twSelectorPosition || 'center';

    timewindowContainer.style.display = 'flex';
    timewindowContainer.style.alignItems = 'center';
    timewindowContainer.style.justifyContent = positionMap[position] || 'center';
    timewindowContainer.style.padding = '8px';

    var wrapper = document.createElement('div');
    wrapper.style.cssText = 'display: flex; align-items: center; gap: 6px; background: ' + accentColor + '; border-radius: 6px; padding: 6px 10px; box-shadow: 0 2px 6px rgba(0,0,0,0.12);';

    if (twState.mode !== 'custom') {
        var navLeft = createButton('◀', function() { navigate(-1); });
        wrapper.appendChild(navLeft);
    }

    var btnContainer = document.createElement('div');
    btnContainer.style.cssText = 'display: flex; gap: 4px;';

    var modes = [
        { id: 'day', label: 'D', title: t('day') },
        { id: 'week', label: 'W', title: t('week') },
        { id: 'month', label: 'M', title: t('month') },
        { id: 'custom', label: 'C', title: t('custom') }
    ];

    modes.forEach(function(m) {
        var isActive = twState.mode === m.id;
        var btn = document.createElement('button');
        btn.textContent = m.label;
        btn.title = m.title;
        btn.style.cssText = 'border: none; width: 28px; height: 24px; border-radius: 4px; cursor: pointer; font-size: 11px; font-weight: 600; transition: all 0.2s;';
        if (isActive) { btn.style.background = 'white'; btn.style.color = accentColor; }
        else { btn.style.background = 'rgba(255,255,255,0.2)'; btn.style.color = 'white'; }
        btn.onmouseover = function() { if (!isActive) btn.style.background = 'rgba(255,255,255,0.35)'; };
        btn.onmouseout = function() { if (!isActive) btn.style.background = 'rgba(255,255,255,0.2)'; };
        btn.onclick = function() { selectMode(m.id); };
        btnContainer.appendChild(btn);
    });

    wrapper.appendChild(btnContainer);

    if (twState.mode !== 'custom') {
        var navRight = createButton('▶', function() { navigate(1); });
        wrapper.appendChild(navRight);
    }

    var label = document.createElement('span');
    label.style.cssText = 'color: white; font-size: 11px; margin-left: 8px; opacity: 0.9;';
    label.textContent = formatLabel();
    wrapper.appendChild(label);

    if (twState.mode === 'custom') {
        var calBtn = createButton('📅', function(e) { e.stopPropagation(); showDatePicker(wrapper, accentColor); });
        calBtn.title = t('selectPeriod');
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
    if (mode !== 'custom') { twState.currentDate = new Date(); twState.customStart = null; twState.customEnd = null; }
    applyTimewindow();
    renderTimewindowSelector();
}

function navigate(direction) {
    var d = new Date(twState.currentDate);
    switch (twState.mode) {
        case 'day': d.setDate(d.getDate() + direction); break;
        case 'week': d.setDate(d.getDate() + (direction * 7)); break;
        case 'month': d.setMonth(d.getMonth() + direction); break;
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
        history: { fixedTimewindow: { startTimeMs: range.start, endTimeMs: range.end }, historyType: 0 },
        aggregation: { type: settings.twAggregationType || 'NONE', limit: settings.twMaxDataPoints || 100000 }
    };
    var useDashboardTw = self.ctx.widget && self.ctx.widget.config ? self.ctx.widget.config.useDashboardTimewindow : true;
    if (useDashboardTw !== false) {
        if (self.ctx.dashboard && self.ctx.dashboard.updateDashboardTimewindow) self.ctx.dashboard.updateDashboardTimewindow(timewindow);
        else if (self.ctx.dashboard && self.ctx.dashboard.onUpdateTimewindow) self.ctx.dashboard.onUpdateTimewindow(range.start, range.end);
    } else {
        if (self.ctx.timewindowFunctions && self.ctx.timewindowFunctions.onUpdateTimewindow) self.ctx.timewindowFunctions.onUpdateTimewindow(range.start, range.end);
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
            if (twState.customStart && twState.customEnd) return { start: twState.customStart, end: twState.customEnd };
            if (settings.twCustomStartTime) {
                var startMs = resolveTimeValue(settings.twCustomStartTime);
                var endMs = settings.twCustomEndTime ? resolveTimeValue(settings.twCustomEndTime) : Date.now();
                if (startMs) return { start: startMs, end: endMs || Date.now() };
            }
            return null;
    }
    return { start: start.getTime(), end: end.getTime() };
}

function resolveTimeValue(valueStr) {
    if (!valueStr || valueStr === '') return null;
    var varMatch = valueStr.match(/^\$\{(.+)\}$/);
    if (varMatch) {
        var attrName = varMatch[1];
        if (entityAttributes[attrName] !== undefined) return Number(entityAttributes[attrName]);
        if (self.ctx.datasources && self.ctx.datasources[0]) {
            var ds = self.ctx.datasources[0];
            if (ds.entity && ds.entity.attributes && ds.entity.attributes[attrName] !== undefined) return Number(ds.entity.attributes[attrName]);
        }
        if (self.ctx.latestData) {
            for (var i = 0; i < self.ctx.latestData.length; i++) {
                var ld = self.ctx.latestData[i];
                if (ld.dataKey && ld.dataKey.name === attrName && ld.data && ld.data.length > 0) return Number(ld.data[ld.data.length - 1][1]);
            }
        }
        return null;
    }
    var numVal = Number(valueStr);
    if (!isNaN(numVal) && numVal > 0) return numVal;
    var dateVal = Date.parse(valueStr);
    if (!isNaN(dateVal)) return dateVal;
    return null;
}

function formatLabel() {
    var settings = self.ctx.settings || {};
    var d = twState.currentDate;
    switch (twState.mode) {
        case 'day': return formatUtils.date(d, settings.twSelectorDayFormat || 'DD.MM.YYYY');
        case 'week':
            var range = calculateRange();
            if (range) {
                var startD = new Date(range.start);
                var endD = new Date(range.end);
                var fmt = settings.twSelectorWeekFormat || 'DD.MM.YYYY - DD.MM.YYYY';
                if (fmt.indexOf(' - ') !== -1) {
                    var parts = fmt.split(' - ');
                    return formatUtils.date(startD, parts[0]) + ' - ' + formatUtils.date(endD, parts[1] || parts[0]);
                }
                return formatUtils.date(startD, 'DD.MM.YYYY') + ' - ' + formatUtils.date(endD, 'DD.MM.YYYY');
            }
            return '';
        case 'month': return formatUtils.date(d, settings.twSelectorMonthFormat || 'MMMM YYYY');
        case 'custom':
            if (twState.customStart && twState.customEnd) {
                return formatUtils.date(new Date(twState.customStart), 'DD.MM.YY') + ' - ' + formatUtils.date(new Date(twState.customEnd), 'DD.MM.YY');
            }
            if (self.ctx.dashboard && self.ctx.dashboard.dashboardTimewindow) {
                var tw = self.ctx.dashboard.dashboardTimewindow;
                if (tw.history && tw.history.fixedTimewindow) {
                    return formatUtils.date(new Date(tw.history.fixedTimewindow.startTimeMs), 'DD.MM.YY') + ' - ' + formatUtils.date(new Date(tw.history.fixedTimewindow.endTimeMs), 'DD.MM.YY');
                }
            }
            return 'Dashboard';
    }
    return '';
}

function showDatePicker(anchor, accentColor) {
    var existing = document.getElementById('eco-tw-datepicker');
    if (existing) { existing.remove(); return; }

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

    var picker = document.createElement('div');
    picker.id = 'eco-tw-datepicker';
    picker.style.cssText = 'position: absolute; top: 100%; left: 50%; transform: translateX(-50%); margin-top: 4px; background: white; border-radius: 8px; padding: 12px; box-shadow: 0 4px 20px rgba(0,0,0,0.25); z-index: 10000; min-width: 280px;';

    var title = document.createElement('div');
    title.style.cssText = 'font-size: 12px; font-weight: 600; color: #333; margin-bottom: 10px;';
    title.textContent = t('selectPeriod');
    picker.appendChild(title);

    var inputsRow = document.createElement('div');
    inputsRow.style.cssText = 'display: flex; gap: 8px;';

    var startDiv = document.createElement('div');
    startDiv.style.cssText = 'flex: 1;';
    var startLabel = document.createElement('label');
    startLabel.style.cssText = 'font-size: 10px; color: #666; display: block; margin-bottom: 2px;';
    startLabel.textContent = t('from');
    var startInput = document.createElement('input');
    startInput.type = 'date';
    startInput.value = toInputDate(startDate);
    startInput.style.cssText = 'width: 100%; padding: 6px; border: 1px solid #ddd; border-radius: 4px; font-size: 12px; box-sizing: border-box;';
    startDiv.appendChild(startLabel);
    startDiv.appendChild(startInput);
    inputsRow.appendChild(startDiv);

    var endDiv = document.createElement('div');
    endDiv.style.cssText = 'flex: 1;';
    var endLabel = document.createElement('label');
    endLabel.style.cssText = 'font-size: 10px; color: #666; display: block; margin-bottom: 2px;';
    endLabel.textContent = t('to');
    var endInput = document.createElement('input');
    endInput.type = 'date';
    endInput.value = toInputDate(endDate);
    endInput.style.cssText = 'width: 100%; padding: 6px; border: 1px solid #ddd; border-radius: 4px; font-size: 12px; box-sizing: border-box;';
    endDiv.appendChild(endLabel);
    endDiv.appendChild(endInput);
    inputsRow.appendChild(endDiv);

    picker.appendChild(inputsRow);

    var btnRow = document.createElement('div');
    btnRow.style.cssText = 'display: flex; gap: 6px; justify-content: flex-end; margin-top: 10px;';

    var cancelBtn = document.createElement('button');
    cancelBtn.textContent = t('cancel');
    cancelBtn.style.cssText = 'padding: 6px 12px; border: 1px solid #ddd; background: white; border-radius: 4px; font-size: 11px; cursor: pointer;';
    cancelBtn.onclick = function(e) { e.stopPropagation(); picker.remove(); };

    var applyBtn = document.createElement('button');
    applyBtn.textContent = t('apply');
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

    setTimeout(function() {
        document.addEventListener('click', function closeHandler(e) {
            if (!picker.contains(e.target)) { picker.remove(); document.removeEventListener('click', closeHandler); }
        });
    }, 100);
}

// ========================================
// Chart Update - Main Function
// ========================================
function updateChart() {
    if (!chart) return;

    var settings = self.ctx.settings || {};
    var data = self.ctx.data || [];

    renderTimewindowSelector();

    // Display settings
    var displayMode = settings.displayMode || 'stacked'; // 'single' or 'stacked'
    var chartType = settings.chartType || 'line';
    var smoothLine = settings.smoothLine !== false;
    var showDataZoomSlider = settings.showDataZoomSlider !== false;
    var showToolbox = settings.showToolbox !== false;
    var toolboxFeatures = settings.toolboxFeatures || ['saveAsImage', 'dataView', 'dataZoom', 'restore'];
    var lineWidth = settings.lineWidth || 2;
    var showArea = settings.showArea === true;
    var areaOpacity = settings.areaOpacity || 0.3;

    // Data processing
    var removeOutliers = settings.removeOutliers === true;
    var outlierMethod = settings.outlierMethod || 'iqr';
    var smoothingEnabled = settings.smoothingEnabled === true;
    var smoothingWindowMinutes = settings.smoothingWindowMinutes || 15;

    if (!data.length) { showNoData('No data available'); return; }

    // Process all series
    var seriesConfigs = [];
    var allStatsForCard = [];
    var defaultColors = ['#2196F3', '#4CAF50', '#FF9800', '#E91E63', '#9C27B0', '#00BCD4', '#795548', '#607D8B'];

    for (var i = 0; i < data.length; i++) {
        var ds = data[i];
        if (!ds.data || !ds.data.length) continue;

        var dataKey = ds.dataKey || {};
        var label = dataKey.label || dataKey.name || 'Series ' + (i + 1);
        var color = dataKey.color || defaultColors[i % defaultColors.length];
        var units = dataKey.units || '';
        var decimals = dataKey.decimals !== undefined ? dataKey.decimals : 2;

        var timestamps = [];
        var values = [];
        for (var j = 0; j < ds.data.length; j++) {
            var ts = ds.data[j][0];
            var val = ds.data[j][1];
            if (val !== null && !isNaN(val)) {
                timestamps.push(ts);
                values.push(val);
            }
        }

        if (values.length === 0) continue;

        // Apply data processing
        if (removeOutliers) {
            var outlierResult = dataProcessingUtils.removeOutliers(values, timestamps, {
                method: outlierMethod,
                iqrMultiplier: settings.outlierIqrMultiplier || 1.5,
                zscoreThreshold: settings.outlierZscoreThreshold || 3,
                minValue: settings.outlierMinValue,
                maxValue: settings.outlierMaxValue
            });
            values = outlierResult.values;
            timestamps = outlierResult.timestamps;
        }

        if (smoothingEnabled && values.length > 1) {
            var windowSize = dataProcessingUtils.getWindowSizeFromMinutes(timestamps, smoothingWindowMinutes);
            values = dataProcessingUtils.movingAverage(values, windowSize);
        }

        var seriesData = [];
        for (var k = 0; k < values.length; k++) {
            seriesData.push([timestamps[k], values[k]]);
        }

        var stats = statsUtils.calculate(values);
        stats.lastTimestamp = timestamps.length > 0 ? timestamps[timestamps.length - 1] : null;

        // Get chart assignments and Y-axis settings from data key settings
        var chartAssignments = (dataKey.settings && dataKey.settings.chartAssignments) || [];
        var yAxisIndex = (dataKey.settings && dataKey.settings.yAxisIndex) || 0;

        seriesConfigs.push({
            label: label,
            color: color,
            units: units,
            decimals: decimals,
            data: seriesData,
            stats: stats,
            chartAssignments: chartAssignments,
            yAxisIndex: yAxisIndex
        });

        allStatsForCard.push({
            label: label,
            color: color,
            units: units,
            decimals: decimals,
            stats: stats
        });
    }

    if (seriesConfigs.length === 0) { showNoData('No valid data'); return; }

    // Render stats card
    renderStatsCard({
        showLegend: settings.showLegend,
        legendStyle: settings.legendStyle,
        legendPosition: settings.legendPosition,
        legendAlign: settings.legendAlign,
        legendCardColorMode: settings.legendCardColorMode,
        legendCardColor: settings.legendCardColor,
        legendValues: settings.legendValues,
        showTimestamp: settings.showTimestamp,
        timestampFormat: settings.timestampFormat,
        allStats: allStatsForCard
    });

    // Build ECharts option based on display mode
    var option;
    if (displayMode === 'stacked' && seriesConfigs.length > 1) {
        option = buildStackedOption(seriesConfigs, settings, chartType, smoothLine, showDataZoomSlider, showToolbox, toolboxFeatures, lineWidth, showArea, areaOpacity);
    } else {
        option = buildSingleOption(seriesConfigs, settings, chartType, smoothLine, showDataZoomSlider, showToolbox, toolboxFeatures, lineWidth, showArea, areaOpacity);
    }

    chart.setOption(option, true);

    setTimeout(function() {
        if (chart && chartContainer) {
            chart.resize({ width: chartContainer.offsetWidth, height: chartContainer.offsetHeight });
        }
    }, 100);
}

// ========================================
// Single Chart Mode
// ========================================
function buildSingleOption(seriesConfigs, settings, chartType, smoothLine, showDataZoomSlider, showToolbox, toolboxFeatures, lineWidth, showArea, areaOpacity) {
    var series = seriesConfigs.map(function(sc) {
        var s = {
            name: sc.label,
            type: chartType === 'bar' ? 'bar' : 'line',
            data: sc.data,
            smooth: smoothLine && chartType !== 'bar',
            symbol: 'none',
            lineStyle: { color: sc.color, width: lineWidth },
            itemStyle: { color: sc.color }
        };
        if (showArea || chartType === 'area') {
            s.areaStyle = { color: sc.color, opacity: areaOpacity };
        }
        return s;
    });

    var legendData = seriesConfigs.map(function(s) { return s.label; });
    var showClassicLegend = settings.showLegend && settings.legendStyle !== 'card';

    return {
        tooltip: {
            trigger: 'axis',
            formatter: function(params) {
                if (!params || !params.length) return '';
                var d = new Date(params[0].value[0]);
                var result = d.toLocaleString() + '<br/>';
                params.forEach(function(p) {
                    if (p.value && p.value[1] !== null) {
                        var sc = seriesConfigs.find(function(s) { return s.label === p.seriesName; });
                        var dec = sc ? sc.decimals : 2;
                        var unit = sc ? sc.units : '';
                        result += '<span style="display:inline-block;margin-right:4px;border-radius:10px;width:10px;height:10px;background-color:' + p.color + ';"></span>';
                        result += p.seriesName + ': ' + formatUtils.value(p.value[1], dec) + (unit ? ' ' + unit : '') + '<br/>';
                    }
                });
                return result;
            }
        },
        legend: showClassicLegend ? { data: legendData, bottom: showDataZoomSlider ? 30 : 5 } : { show: false },
        grid: { left: 60, right: 20, top: 40, bottom: showDataZoomSlider ? 60 : 40 },
        xAxis: { type: 'time', axisLabel: { fontSize: 10 } },
        yAxis: { type: 'value', axisLabel: { fontSize: 10 } },
        dataZoom: showDataZoomSlider ? [{ type: 'inside' }, { type: 'slider', bottom: 5, height: 20 }] : [{ type: 'inside' }],
        toolbox: showToolbox ? {
            show: true, right: 10, top: 5,
            feature: {
                saveAsImage: toolboxFeatures.indexOf('saveAsImage') !== -1 ? { show: true } : undefined,
                dataZoom: toolboxFeatures.indexOf('dataZoom') !== -1 ? { show: true } : undefined,
                restore: toolboxFeatures.indexOf('restore') !== -1 ? { show: true } : undefined
            }
        } : null,
        series: series
    };
}

// ========================================
// Stacked Charts Mode (Multi-Grid) - New Chart-Centric Configuration
// ========================================
function buildStackedOption(seriesConfigs, settings, chartType, smoothLine, showDataZoomSlider, showToolbox, toolboxFeatures, lineWidth, showArea, areaOpacity) {
    var charts = settings.charts || [];
    var chartSpacing = settings.chartSpacing !== undefined ? settings.chartSpacing : 2;
    var topMargin = settings.chartTopMargin !== undefined ? settings.chartTopMargin : 5;
    var sliderAreaPercent = showDataZoomSlider ? 8 : 0;
    var chartGap = settings.chartBottomMargin !== undefined ? settings.chartBottomMargin : 3;
    var bottomMargin = chartGap + sliderAreaPercent;

    // If no charts defined, fall back to auto-mode (one chart per series)
    if (charts.length === 0) {
        return buildAutoStackedOption(seriesConfigs, settings, chartType, smoothLine, showDataZoomSlider, showToolbox, toolboxFeatures, lineWidth, showArea, areaOpacity);
    }

    // Build chart data structure
    var chartDataList = [];

    charts.forEach(function(chartConfig, chartIndex) {
        var chartNum = chartIndex + 1; // 1-based chart number

        // Find series assigned to this chart
        var assignedSeries = seriesConfigs.filter(function(sc) {
            var assignments = sc.chartAssignments || [];
            return assignments.indexOf(chartNum) !== -1;
        });

        if (assignedSeries.length === 0) return; // Skip empty charts

        // Build Y-axes configuration for this chart
        var yAxesConfig = [];

        // Y-Axis 1 (always exists)
        yAxesConfig.push({
            position: 'left',
            label: chartConfig.yAxis1Label || '',
            unit: chartConfig.yAxis1Unit || '',
            min: chartConfig.yAxis1Min,
            max: chartConfig.yAxis1Max,
            series: []
        });

        // Y-Axis 2-4 (optional)
        if (chartConfig.yAxis2Enabled) {
            yAxesConfig.push({
                position: 'right',
                label: chartConfig.yAxis2Label || '',
                unit: chartConfig.yAxis2Unit || '',
                min: chartConfig.yAxis2Min,
                max: chartConfig.yAxis2Max,
                series: []
            });
        }
        if (chartConfig.yAxis3Enabled) {
            yAxesConfig.push({
                position: 'left',
                offset: 60,
                label: chartConfig.yAxis3Label || '',
                unit: chartConfig.yAxis3Unit || '',
                min: chartConfig.yAxis3Min,
                max: chartConfig.yAxis3Max,
                series: []
            });
        }
        if (chartConfig.yAxis4Enabled) {
            yAxesConfig.push({
                position: 'right',
                offset: 60,
                label: chartConfig.yAxis4Label || '',
                unit: chartConfig.yAxis4Unit || '',
                min: chartConfig.yAxis4Min,
                max: chartConfig.yAxis4Max,
                series: []
            });
        }

        // Assign series to Y-axes (auto or manual)
        assignedSeries.forEach(function(sc) {
            var yAxisIdx = sc.yAxisIndex || 0; // 0 = auto

            if (yAxisIdx === 0) {
                // Auto-assign based on unit matching
                yAxisIdx = autoAssignYAxis(sc, yAxesConfig);
            } else {
                // Manual assignment (1-based to 0-based)
                yAxisIdx = Math.min(yAxisIdx - 1, yAxesConfig.length - 1);
            }

            yAxesConfig[yAxisIdx].series.push(sc);
        });

        chartDataList.push({
            config: chartConfig,
            yAxes: yAxesConfig,
            heightPercent: chartConfig.heightPercent || null
        });
    });

    if (chartDataList.length === 0) {
        return buildAutoStackedOption(seriesConfigs, settings, chartType, smoothLine, showDataZoomSlider, showToolbox, toolboxFeatures, lineWidth, showArea, areaOpacity);
    }

    var numCharts = chartDataList.length;

    // Calculate chart heights
    var totalHeightPercent = 100 - topMargin - bottomMargin - (chartSpacing * (numCharts - 1));
    var totalCustomHeight = 0;
    var chartsWithCustomHeight = 0;

    chartDataList.forEach(function(cd) {
        if (cd.heightPercent && cd.heightPercent > 0) {
            totalCustomHeight += cd.heightPercent;
            chartsWithCustomHeight++;
        }
    });

    var remainingHeight = totalHeightPercent - totalCustomHeight;
    var defaultHeight = (numCharts - chartsWithCustomHeight) > 0
        ? remainingHeight / (numCharts - chartsWithCustomHeight)
        : totalHeightPercent / numCharts;

    // Build ECharts option
    var grids = [];
    var xAxes = [];
    var yAxes = [];
    var series = [];
    var titles = [];
    var currentTop = topMargin;
    var yAxisCounter = 0;

    chartDataList.forEach(function(chartData, gridIndex) {
        var config = chartData.config;
        var chartHeight = chartData.heightPercent || defaultHeight;
        var thisChartType = config.chartType || chartType;
        var chartTitle = config.title || '';

        // Count Y-axes with data for this chart
        var yAxesWithData = chartData.yAxes.filter(function(ya) { return ya.series.length > 0; });
        var hasRightAxis = yAxesWithData.some(function(ya) { return ya.position === 'right'; });

        // Add title
        if (chartTitle) {
            titles.push({
                text: chartTitle,
                left: 65,
                top: currentTop + '%',
                textStyle: { fontSize: 11, fontWeight: 'normal', color: '#666' }
            });
        }

        // Grid - adjust for multiple Y-axes
        var gridLeft = 60 + (yAxesWithData.filter(function(ya) { return ya.position === 'left' && ya.offset; }).length * 50);
        var gridRight = 20 + (hasRightAxis ? 40 : 0) + (yAxesWithData.filter(function(ya) { return ya.position === 'right' && ya.offset; }).length * 50);

        grids.push({
            left: gridLeft,
            right: gridRight,
            top: (currentTop + (chartTitle ? 2.5 : 0)) + '%',
            height: (chartHeight - (chartTitle ? 2.5 : 0)) + '%'
        });

        // X-Axis
        xAxes.push({
            type: 'time',
            gridIndex: gridIndex,
            axisLabel: { show: gridIndex === numCharts - 1, fontSize: 10 },
            axisTick: { show: gridIndex === numCharts - 1 },
            axisLine: { show: true },
            splitLine: { show: false }
        });

        // Y-Axes for this chart
        var chartYAxisStartIndex = yAxisCounter;

        yAxesWithData.forEach(function(yAxisConfig, localYAxisIndex) {
            var axisName = yAxisConfig.label || (yAxisConfig.series.length > 0
                ? yAxisConfig.series.map(function(s) { return s.label; }).join(', ')
                : '');
            if (axisName.length > 25) axisName = axisName.substring(0, 22) + '...';

            var yAxis = {
                type: 'value',
                gridIndex: gridIndex,
                position: yAxisConfig.position,
                name: axisName + (yAxisConfig.unit ? ' (' + yAxisConfig.unit + ')' : ''),
                nameLocation: 'middle',
                nameGap: 40,
                nameTextStyle: { fontSize: 9, color: yAxisConfig.series[0] ? yAxisConfig.series[0].color : '#666' },
                axisLabel: { fontSize: 9 },
                splitLine: { show: localYAxisIndex === 0, lineStyle: { type: 'dashed', opacity: 0.3 } }
            };

            if (yAxisConfig.offset) yAxis.offset = yAxisConfig.offset;
            if (yAxisConfig.min !== undefined && yAxisConfig.min !== null && yAxisConfig.min !== '') yAxis.min = yAxisConfig.min;
            if (yAxisConfig.max !== undefined && yAxisConfig.max !== null && yAxisConfig.max !== '') yAxis.max = yAxisConfig.max;

            yAxes.push(yAxis);

            // Add series for this Y-axis
            yAxisConfig.series.forEach(function(sc) {
                var seriesItem = {
                    name: sc.label,
                    type: thisChartType === 'bar' ? 'bar' : 'line',
                    xAxisIndex: gridIndex,
                    yAxisIndex: yAxisCounter,
                    data: sc.data,
                    smooth: smoothLine && thisChartType !== 'bar',
                    symbol: 'none',
                    lineStyle: { color: sc.color, width: lineWidth },
                    itemStyle: { color: sc.color }
                };

                if (showArea || thisChartType === 'area') {
                    seriesItem.areaStyle = { color: sc.color, opacity: areaOpacity };
                }

                series.push(seriesItem);
            });

            yAxisCounter++;
        });

        currentTop += chartHeight + chartSpacing;
    });

    // DataZoom
    var xAxisIndices = [];
    for (var j = 0; j < numCharts; j++) xAxisIndices.push(j);

    var dataZoom = [{ type: 'inside', xAxisIndex: xAxisIndices }];
    if (showDataZoomSlider) {
        dataZoom.push({ type: 'slider', xAxisIndex: xAxisIndices, bottom: 5, height: 18 });
    }

    var option = {
        tooltip: {
            trigger: 'axis',
            axisPointer: { type: 'line', link: { xAxisIndex: 'all' } },
            formatter: function(params) {
                if (!params || !params.length) return '';
                var d = new Date(params[0].value[0]);
                var result = d.toLocaleString() + '<br/>';
                params.forEach(function(p) {
                    if (p.value && p.value[1] !== null) {
                        var sc = seriesConfigs.find(function(s) { return s.label === p.seriesName; });
                        var dec = sc ? sc.decimals : 2;
                        var unit = sc ? sc.units : '';
                        result += '<span style="display:inline-block;margin-right:4px;border-radius:10px;width:10px;height:10px;background-color:' + p.color + ';"></span>';
                        result += p.seriesName + ': ' + formatUtils.value(p.value[1], dec) + (unit ? ' ' + unit : '') + '<br/>';
                    }
                });
                return result;
            }
        },
        axisPointer: { link: { xAxisIndex: 'all' } },
        grid: grids,
        xAxis: xAxes,
        yAxis: yAxes,
        dataZoom: dataZoom,
        toolbox: showToolbox ? {
            show: true, right: 10, top: 5,
            feature: {
                saveAsImage: toolboxFeatures.indexOf('saveAsImage') !== -1 ? { show: true } : undefined,
                dataZoom: toolboxFeatures.indexOf('dataZoom') !== -1 ? { show: true } : undefined,
                restore: toolboxFeatures.indexOf('restore') !== -1 ? { show: true } : undefined
            }
        } : null,
        series: series
    };

    if (titles.length > 0) option.title = titles;

    return option;
}

// Auto-assign Y-axis based on unit matching
function autoAssignYAxis(seriesConfig, yAxesConfig) {
    var seriesUnit = (seriesConfig.units || '').toLowerCase().trim();

    // Try to find matching unit
    for (var i = 0; i < yAxesConfig.length; i++) {
        var axisUnit = (yAxesConfig[i].unit || '').toLowerCase().trim();
        if (axisUnit && seriesUnit && axisUnit === seriesUnit) {
            return i;
        }
    }

    // No match - find first axis with matching unit from already assigned series
    for (var j = 0; j < yAxesConfig.length; j++) {
        var existingSeries = yAxesConfig[j].series;
        for (var k = 0; k < existingSeries.length; k++) {
            var existingUnit = (existingSeries[k].units || '').toLowerCase().trim();
            if (existingUnit && seriesUnit && existingUnit === seriesUnit) {
                return j;
            }
        }
    }

    // Still no match - find first empty axis or first axis
    for (var m = 0; m < yAxesConfig.length; m++) {
        if (yAxesConfig[m].series.length === 0) {
            return m;
        }
    }

    return 0; // Default to first axis
}

// Fallback: Auto-stacked mode (one chart per series, like old behavior)
function buildAutoStackedOption(seriesConfigs, settings, chartType, smoothLine, showDataZoomSlider, showToolbox, toolboxFeatures, lineWidth, showArea, areaOpacity) {
    var chartSpacing = settings.chartSpacing !== undefined ? settings.chartSpacing : 2;
    var topMargin = settings.chartTopMargin !== undefined ? settings.chartTopMargin : 5;
    var sliderAreaPercent = showDataZoomSlider ? 8 : 0;
    var chartGap = settings.chartBottomMargin !== undefined ? settings.chartBottomMargin : 3;
    var bottomMargin = chartGap + sliderAreaPercent;

    var numCharts = seriesConfigs.length;
    if (numCharts === 0) return buildSingleOption(seriesConfigs, settings, chartType, smoothLine, showDataZoomSlider, showToolbox, toolboxFeatures, lineWidth, showArea, areaOpacity);

    var totalHeightPercent = 100 - topMargin - bottomMargin - (chartSpacing * (numCharts - 1));
    var chartHeight = totalHeightPercent / numCharts;

    var grids = [];
    var xAxes = [];
    var yAxes = [];
    var series = [];
    var currentTop = topMargin;

    seriesConfigs.forEach(function(sc, i) {
        grids.push({
            left: 60, right: 20,
            top: currentTop + '%',
            height: chartHeight + '%'
        });

        xAxes.push({
            type: 'time', gridIndex: i,
            axisLabel: { show: i === numCharts - 1, fontSize: 10 },
            axisTick: { show: i === numCharts - 1 },
            axisLine: { show: true },
            splitLine: { show: false }
        });

        yAxes.push({
            type: 'value', gridIndex: i,
            name: sc.label + (sc.units ? ' (' + sc.units + ')' : ''),
            nameLocation: 'middle', nameGap: 45,
            nameTextStyle: { fontSize: 9, color: sc.color },
            axisLabel: { fontSize: 9 },
            splitLine: { lineStyle: { type: 'dashed', opacity: 0.3 } }
        });

        var seriesItem = {
            name: sc.label,
            type: chartType === 'bar' ? 'bar' : 'line',
            xAxisIndex: i, yAxisIndex: i,
            data: sc.data,
            smooth: smoothLine && chartType !== 'bar',
            symbol: 'none',
            lineStyle: { color: sc.color, width: lineWidth },
            itemStyle: { color: sc.color }
        };

        if (showArea || chartType === 'area') {
            seriesItem.areaStyle = { color: sc.color, opacity: areaOpacity };
        }

        series.push(seriesItem);
        currentTop += chartHeight + chartSpacing;
    });

    var xAxisIndices = [];
    for (var j = 0; j < numCharts; j++) xAxisIndices.push(j);

    var dataZoom = [{ type: 'inside', xAxisIndex: xAxisIndices }];
    if (showDataZoomSlider) {
        dataZoom.push({ type: 'slider', xAxisIndex: xAxisIndices, bottom: 5, height: 18 });
    }

    return {
        tooltip: {
            trigger: 'axis',
            axisPointer: { type: 'line', link: { xAxisIndex: 'all' } },
            formatter: function(params) {
                if (!params || !params.length) return '';
                var d = new Date(params[0].value[0]);
                var result = d.toLocaleString() + '<br/>';
                params.forEach(function(p) {
                    if (p.value && p.value[1] !== null) {
                        var sc = seriesConfigs.find(function(s) { return s.label === p.seriesName; });
                        var dec = sc ? sc.decimals : 2;
                        var unit = sc ? sc.units : '';
                        result += '<span style="display:inline-block;margin-right:4px;border-radius:10px;width:10px;height:10px;background-color:' + p.color + ';"></span>';
                        result += p.seriesName + ': ' + formatUtils.value(p.value[1], dec) + (unit ? ' ' + unit : '') + '<br/>';
                    }
                });
                return result;
            }
        },
        axisPointer: { link: { xAxisIndex: 'all' } },
        grid: grids,
        xAxis: xAxes,
        yAxis: yAxes,
        dataZoom: dataZoom,
        toolbox: showToolbox ? {
            show: true, right: 10, top: 5,
            feature: {
                saveAsImage: toolboxFeatures.indexOf('saveAsImage') !== -1 ? { show: true } : undefined,
                dataZoom: toolboxFeatures.indexOf('dataZoom') !== -1 ? { show: true } : undefined,
                restore: toolboxFeatures.indexOf('restore') !== -1 ? { show: true } : undefined
            }
        } : null,
        series: series
    };
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
        hasDataExportAction: true,
        maxDatasources: -1,
        maxDataKeys: -1,
        dataKeysOptional: true,
        datasourcesOptional: false,
        hasAdditionalLatestDataKeys: true,
        singleEntity: false,
        defaultDataKeysFunction: function() { return []; },
        defaultLatestDataKeysFunction: function() { return []; }
    };
};
