/**
 * ECO Timeseries Zoom Sync Widget
 *
 * Time series visualization with configurable chart types, multi-series support,
 * dual Y-axes, statistics cards, and internal zoom (no dashboard sync).
 * Reference implementation for ECO Custom Widgets.
 */

var chart = null;
var chartContainer = null;
var statsCardContainers = {};
var timewindowSelectorContainer = null;
var resizeObserver = null;

// Timewindow selector state
var twState = {
    mode: 'day',  // 'day', 'week', 'month', 'custom'
    currentDate: new Date()  // Reference date for navigation
};

// Cached settings for timewindow selector
var twSettings = {};

self.onInit = function() {
    chartContainer = self.ctx.$container.find('#chart-container')[0];
    timewindowSelectorContainer = self.ctx.$container.find('#timewindow-selector')[0];
    statsCardContainers = {
        top: self.ctx.$container.find('#stats-card-top')[0],
        bottom: self.ctx.$container.find('#stats-card-bottom')[0],
        left: self.ctx.$container.find('#stats-card-left')[0],
        right: self.ctx.$container.find('#stats-card-right')[0]
    };

    if (!chartContainer) {
        console.error('ECO Timeseries Zoom Sync: Chart container not found');
        return;
    }

    if (typeof echarts === 'undefined') {
        console.error('ECO Timeseries Zoom Sync: ECharts library not loaded');
        return;
    }

    chart = echarts.init(chartContainer);
    updateChart();

    // Multiple delayed resizes to handle ThingsBoard's async layout
    // Container size may not be final until layout completes
    // Use inline code to avoid any closure/scoping issues
    [100, 250, 500, 1000].forEach(function(delay) {
        setTimeout(function() {
            if (chart && chartContainer) {
                var w = chartContainer.offsetWidth;
                var h = chartContainer.offsetHeight;
                chart.resize({ width: w, height: h });
            }
        }, delay);
    });

    // ResizeObserver for dynamic container size changes
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

self.onDataUpdated = function() {
    updateChart();
};

function updateChart() {
    if (!chart) return;

    var settings = self.ctx.settings || {};
    var data = self.ctx.data || [];

    // Chart type settings
    var chartType = settings.chartType || 'line';
    var smoothLine = settings.smoothLine !== false;
    var chartLayout = settings.chartLayout || 'combined'; // 'combined' or 'separate'

    // Legend settings
    var showLegend = settings.showLegend !== false;
    var legendStyle = settings.legendStyle || 'classic';
    var legendPosition = settings.legendPosition || 'bottom';
    var legendAlign = settings.legendAlign || 'center';
    var legendCardColorMode = settings.legendCardColorMode || 'auto';
    var legendCardColor = settings.legendCardColor || '#2196F3';
    var legendValues = settings.legendValues || ['current'];

    // Timestamp settings
    var showTimestamp = settings.showTimestamp !== false;
    var timestampFormat = settings.timestampFormat || 'YYYY-MM-DD HH:mm:ss';

    // DataZoom settings
    var showDataZoomSlider = settings.showDataZoomSlider !== false;

    // Y-Axis settings
    var yAxisMin = settings.yAxisMin;
    var yAxisMax = settings.yAxisMax;
    var yAxis2Min = settings.yAxis2Min;
    var yAxis2Max = settings.yAxis2Max;

    // Outlier removal settings
    var removeOutliers = settings.removeOutliers === true;
    var outlierMethod = settings.outlierMethod || 'iqr';
    var outlierIqrMultiplier = settings.outlierIqrMultiplier || 1.5;
    var outlierZscoreThreshold = settings.outlierZscoreThreshold || 3;
    var outlierMinValue = settings.outlierMinValue;
    var outlierMaxValue = settings.outlierMaxValue;

    // Smoothing settings
    var smoothingEnabled = settings.smoothingEnabled === true;
    var smoothingWindowMinutes = settings.smoothingWindowMinutes || 15;

    // Toolbox settings
    var showToolbox = settings.showToolbox !== false;
    var toolboxFeatures = settings.toolboxFeatures || ['saveAsImage', 'dataView', 'dataZoom', 'restore'];
    var showSaveAsImage = toolboxFeatures.indexOf('saveAsImage') !== -1;
    var showDataView = toolboxFeatures.indexOf('dataView') !== -1;
    var showDataZoom = toolboxFeatures.indexOf('dataZoom') !== -1;
    var showRestore = toolboxFeatures.indexOf('restore') !== -1;

    // Timewindow selector settings
    var showTimewindowSelector = settings.showTimewindowSelector === true;

    // Cache timewindow selector settings for use in render function
    twSettings = {
        color: settings.twSelectorColor || '',  // Empty = auto (use series color)
        position: settings.twSelectorPosition || 'center',
        dayFormat: settings.twSelectorDayFormat || 'D MMM YYYY',
        weekFormat: settings.twSelectorWeekFormat || 'D-D MMM',
        monthFormat: settings.twSelectorMonthFormat || 'MMM YYYY',
        customStartTime: settings.twCustomStartTime || '',
        customEndTime: settings.twCustomEndTime || '',
        aggregationType: settings.twAggregationType || 'NONE',
        maxDataPoints: settings.twMaxDataPoints || 100000
    };

    // Render timewindow selector if enabled and widget uses timewindow
    if (showTimewindowSelector && self.ctx.dashboard) {
        renderTimewindowSelector();
    } else if (timewindowSelectorContainer) {
        timewindowSelectorContainer.style.display = 'none';
    }

    // Check for valid data
    if (!data.length) {
        showNoData('No data available');
        return;
    }

    // Process all datasources and group by datasource config index
    var seriesConfigs = [];
    var allStats = [];
    var hasSecondAxis = false;
    var datasourceGroups = {}; // Group series by datasource config for separate layout
    var datasourceOrder = []; // Track order of datasources

    // Get datasource configurations from widget context
    var datasourceConfigs = self.ctx.datasources || [];

    // Build a lookup: for each datasource config, track which dataKey names belong to it
    // This allows us to match data entries to their datasource config
    var dataKeyToDsIndex = {};
    var dsIndexCounter = 0;
    for (var di = 0; di < datasourceConfigs.length; di++) {
        var cfg = datasourceConfigs[di];
        var cfgDataKeys = cfg.dataKeys || [];
        for (var dki = 0; dki < cfgDataKeys.length; dki++) {
            // Create a unique key combining datasource index and dataKey name
            // This handles the case where same dataKey name exists in multiple datasources
            var keyId = di + '_' + (cfgDataKeys[dki].name || dki);
            dataKeyToDsIndex[keyId] = di;
        }
    }

    // Track which data entry index belongs to which datasource
    var dataIndexToDsIndex = {};
    var currentDsIndex = 0;
    var currentKeyIndex = 0;
    for (var i = 0; i < data.length; i++) {
        // In ThingsBoard, data entries are ordered by datasource, then by dataKey
        // So we can track which datasource we're in by counting dataKeys
        if (currentDsIndex < datasourceConfigs.length) {
            var currentDsConfig = datasourceConfigs[currentDsIndex];
            var numKeysInCurrentDs = (currentDsConfig.dataKeys || []).length;

            if (currentKeyIndex >= numKeysInCurrentDs) {
                currentDsIndex++;
                currentKeyIndex = 0;
            }
        }
        dataIndexToDsIndex[i] = currentDsIndex < datasourceConfigs.length ? currentDsIndex : i;
        currentKeyIndex++;
    }

    for (var i = 0; i < data.length; i++) {
        var ds = data[i];
        if (!ds.data || !ds.data.length) continue;

        var dataKey = ds.dataKey || {};
        var datasource = ds.datasource || {};

        // Get datasource index from our pre-built mapping
        var dsIndex = dataIndexToDsIndex[i] !== undefined ? dataIndexToDsIndex[i] : i;

        var dsId = 'ds_' + dsIndex;
        var dsName = datasource.entityName || datasource.name || datasource.entityLabel || ('Datasource ' + (dsIndex + 1));

        // Series identification
        var label = dataKey.label || dataKey.name || 'Series ' + (i + 1);
        var units = dataKey.units || '';
        var decimals = dataKey.decimals !== undefined ? dataKey.decimals : 2;
        var color = dataKey.color || getDefaultColor(i);

        // Determine Y-axis assignment (auto-detect based on units)
        var yAxisIndex = 0;
        if (i > 0 && seriesConfigs.length > 0) {
            var firstUnits = seriesConfigs[0].units;
            if (units && firstUnits && units !== firstUnits) {
                yAxisIndex = 1;
                hasSecondAxis = true;
            }
        }

        // Extract values and timestamps
        var rawValues = [];
        var timestamps = [];

        for (var j = 0; j < ds.data.length; j++) {
            var ts = ds.data[j][0];
            var val = ds.data[j][1];
            if (val !== null && !isNaN(val)) {
                timestamps.push(ts);
                rawValues.push(val);
            }
        }

        if (rawValues.length === 0) continue;

        var values = rawValues.slice();

        // Remove outliers if enabled
        if (removeOutliers) {
            var outlierResult = removeOutliersFromData(values, timestamps, {
                method: outlierMethod,
                iqrMultiplier: outlierIqrMultiplier,
                zscoreThreshold: outlierZscoreThreshold,
                minValue: outlierMinValue,
                maxValue: outlierMaxValue
            });
            values = outlierResult.values;
            timestamps = outlierResult.timestamps;

            if (values.length === 0) continue;
        }

        // Apply smoothing if enabled
        if (smoothingEnabled && smoothingWindowMinutes > 0 && timestamps.length > 1) {
            // Calculate average time interval between data points
            var totalTimeMs = timestamps[timestamps.length - 1] - timestamps[0];
            var avgIntervalMs = totalTimeMs / (timestamps.length - 1);
            // Convert window from minutes to data points
            var windowMs = smoothingWindowMinutes * 60 * 1000;
            var windowSize = Math.max(1, Math.round(windowMs / avgIntervalMs));
            values = movingAverage(values, windowSize);
        }

        // Build series data from processed values
        var seriesData = [];
        var lastTimestamp = null;
        var lastValue = null;
        for (var k = 0; k < values.length; k++) {
            seriesData.push([timestamps[k], values[k]]);
            lastTimestamp = timestamps[k];
            lastValue = values[k];
        }

        // Calculate statistics for this series
        var stats = calculateStatistics(values);
        stats.current = lastValue;
        stats.lastTimestamp = lastTimestamp;

        var seriesConfig = {
            label: label,
            units: units,
            decimals: decimals,
            color: color,
            data: seriesData,
            stats: stats,
            yAxisIndex: yAxisIndex,
            datasourceId: dsId,
            datasourceName: dsName
        };

        seriesConfigs.push(seriesConfig);

        // Group by datasource for separate layout
        if (!datasourceGroups[dsId]) {
            datasourceGroups[dsId] = {
                name: dsName,
                series: []
            };
            datasourceOrder.push(dsId);
        }
        datasourceGroups[dsId].series.push(seriesConfig);

        allStats.push({
            label: label,
            units: units,
            decimals: decimals,
            color: color,
            stats: stats
        });
    }

    if (seriesConfigs.length === 0) {
        showNoData('No valid data points');
        return;
    }

    // Build ECharts option
    var option = buildChartOption({
        chartType: chartType,
        smoothLine: smoothLine,
        chartLayout: chartLayout,
        seriesConfigs: seriesConfigs,
        datasourceGroups: datasourceGroups,
        datasourceOrder: datasourceOrder,
        hasSecondAxis: hasSecondAxis,
        showLegend: showLegend,
        legendStyle: legendStyle,
        legendPosition: legendPosition,
        showDataZoomSlider: showDataZoomSlider,
        yAxisMin: yAxisMin,
        yAxisMax: yAxisMax,
        yAxis2Min: yAxis2Min,
        yAxis2Max: yAxis2Max,
        showToolbox: showToolbox,
        showSaveAsImage: showSaveAsImage,
        showDataView: showDataView,
        showDataZoom: showDataZoom,
        showRestore: showRestore
    });

    chart.setOption(option, true);

    // Render statistics cards (DOM-based)
    renderStatsCard({
        showLegend: showLegend,
        legendStyle: legendStyle,
        legendAlign: legendAlign,
        legendCardColorMode: legendCardColorMode,
        legendCardColor: legendCardColor,
        legendValues: legendValues,
        legendPosition: legendPosition,
        showTimestamp: showTimestamp,
        timestampFormat: timestampFormat,
        allStats: allStats
    });

    // Resize chart after stats cards are rendered to fix container height
    // Use multiple strategies to ensure resize happens after layout is complete
    function doResize() {
        if (chart && chartContainer) {
            chart.resize({
                width: chartContainer.offsetWidth,
                height: chartContainer.offsetHeight
            });
        }
    }

    // Strategy 1: requestAnimationFrame for next paint
    requestAnimationFrame(function() {
        requestAnimationFrame(doResize);
    });

    // Strategy 2: setTimeout fallbacks at different intervals
    setTimeout(doResize, 100);
    setTimeout(doResize, 250);
}

function renderStatsCard(config) {
    // Clear all containers first
    ['top', 'bottom', 'left', 'right'].forEach(function(pos) {
        var container = statsCardContainers[pos];
        if (container) {
            container.style.display = 'none';
            while (container.firstChild) {
                container.removeChild(container.firstChild);
            }
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

    // Set container to flex for alignment
    var isVertical = (position === 'left' || position === 'right');
    var justifyMap = { left: 'flex-start', center: 'center', right: 'flex-end' };
    var alignMap = { left: 'flex-start', center: 'center', right: 'flex-end' };

    container.style.display = 'flex';
    container.style.flexWrap = 'wrap';
    container.style.gap = '8px';

    if (isVertical) {
        container.style.flexDirection = 'column';
        container.style.alignItems = alignMap[align];
        container.style.justifyContent = 'flex-start';
    } else {
        container.style.flexDirection = 'row';
        container.style.justifyContent = justifyMap[align];
        container.style.alignItems = 'flex-start';
    }

    // Create a card for each series
    config.allStats.forEach(function(seriesInfo) {
        var stats = seriesInfo.stats;
        var unit = seriesInfo.units || '';
        var dec = seriesInfo.decimals !== undefined ? seriesInfo.decimals : 2;
        var seriesColor = seriesInfo.color || '#2196F3';
        var colorMode = config.legendCardColorMode || 'auto';
        var manualColor = config.legendCardColor || '#2196F3';

        // Determine background color/style based on mode
        var bgColor = colorMode === 'manual' ? manualColor : seriesColor;
        var bgStyle;
        if (colorMode === 'gradient') {
            var gradientDir = isVertical ? '180deg' : '135deg';
            bgStyle = 'linear-gradient(' + gradientDir + ', ' + bgColor + ' 0%, ' + adjustColor(bgColor, -40) + ' 100%)';
        } else {
            bgStyle = bgColor;
        }

        // Build the statistics card using DOM methods
        var card = document.createElement('div');
        card.style.cssText = 'background: ' + bgStyle + '; border-radius: 6px; padding: ' + (isVertical ? '10px 8px' : '8px 12px') + '; color: white; box-shadow: 0 2px 6px rgba(0,0,0,0.12); width: fit-content;';

        // Title with series name
        var titleEl = document.createElement('div');
        titleEl.style.cssText = 'font-size: ' + (isVertical ? '11px' : '12px') + '; font-weight: 600; margin-bottom: 8px; opacity: 0.95;' + (isVertical ? ' text-align: center;' : '');
        titleEl.textContent = seriesInfo.label + (unit ? ' (' + unit + ')' : '');
        card.appendChild(titleEl);

        // Statistics row
        var statsRow = document.createElement('div');
        statsRow.style.cssText = 'display: flex; flex-wrap: wrap; gap: 6px;' + (isVertical ? ' flex-direction: column;' : '');

        legendValues.forEach(function(val) {
            var statValue, label, icon;
            switch(val) {
                case 'current': statValue = stats.current; label = 'Current'; icon = '\u25CF'; break;
                case 'min': statValue = stats.min; label = 'Min'; icon = '\u2193'; break;
                case 'max': statValue = stats.max; label = 'Max'; icon = '\u2191'; break;
                case 'mean': statValue = stats.mean; label = 'Mean'; icon = '\u03BC'; break;
                case 'median': statValue = stats.median; label = 'Median'; icon = '~'; break;
                case 'sum': statValue = stats.sum; label = 'Sum'; icon = '\u03A3'; break;
                case 'count': statValue = stats.count; label = 'Count'; icon = 'n'; break;
                default: return;
            }
            if (statValue !== undefined && statValue !== null) {
                var formattedVal = val === 'count' ? String(statValue) : formatValue(statValue, dec);

                var statBox = document.createElement('div');
                statBox.style.cssText = 'background: rgba(255,255,255,0.18); border-radius: 4px; padding: ' + (isVertical ? '4px 6px' : '4px 8px') + ';' + (isVertical ? ' text-align: center;' : ' min-width: 60px;');

                var labelEl = document.createElement('div');
                labelEl.style.cssText = 'font-size: 9px; opacity: 0.85;';
                labelEl.textContent = icon + ' ' + label;
                statBox.appendChild(labelEl);

                var valueEl = document.createElement('div');
                valueEl.style.cssText = 'font-size: ' + (isVertical ? '12px' : '13px') + '; font-weight: 600;';
                valueEl.textContent = formattedVal;
                statBox.appendChild(valueEl);

                statsRow.appendChild(statBox);
            }
        });

        card.appendChild(statsRow);

        // Timestamp display
        if (config.showTimestamp && stats.lastTimestamp) {
            var timestampEl = document.createElement('div');
            timestampEl.style.cssText = 'font-size: 9px; opacity: 0.7; margin-top: 6px;' + (isVertical ? ' text-align: center;' : '');
            timestampEl.textContent = formatTimestamp(stats.lastTimestamp, config.timestampFormat);
            card.appendChild(timestampEl);
        }

        container.appendChild(card);
    });
}

// Helper function to darken/lighten a hex color
function adjustColor(color, amount) {
    var usePound = false;
    if (color[0] === '#') {
        color = color.slice(1);
        usePound = true;
    }

    var num = parseInt(color, 16);
    var r = Math.min(255, Math.max(0, (num >> 16) + amount));
    var g = Math.min(255, Math.max(0, ((num >> 8) & 0x00FF) + amount));
    var b = Math.min(255, Math.max(0, (num & 0x0000FF) + amount));

    return (usePound ? '#' : '') + (g | (b << 8) | (r << 16)).toString(16).padStart(6, '0');
}

function calculateStatistics(values) {
    if (values.length === 0) {
        return { mean: 0, median: 0, min: 0, max: 0, sum: 0, count: 0 };
    }

    var sorted = values.slice().sort(function(a, b) { return a - b; });
    var sum = 0;
    for (var i = 0; i < values.length; i++) {
        sum += values[i];
    }

    return {
        mean: sum / values.length,
        median: percentile(sorted, 50),
        min: sorted[0],
        max: sorted[sorted.length - 1],
        sum: sum,
        count: values.length
    };
}

function percentile(sortedValues, p) {
    if (sortedValues.length === 0) return 0;
    if (sortedValues.length === 1) return sortedValues[0];

    var index = (p / 100) * (sortedValues.length - 1);
    var lower = Math.floor(index);
    var upper = Math.ceil(index);
    var weight = index - lower;

    if (upper >= sortedValues.length) return sortedValues[sortedValues.length - 1];
    return sortedValues[lower] * (1 - weight) + sortedValues[upper] * weight;
}

function removeOutliersFromData(values, timestamps, options) {
    var method = options.method || 'iqr';
    var cleanValues = [];
    var cleanTimestamps = [];
    var removed = 0;

    if (method === 'manual') {
        var minVal = options.minValue !== undefined && options.minValue !== null ? options.minValue : -Infinity;
        var maxVal = options.maxValue !== undefined && options.maxValue !== null ? options.maxValue : Infinity;

        for (var i = 0; i < values.length; i++) {
            if (values[i] >= minVal && values[i] <= maxVal) {
                cleanValues.push(values[i]);
                cleanTimestamps.push(timestamps[i]);
            } else {
                removed++;
            }
        }
    } else if (method === 'zscore') {
        var threshold = options.zscoreThreshold || 3;
        var stats = calculateStatistics(values);
        var stdDev = calculateStdDev(values, stats.mean);

        if (stdDev === 0) {
            return { values: values, timestamps: timestamps, removed: 0 };
        }

        for (var j = 0; j < values.length; j++) {
            var zscore = Math.abs((values[j] - stats.mean) / stdDev);
            if (zscore <= threshold) {
                cleanValues.push(values[j]);
                cleanTimestamps.push(timestamps[j]);
            } else {
                removed++;
            }
        }
    } else {
        // IQR method (default)
        var multiplier = options.iqrMultiplier || 1.5;
        var sorted = values.slice().sort(function(a, b) { return a - b; });
        var q1 = percentile(sorted, 25);
        var q3 = percentile(sorted, 75);
        var iqr = q3 - q1;

        if (iqr === 0) {
            var median = percentile(sorted, 50);
            var range = Math.abs(median) * 0.5;
            if (range === 0) range = 1;
            var lowerBound = median - range;
            var upperBound = median + range;

            for (var m = 0; m < values.length; m++) {
                if (values[m] >= lowerBound && values[m] <= upperBound) {
                    cleanValues.push(values[m]);
                    cleanTimestamps.push(timestamps[m]);
                } else {
                    removed++;
                }
            }
        } else {
            var lowerFence = q1 - (multiplier * iqr);
            var upperFence = q3 + (multiplier * iqr);

            for (var n = 0; n < values.length; n++) {
                if (values[n] >= lowerFence && values[n] <= upperFence) {
                    cleanValues.push(values[n]);
                    cleanTimestamps.push(timestamps[n]);
                } else {
                    removed++;
                }
            }
        }
    }

    return {
        values: cleanValues,
        timestamps: cleanTimestamps,
        removed: removed
    };
}

function calculateStdDev(values, mean) {
    if (values.length === 0) return 0;
    var sumSquares = 0;
    for (var i = 0; i < values.length; i++) {
        sumSquares += Math.pow(values[i] - mean, 2);
    }
    return Math.sqrt(sumSquares / values.length);
}

function movingAverage(values, windowSize) {
    var result = [];
    var halfWindow = Math.floor(windowSize / 2);

    for (var i = 0; i < values.length; i++) {
        var start = Math.max(0, i - halfWindow);
        var end = Math.min(values.length, i + halfWindow + 1);
        var sum = 0;
        for (var j = start; j < end; j++) {
            sum += values[j];
        }
        result.push(sum / (end - start));
    }
    return result;
}

function formatValue(value, decimals) {
    if (value === null || value === undefined) return '-';
    if (decimals === undefined || decimals === null) {
        if (Math.abs(value) >= 1000) {
            return value.toFixed(0);
        } else if (Math.abs(value) >= 100) {
            return value.toFixed(1);
        } else {
            return value.toFixed(2);
        }
    }
    return value.toFixed(decimals);
}

function formatTimestamp(ts, format) {
    var d = new Date(ts);
    var year = d.getFullYear();
    var month = String(d.getMonth() + 1).padStart(2, '0');
    var day = String(d.getDate()).padStart(2, '0');
    var hours = String(d.getHours()).padStart(2, '0');
    var minutes = String(d.getMinutes()).padStart(2, '0');
    var seconds = String(d.getSeconds()).padStart(2, '0');

    // Simple format replacement
    var result = format
        .replace('YYYY', year)
        .replace('MM', month)
        .replace('DD', day)
        .replace('HH', hours)
        .replace('mm', minutes)
        .replace('ss', seconds);

    return result;
}

// ========================================
// Timewindow Selector Functions
// ========================================

function renderTimewindowSelector() {
    if (!timewindowSelectorContainer) return;

    // Clear container
    while (timewindowSelectorContainer.firstChild) {
        timewindowSelectorContainer.removeChild(timewindowSelectorContainer.firstChild);
    }

    // Position mapping
    var positionMap = { left: 'flex-start', center: 'center', right: 'flex-end' };
    var position = twSettings.position || 'center';

    timewindowSelectorContainer.style.display = 'flex';
    timewindowSelectorContainer.style.alignItems = 'center';
    timewindowSelectorContainer.style.justifyContent = positionMap[position] || 'center';
    timewindowSelectorContainer.style.gap = '8px';
    timewindowSelectorContainer.style.padding = '8px';

    // Determine accent color: use custom color if set, otherwise series color
    var accentColor = '#2196F3';
    if (twSettings.color && twSettings.color !== '') {
        accentColor = twSettings.color;
    } else if (self.ctx.data && self.ctx.data[0] && self.ctx.data[0].dataKey && self.ctx.data[0].dataKey.color) {
        accentColor = self.ctx.data[0].dataKey.color;
    }

    // Create wrapper with card-like styling
    var wrapper = document.createElement('div');
    wrapper.style.cssText = 'display: flex; align-items: center; gap: 6px; background: ' + accentColor + '; border-radius: 6px; padding: 6px 10px; box-shadow: 0 2px 6px rgba(0,0,0,0.12);';

    // Check if custom mode is available (has start/end configured)
    var hasCustomRange = twSettings.customStartTime || twSettings.customEndTime;

    // Previous button (hide in custom mode)
    if (twState.mode !== 'custom') {
        var prevBtn = createNavButton('\u25C0', accentColor, function() {
            navigateTimewindow(-1);
        });
        wrapper.appendChild(prevBtn);
    }

    // Period buttons container
    var periodBtns = document.createElement('div');
    periodBtns.style.cssText = 'display: flex; gap: 4px;';

    // Standard period buttons
    ['day', 'week', 'month'].forEach(function(mode) {
        var btn = createPeriodButton(mode, accentColor);
        periodBtns.appendChild(btn);
    });

    // Custom button (only if custom range is configured)
    if (hasCustomRange) {
        var customBtn = createPeriodButton('custom', accentColor);
        periodBtns.appendChild(customBtn);
    }

    wrapper.appendChild(periodBtns);

    // Next button (hide in custom mode)
    if (twState.mode !== 'custom') {
        var nextBtn = createNavButton('\u25B6', accentColor, function() {
            navigateTimewindow(1);
        });
        wrapper.appendChild(nextBtn);
    }

    // Current period label
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

    btn.onmouseover = function() {
        if (twState.mode !== mode) {
            btn.style.background = 'rgba(255,255,255,0.35)';
        }
    };
    btn.onmouseout = function() {
        if (twState.mode !== mode) {
            btn.style.background = 'rgba(255,255,255,0.2)';
        }
    };

    btn.onclick = function() {
        selectPeriodMode(mode);
    };

    return btn;
}

function selectPeriodMode(mode) {
    twState.mode = mode;
    if (mode !== 'custom') {
        twState.currentDate = new Date(); // Reset to current date when switching mode
    }
    applyTimewindow();
    renderTimewindowSelector(); // Re-render to update button styles
}

function navigateTimewindow(direction) {
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

    // Build timewindow object with aggregation settings
    var timewindow = {
        history: {
            fixedTimewindow: {
                startTimeMs: range.start,
                endTimeMs: range.end
            },
            historyType: 0  // Fixed timewindow
        },
        aggregation: {
            type: twSettings.aggregationType || 'NONE',
            limit: twSettings.maxDataPoints || 100000
        }
    };

    // Check if widget uses its own timewindow or dashboard timewindow
    var useDashboardTimewindow = true;
    if (self.ctx.widgetConfig && self.ctx.widgetConfig.useDashboardTimewindow !== undefined) {
        useDashboardTimewindow = self.ctx.widgetConfig.useDashboardTimewindow;
    }

    if (useDashboardTimewindow) {
        // Update dashboard timewindow
        if (self.ctx.dashboard) {
            if (self.ctx.dashboard.updateDashboardTimewindow) {
                self.ctx.dashboard.updateDashboardTimewindow(timewindow);
            } else if (self.ctx.dashboard.onUpdateTimewindow) {
                self.ctx.dashboard.onUpdateTimewindow(range.start, range.end);
            }
        }
    } else {
        // Update widget's own timewindow
        if (self.ctx.timewindowFunctions && self.ctx.timewindowFunctions.onUpdateTimewindow) {
            self.ctx.timewindowFunctions.onUpdateTimewindow(timewindow);
        } else if (self.ctx.$scope && self.ctx.$scope.onUpdateTimewindow) {
            // Alternative API for widget timewindow
            self.ctx.$scope.onUpdateTimewindow(range.start, range.end);
        }
    }
}

function calculateCustomTimeRange() {
    var startStr = twSettings.customStartTime || '';
    var endStr = twSettings.customEndTime || '';

    // Resolve variables in start/end strings
    var startMs = resolveTimeValue(startStr);
    var endMs = resolveTimeValue(endStr);

    // Fallback to current day if values couldn't be resolved
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

    // Check if it's a variable placeholder like ${attributeName}
    var varMatch = valueStr.match(/^\$\{(.+)\}$/);
    if (varMatch) {
        var attrName = varMatch[1];
        return resolveEntityAttribute(attrName);
    }

    // Try to parse as number (milliseconds timestamp)
    var numVal = Number(valueStr);
    if (!isNaN(numVal) && numVal > 0) {
        return numVal;
    }

    // Try to parse as ISO date string
    var dateVal = Date.parse(valueStr);
    if (!isNaN(dateVal)) {
        return dateVal;
    }

    return null;
}

function resolveEntityAttribute(attrName) {
    // Try to get attribute from the first datasource entity
    if (self.ctx.datasources && self.ctx.datasources.length > 0) {
        var ds = self.ctx.datasources[0];

        // Check entity attributes if available
        if (ds.entity) {
            // Try server attributes
            if (ds.entity.attributes && ds.entity.attributes[attrName] !== undefined) {
                return Number(ds.entity.attributes[attrName]);
            }
            // Try shared attributes
            if (ds.entity.sharedAttributes && ds.entity.sharedAttributes[attrName] !== undefined) {
                return Number(ds.entity.sharedAttributes[attrName]);
            }
        }

        // Check latestData in context (for latest values)
        if (self.ctx.latestData) {
            for (var i = 0; i < self.ctx.latestData.length; i++) {
                var ld = self.ctx.latestData[i];
                if (ld.dataKey && ld.dataKey.name === attrName && ld.data && ld.data.length > 0) {
                    return Number(ld.data[ld.data.length - 1][1]);
                }
            }
        }
    }

    // Try dashboard state aliases or variables
    if (self.ctx.dashboard && self.ctx.dashboard.aliasController) {
        var aliasController = self.ctx.dashboard.aliasController;
        // This depends on ThingsBoard API - may need adjustment
    }

    return null;
}

function calculateTimeRange(mode, referenceDate) {
    var start, end;
    var d = new Date(referenceDate);

    switch (mode) {
        case 'day':
            // Start of day (00:00:00)
            start = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0);
            // End of day (23:59:59.999)
            end = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999);
            break;

        case 'week':
            // Find Monday of current week (week starts on Monday)
            var dayOfWeek = d.getDay();
            var diffToMonday = (dayOfWeek === 0 ? -6 : 1) - dayOfWeek;
            var monday = new Date(d);
            monday.setDate(d.getDate() + diffToMonday);
            start = new Date(monday.getFullYear(), monday.getMonth(), monday.getDate(), 0, 0, 0, 0);
            // Sunday end of week
            var sunday = new Date(monday);
            sunday.setDate(monday.getDate() + 6);
            end = new Date(sunday.getFullYear(), sunday.getMonth(), sunday.getDate(), 23, 59, 59, 999);
            break;

        case 'month':
            // Start of month
            start = new Date(d.getFullYear(), d.getMonth(), 1, 0, 0, 0, 0);
            // End of month
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
            // For week, format depends on whether months are same
            var weekFormat = twSettings.weekFormat || 'D-D MMM';
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

function showNoData(message) {
    if (!chart) return;
    chart.setOption({
        title: {
            text: message,
            left: 'center',
            top: 'middle',
            textStyle: { color: '#999', fontSize: 14 }
        }
    }, true);
}

function getDefaultColor(index) {
    var colors = ['#2196F3', '#4CAF50', '#FF9800', '#E91E63', '#9C27B0', '#00BCD4', '#795548', '#607D8B'];
    return colors[index % colors.length];
}

function buildChartOption(config) {
    var seriesConfigs = config.seriesConfigs;
    var chartType = config.chartType || 'line';
    var smoothLine = config.smoothLine !== false;
    var chartLayout = config.chartLayout || 'combined';

    // Build legend data
    var legendData = [];
    for (var i = 0; i < seriesConfigs.length; i++) {
        legendData.push(seriesConfigs[i].label);
    }

    // Calculate margins
    var legendStyle = config.legendStyle || 'classic';
    var legendPosition = config.legendPosition || 'bottom';
    var useStatsCard = legendStyle === 'card';
    var legendMargin = (config.showLegend && !useStatsCard) ? 35 : 0;

    var topMargin = 40;
    var bottomMargin = config.showDataZoomSlider ? 60 : 40;
    var leftMargin = 60;
    var rightMargin = 20;

    if (!useStatsCard) {
        if (legendPosition === 'top') topMargin += legendMargin;
        if (legendPosition === 'bottom') bottomMargin += legendMargin;
        if (legendPosition === 'left') leftMargin += legendMargin;
        if (legendPosition === 'right') rightMargin += legendMargin;
    }

    // Handle separate chart layout (per datasource)
    var datasourceOrder = config.datasourceOrder || [];
    var datasourceGroups = config.datasourceGroups || {};
    if (chartLayout === 'separate' && datasourceOrder.length > 1) {
        return buildSeparateChartsOption(config, {
            legendData: legendData,
            topMargin: topMargin,
            bottomMargin: bottomMargin,
            leftMargin: leftMargin,
            rightMargin: rightMargin,
            useStatsCard: useStatsCard,
            legendPosition: legendPosition
        });
    }

    // Combined chart layout (default)
    var series = [];
    for (var j = 0; j < seriesConfigs.length; j++) {
        var sc = seriesConfigs[j];
        var seriesConfig = {
            name: sc.label,
            type: chartType === 'scatter' ? 'scatter' : (chartType === 'bar' ? 'bar' : 'line'),
            data: sc.data,
            yAxisIndex: sc.yAxisIndex,
            smooth: smoothLine && chartType === 'line',
            symbol: chartType === 'line' ? 'none' : (chartType === 'scatter' ? 'circle' : undefined),
            symbolSize: chartType === 'scatter' ? 8 : undefined,
            lineStyle: { color: sc.color, width: 2 },
            itemStyle: { color: sc.color }
        };

        if (chartType === 'area') {
            seriesConfig.type = 'line';
            seriesConfig.areaStyle = { color: sc.color, opacity: 0.3 };
            seriesConfig.smooth = smoothLine;
            seriesConfig.symbol = 'none';
        }

        series.push(seriesConfig);
    }

    // Build Y-axes for combined mode - use label (units) format
    var firstAxisLabel = '';
    if (seriesConfigs[0]) {
        firstAxisLabel = seriesConfigs[0].label || '';
        if (seriesConfigs[0].units) {
            firstAxisLabel += ' (' + seriesConfigs[0].units + ')';
        }
    }
    var yAxes = [{
        type: 'value',
        name: firstAxisLabel,
        nameLocation: 'middle',
        nameGap: 45,
        min: config.yAxisMin,
        max: config.yAxisMax,
        axisLabel: { fontSize: 10 },
        splitLine: { lineStyle: { type: 'dashed', opacity: 0.3 } }
    }];

    if (config.hasSecondAxis) {
        var secondAxisLabel = '';
        for (var k = 0; k < seriesConfigs.length; k++) {
            if (seriesConfigs[k].yAxisIndex === 1) {
                secondAxisLabel = seriesConfigs[k].label || '';
                if (seriesConfigs[k].units) {
                    secondAxisLabel += ' (' + seriesConfigs[k].units + ')';
                }
                break;
            }
        }
        yAxes.push({
            type: 'value',
            name: secondAxisLabel,
            nameLocation: 'middle',
            nameGap: 45,
            min: config.yAxis2Min,
            max: config.yAxis2Max,
            axisLabel: { fontSize: 10 },
            splitLine: { show: false }
        });
        rightMargin = 60;
    }

    // Build legend config (only for classic style)
    var legendConfig = buildLegendConfig(config, legendData, useStatsCard, legendPosition);

    // Build toolbox
    var toolboxConfig = buildToolboxConfig(config);

    // Build dataZoom
    var dataZoomConfig = [
        { type: 'inside', xAxisIndex: 0 }
    ];

    if (config.showDataZoomSlider) {
        dataZoomConfig.push({
            type: 'slider',
            xAxisIndex: 0,
            bottom: 5,
            height: 20
        });
    }

    // Build tooltip
    var tooltipConfig = buildTooltipConfig(chartType);

    return {
        tooltip: tooltipConfig,
        legend: legendConfig,
        toolbox: toolboxConfig,
        grid: {
            left: leftMargin,
            right: rightMargin,
            top: topMargin,
            bottom: bottomMargin
        },
        xAxis: {
            type: 'time',
            axisLabel: { fontSize: 10 },
            splitLine: { show: false }
        },
        yAxis: yAxes,
        dataZoom: dataZoomConfig,
        series: series
    };
}

function buildSeparateChartsOption(config, margins) {
    var datasourceGroups = config.datasourceGroups || {};
    var datasourceOrder = config.datasourceOrder || [];
    var chartType = config.chartType || 'line';
    var smoothLine = config.smoothLine !== false;
    var numCharts = datasourceOrder.length;

    // Layout parameters (all in %)
    var topReserved = 4;     // Space at top
    var bottomReserved = config.showDataZoomSlider ? 18 : 10;  // Space for slider + X-axis labels
    var gapBetween = 4;      // Gap between charts

    // Calculate chart height
    // Available = 100 - top - bottom - gaps
    // Gaps = (numCharts - 1) * gapBetween
    var totalGaps = (numCharts - 1) * gapBetween;
    var availableHeight = 100 - topReserved - bottomReserved - totalGaps;
    var chartHeight = availableHeight / numCharts;

    var grids = [];
    var xAxes = [];
    var yAxes = [];
    var series = [];

    for (var i = 0; i < numCharts; i++) {
        var dsId = datasourceOrder[i];
        var dsGroup = datasourceGroups[dsId];
        var isLastChart = (i === numCharts - 1);

        // Calculate position for this chart
        // Each chart starts after: top + (previous charts * height) + (previous gaps)
        var chartTop = topReserved + (i * chartHeight) + (i * gapBetween);
        var chartBottom = 100 - chartTop - chartHeight;

        // Grid for this datasource (extra left margin for vertical y-axis label)
        grids.push({
            left: margins.leftMargin + 15,
            right: margins.rightMargin + 10,
            top: chartTop + '%',
            bottom: chartBottom + '%'
        });

        // X-axis for this chart
        xAxes.push({
            type: 'time',
            gridIndex: i,
            axisLabel: {
                show: isLastChart, // Only show labels on last chart
                fontSize: 10
            },
            axisTick: { show: isLastChart },
            axisLine: { show: true },
            splitLine: { show: false }
        });

        // Y-axis for this chart - build label from series labels and units
        var yAxisLabels = [];
        for (var si = 0; si < dsGroup.series.length; si++) {
            var s = dsGroup.series[si];
            var labelText = s.label || '';
            if (s.units) {
                labelText += ' (' + s.units + ')';
            }
            if (labelText && yAxisLabels.indexOf(labelText) === -1) {
                yAxisLabels.push(labelText);
            }
        }
        // Use line break for multiple series
        var yAxisName = yAxisLabels.length > 1 ? yAxisLabels.join('\n') : yAxisLabels[0] || '';

        yAxes.push({
            type: 'value',
            gridIndex: i,
            name: yAxisName,
            nameLocation: 'middle',
            nameGap: 45,
            nameTextStyle: { fontSize: 11 },
            axisLabel: { fontSize: 10 },
            splitLine: { lineStyle: { type: 'dashed', opacity: 0.3 } }
        });

        // Add all series from this datasource to this chart
        for (var j = 0; j < dsGroup.series.length; j++) {
            var sc = dsGroup.series[j];
            var seriesConfig = {
                name: sc.label,
                type: chartType === 'scatter' ? 'scatter' : (chartType === 'bar' ? 'bar' : 'line'),
                data: sc.data,
                xAxisIndex: i,
                yAxisIndex: i,
                smooth: smoothLine && chartType === 'line',
                symbol: chartType === 'line' ? 'none' : (chartType === 'scatter' ? 'circle' : undefined),
                symbolSize: chartType === 'scatter' ? 8 : undefined,
                lineStyle: { color: sc.color, width: 2 },
                itemStyle: { color: sc.color }
            };

            if (chartType === 'area') {
                seriesConfig.type = 'line';
                seriesConfig.areaStyle = { color: sc.color, opacity: 0.3 };
                seriesConfig.smooth = smoothLine;
                seriesConfig.symbol = 'none';
            }

            series.push(seriesConfig);
        }
    }

    // Build xAxisIndex array for dataZoom (connect all x-axes)
    var xAxisIndices = [];
    for (var k = 0; k < numCharts; k++) {
        xAxisIndices.push(k);
    }

    // Build dataZoom that syncs all charts - more space at bottom
    var dataZoomConfig = [
        {
            type: 'inside',
            xAxisIndex: xAxisIndices
        }
    ];

    if (config.showDataZoomSlider) {
        dataZoomConfig.push({
            type: 'slider',
            xAxisIndex: xAxisIndices,
            bottom: 10,
            height: 25,
            borderColor: '#ddd',
            backgroundColor: '#fafafa',
            fillerColor: 'rgba(33, 150, 243, 0.2)',
            handleStyle: { color: '#2196F3' }
        });
    }

    // Build legend config
    var legendConfig = buildLegendConfig(config, margins.legendData, margins.useStatsCard, margins.legendPosition);

    // Build toolbox
    var toolboxConfig = buildToolboxConfig(config);

    // Build tooltip for separate charts
    var tooltipConfig = {
        trigger: 'axis',
        axisPointer: {
            type: 'line',
            link: [{ xAxisIndex: 'all' }]
        },
        formatter: function(params) {
            if (!params || !params.length) return '';
            var d = new Date(params[0].value[0]);
            var result = '<b>' + d.toLocaleString() + '</b><br/>';

            for (var i = 0; i < params.length; i++) {
                var p = params[i];
                if (p.value && p.value[1] !== null && p.value[1] !== undefined) {
                    result += '<span style="display:inline-block;margin-right:4px;border-radius:10px;width:10px;height:10px;background-color:' + p.color + ';"></span>';
                    result += p.seriesName + ': ' + p.value[1].toFixed(2) + '<br/>';
                }
            }
            return result;
        }
    };

    // Add axisPointer link for synchronized crosshair
    var axisPointerConfig = {
        link: [{ xAxisIndex: 'all' }]
    };

    return {
        tooltip: tooltipConfig,
        axisPointer: axisPointerConfig,
        legend: legendConfig,
        toolbox: toolboxConfig,
        grid: grids,
        xAxis: xAxes,
        yAxis: yAxes,
        dataZoom: dataZoomConfig,
        series: series
    };
}

function buildLegendConfig(config, legendData, useStatsCard, legendPosition) {
    if (!config.showLegend || useStatsCard) return null;

    var legendConfig = {
        data: legendData,
        textStyle: { fontSize: 11 }
    };

    switch (legendPosition) {
        case 'top':
            legendConfig.top = 5;
            legendConfig.left = 'center';
            legendConfig.orient = 'horizontal';
            break;
        case 'bottom':
            legendConfig.bottom = config.showDataZoomSlider ? 30 : 5;
            legendConfig.left = 'center';
            legendConfig.orient = 'horizontal';
            break;
        case 'left':
            legendConfig.left = 5;
            legendConfig.top = 'middle';
            legendConfig.orient = 'vertical';
            break;
        case 'right':
            legendConfig.right = 5;
            legendConfig.top = 'middle';
            legendConfig.orient = 'vertical';
            break;
        default:
            legendConfig.bottom = config.showDataZoomSlider ? 30 : 5;
            legendConfig.left = 'center';
            legendConfig.orient = 'horizontal';
    }

    return legendConfig;
}

function buildToolboxConfig(config) {
    if (!config.showToolbox) return null;

    var toolboxConfig = {
        show: true,
        right: 10,
        top: 5,
        feature: {}
    };

    if (config.showSaveAsImage) {
        toolboxConfig.feature.saveAsImage = {
            show: true,
            title: 'Save as PNG',
            pixelRatio: 2
        };
    }

    if (config.showDataView) {
        toolboxConfig.feature.dataView = {
            show: true,
            title: 'Data View',
            readOnly: true,
            lang: ['Data View', 'Close', 'Refresh'],
            optionToContent: function(opt) {
                var seriesList = opt.series || [];
                var html = '<div style="padding: 12px; font-family: -apple-system, BlinkMacSystemFont, sans-serif;">';

                for (var i = 0; i < seriesList.length; i++) {
                    var s = seriesList[i];
                    var data = s.data || [];
                    if (data.length === 0) continue;

                    html += '<div style="font-size: 14px; font-weight: 600; margin: 12px 0 8px 0;">' + s.name + ' (' + data.length + ' points)</div>';
                    html += '<div style="max-height: 300px; overflow: auto; border: 1px solid #e5e7eb; border-radius: 6px;">';
                    html += '<table style="width: 100%; border-collapse: collapse; font-size: 12px;">';
                    html += '<thead style="position: sticky; top: 0; background: #f9fafb;">';
                    html += '<tr><th style="padding: 8px; text-align: left; border-bottom: 2px solid #e5e7eb;">Timestamp</th>';
                    html += '<th style="padding: 8px; text-align: right; border-bottom: 2px solid #e5e7eb;">Value</th></tr></thead>';
                    html += '<tbody>';

                    for (var j = 0; j < data.length; j++) {
                        var row = data[j];
                        var d = new Date(row[0]);
                        var ts = d.getFullYear() + '-' +
                            String(d.getMonth() + 1).padStart(2, '0') + '-' +
                            String(d.getDate()).padStart(2, '0') + ' ' +
                            String(d.getHours()).padStart(2, '0') + ':' +
                            String(d.getMinutes()).padStart(2, '0') + ':' +
                            String(d.getSeconds()).padStart(2, '0');
                        var rowBg = j % 2 === 0 ? '#ffffff' : '#f9fafb';
                        html += '<tr style="background: ' + rowBg + ';">';
                        html += '<td style="padding: 6px 8px; font-family: monospace; font-size: 11px;">' + ts + '</td>';
                        html += '<td style="padding: 6px 8px; text-align: right; font-weight: 500;">' + (row[1] !== null ? row[1].toFixed(2) : '-') + '</td>';
                        html += '</tr>';
                    }

                    html += '</tbody></table></div>';
                }

                html += '</div>';
                return html;
            }
        };
    }

    if (config.showDataZoom) {
        toolboxConfig.feature.dataZoom = {
            show: true,
            title: { zoom: 'Zoom', back: 'Reset Zoom' }
        };
    }

    if (config.showRestore) {
        toolboxConfig.feature.restore = {
            show: true,
            title: 'Restore'
        };
    }

    return toolboxConfig;
}

function buildTooltipConfig(chartType) {
    return {
        trigger: 'axis',
        axisPointer: { type: chartType === 'bar' ? 'shadow' : 'cross' },
        formatter: function(params) {
            if (!params || !params.length) return '';
            var d = new Date(params[0].value[0]);
            var result = d.toLocaleString() + '<br/>';

            for (var i = 0; i < params.length; i++) {
                var p = params[i];
                if (p.value && p.value[1] !== null && p.value[1] !== undefined) {
                    result += '<span style="display:inline-block;margin-right:4px;border-radius:10px;width:10px;height:10px;background-color:' + p.color + ';"></span>';
                    result += p.seriesName + ': ' + p.value[1].toFixed(2) + '<br/>';
                }
            }
            return result;
        }
    };
}

self.onResize = function() {
    if (chart && chartContainer) {
        // Use explicit dimensions for reliable resize
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

self.typeParameters = function() {
    return {
        previewWidth: '100%',
        previewHeight: '100%',
        embedTitlePanel: false,
        hasDataExportAction: true,
        dataKeySettingsFunction: function() { return {}; },
        defaultDataKeysFunction: function() {
            return [{
                name: 'temperature',
                label: 'Temperature',
                type: 'timeseries',
                units: '',
                decimals: 1
            }];
        }
    };
};
