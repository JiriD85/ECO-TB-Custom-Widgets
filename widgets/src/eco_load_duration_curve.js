/**
 * ECO Load Duration Curve Widget
 *
 * Displays load data as a duration curve with optional load profile.
 * Supports energy-to-power conversion, data smoothing, outlier removal, and configurable thresholds.
 */

var chart = null;
var chartContainer = null;
var statsCardContainers = {};
var resizeObserver = null;

self.onInit = function() {
    chartContainer = self.ctx.$container.find('#chart-container')[0];
    statsCardContainers = {
        top: self.ctx.$container.find('#stats-card-top')[0],
        bottom: self.ctx.$container.find('#stats-card-bottom')[0],
        left: self.ctx.$container.find('#stats-card-left')[0],
        right: self.ctx.$container.find('#stats-card-right')[0]
    };

    if (!chartContainer) {
        console.error('ECO Load Duration Curve: Chart container not found');
        return;
    }

    if (typeof echarts === 'undefined') {
        console.error('ECO Load Duration Curve: ECharts library not loaded');
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

    // Display settings
    var showLoadProfile = settings.showLoadProfile === true;
    var showDurationCurve = settings.showDurationCurve !== false;

    // Data processing settings
    var dataType = settings.dataType || 'power';
    var energyToPower = settings.energyToPower === true;

    // Outlier removal settings
    var removeOutliers = settings.removeOutliers === true;
    var outlierMethod = settings.outlierMethod || 'iqr';
    var outlierIqrMultiplier = settings.outlierIqrMultiplier || 1.5;
    var outlierZscoreThreshold = settings.outlierZscoreThreshold || 3;
    var outlierMinValue = settings.outlierMinValue;
    var outlierMaxValue = settings.outlierMaxValue;

    // Smoothing settings
    var smoothingEnabled = settings.smoothingEnabled === true;
    var smoothingWindow = settings.smoothingWindow || 5;

    // Threshold settings
    var showThresholds = settings.showThresholds === true;
    var autoDetectThresholds = settings.autoDetectThresholds !== false;
    var baseLoadPercentile = settings.baseLoadPercentile !== undefined ? settings.baseLoadPercentile : 10;
    var peakLoadPercentile = settings.peakLoadPercentile !== undefined ? settings.peakLoadPercentile : 90;
    var manualBaseLoad = settings.manualBaseLoad;
    var manualPeakLoad = settings.manualPeakLoad;
    var baseLoadColor = settings.baseLoadColor || '#4CAF50';
    var peakLoadColor = settings.peakLoadColor || '#F44336';

    // Statistical lines
    var showMean = settings.showMean === true;
    var showMedian = settings.showMedian === true;
    var meanColor = settings.meanColor || '#FF9800';
    var medianColor = settings.medianColor || '#9C27B0';

    // Axis settings
    var yAxisMin = settings.yAxisMin;
    var yAxisMax = settings.yAxisMax;
    var yAxisLabel = settings.yAxisLabel || '';

    // Chart appearance
    var defaultSeriesColor = '#2196F3';
    var showLegend = settings.showLegend !== false;
    var showTooltip = settings.showTooltip !== false;

    // Legend settings
    var legendPosition = settings.legendPosition || 'bottom';
    var legendStyle = settings.legendStyle || 'classic'; // 'classic' or 'card'
    var legendAlign = settings.legendAlign || 'center'; // 'left', 'center', 'right'
    var legendCardColorMode = settings.legendCardColorMode || 'auto'; // 'auto', 'manual', 'gradient'
    var legendCardColor = settings.legendCardColor || '#2196F3';
    var legendValues = settings.legendValues || ['current']; // Array: ['current', 'min', 'max', 'avg', 'median', 'sum', 'count']

    // Timestamp settings
    var showTimestamp = settings.showTimestamp !== false;
    var timestampFormat = settings.timestampFormat || 'YYYY-MM-DD HH:mm:ss';

    // Toolbox settings
    var showToolbox = settings.showToolbox !== false;
    var toolboxFeatures = settings.toolboxFeatures || ['saveAsImage', 'dataView', 'dataZoom', 'restore'];
    var showSaveAsImage = toolboxFeatures.indexOf('saveAsImage') !== -1;
    var showDataView = toolboxFeatures.indexOf('dataView') !== -1;
    var showDataZoom = toolboxFeatures.indexOf('dataZoom') !== -1;
    var showRestore = toolboxFeatures.indexOf('restore') !== -1;

    // Get data from datasources
    var data = self.ctx.data || [];
    if (!data.length || !data[0].data || !data[0].data.length) {
        showNoData('No data available');
        return;
    }

    var seriesData = data[0].data;
    var dataKey = data[0].dataKey || {};
    var datasource = data[0].datasource || {};

    // Determine display name: prefer label, then entityName, then key name
    var label = dataKey.label || datasource.entityName || datasource.name || dataKey.name || 'Value';

    // Use dataKey settings for units/decimals
    var units = dataKey.units || self.ctx.units || '';
    var decimals = dataKey.decimals !== undefined ? dataKey.decimals : 2;
    var dataKeyColor = dataKey.color || null;

    // Extract and process values
    var rawValues = [];
    var timestamps = [];

    for (var i = 0; i < seriesData.length; i++) {
        var ts = seriesData[i][0];
        var val = seriesData[i][1];
        if (val !== null && !isNaN(val)) {
            timestamps.push(ts);
            rawValues.push(val);
        }
    }

    if (rawValues.length === 0) {
        showNoData('No valid data points');
        return;
    }

    // Energy to power conversion (kWh to kW)
    var values = rawValues.slice();
    if (energyToPower && dataType === 'energy' && timestamps.length > 1) {
        values = convertEnergyToPower(rawValues, timestamps);
        units = units.replace(/Wh/i, 'W').replace(/wh/i, 'w');
        label = label + ' (Power)';
    }

    // Remove outliers BEFORE other processing
    var outlierInfo = { removed: 0, method: 'none' };
    if (removeOutliers) {
        var result = removeOutliersFromData(values, timestamps, {
            method: outlierMethod,
            iqrMultiplier: outlierIqrMultiplier,
            zscoreThreshold: outlierZscoreThreshold,
            minValue: outlierMinValue,
            maxValue: outlierMaxValue
        });
        values = result.values;
        timestamps = result.timestamps;
        outlierInfo = { removed: result.removed, method: outlierMethod };

        if (values.length === 0) {
            showNoData('All data points removed as outliers');
            return;
        }
    }

    // Apply smoothing if enabled
    if (smoothingEnabled && smoothingWindow > 1) {
        values = movingAverage(values, smoothingWindow);
    }

    // Calculate statistics
    var stats = calculateStatistics(values);

    // Add current value and last timestamp
    if (values.length > 0 && timestamps.length > 0) {
        stats.current = values[values.length - 1];
        stats.lastTimestamp = timestamps[timestamps.length - 1];
    }

    // Calculate thresholds
    // Base Load = low constant load (use low percentile, e.g. 10 = 10th percentile)
    // Peak Load = high peak demand (use high percentile, e.g. 90 = 90th percentile)
    var baseLoadValue, peakLoadValue;
    if (showThresholds) {
        var sortedAsc = values.slice().sort(function(a, b) { return a - b; });
        if (autoDetectThresholds) {
            // baseLoadPercentile = direct percentile position (e.g., 10 = 10th percentile = low value)
            // peakLoadPercentile = direct percentile position (e.g., 90 = 90th percentile = high value)
            baseLoadValue = percentile(sortedAsc, baseLoadPercentile);
            peakLoadValue = percentile(sortedAsc, peakLoadPercentile);
        } else {
            baseLoadValue = manualBaseLoad;
            peakLoadValue = manualPeakLoad;
        }
    }

    // Prepare duration curve data (sorted descending)
    var sortedValues = values.slice().sort(function(a, b) { return b - a; });
    var durationData = [];
    for (var j = 0; j < sortedValues.length; j++) {
        var pct = sortedValues.length > 1 ? (j / (sortedValues.length - 1)) * 100 : 0;
        durationData.push([Math.round(pct * 10) / 10, sortedValues[j]]);
    }

    // Prepare load profile data (time series)
    var loadProfileData = [];
    for (var k = 0; k < timestamps.length; k++) {
        loadProfileData.push([timestamps[k], values[k]]);
    }

    // Determine series color: prefer dataKey color, then default
    var seriesColor = dataKeyColor || defaultSeriesColor;

    // Build ECharts option
    var option = buildChartOption({
        showLoadProfile: showLoadProfile,
        showDurationCurve: showDurationCurve,
        loadProfileData: loadProfileData,
        durationData: durationData,
        label: label,
        units: units,
        decimals: decimals,
        seriesColor: seriesColor,
        showLegend: showLegend,
        showTooltip: showTooltip,
        showThresholds: showThresholds,
        baseLoadValue: baseLoadValue,
        peakLoadValue: peakLoadValue,
        baseLoadColor: baseLoadColor,
        peakLoadColor: peakLoadColor,
        showMean: showMean,
        showMedian: showMedian,
        meanValue: stats.mean,
        medianValue: stats.median,
        meanColor: meanColor,
        medianColor: medianColor,
        yAxisMin: yAxisMin,
        yAxisMax: yAxisMax,
        yAxisLabel: yAxisLabel || (label + (units ? ' (' + units + ')' : '')),
        outlierInfo: outlierInfo,
        // Legend settings
        stats: stats,
        legendPosition: legendPosition,
        legendStyle: legendStyle,
        legendValues: legendValues,
        // Toolbox settings
        showToolbox: showToolbox,
        showSaveAsImage: showSaveAsImage,
        showDataView: showDataView,
        showDataZoom: showDataZoom,
        showRestore: showRestore
    });

    chart.setOption(option, true);

    // Render statistics card in DOM (outside ECharts)
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
        stats: stats,
        label: label,
        units: units,
        decimals: decimals,
        seriesColor: seriesColor
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
    var showCard = config.showLegend && legendStyle === 'card' && legendValues.length > 0 && config.stats;

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
    if (isVertical) {
        container.style.flexDirection = 'column';
        container.style.alignItems = alignMap[align];
        container.style.justifyContent = 'flex-start';
    } else {
        container.style.flexDirection = 'row';
        container.style.justifyContent = justifyMap[align];
        container.style.alignItems = 'flex-start';
    }

    var stats = config.stats;
    var unit = config.units || '';
    var dec = config.decimals !== undefined ? config.decimals : 2;
    var seriesColor = config.seriesColor || '#2196F3';
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

    var titleEl = document.createElement('div');
    titleEl.style.cssText = 'font-size: ' + (isVertical ? '11px' : '12px') + '; font-weight: 600; margin-bottom: 8px; opacity: 0.95;' + (isVertical ? ' text-align: center;' : '');
    titleEl.textContent = config.label + (unit ? ' (' + unit + ')' : '');
    card.appendChild(titleEl);

    var statsRow = document.createElement('div');
    statsRow.style.cssText = 'display: flex; flex-wrap: wrap; gap: 6px;' + (isVertical ? ' flex-direction: column;' : '');

    legendValues.forEach(function(val) {
        var statValue, label, icon;
        switch(val) {
            case 'current': statValue = stats.current; label = 'Current'; icon = '\u25CF'; break;
            case 'min': statValue = stats.min; label = 'Min'; icon = '\u2193'; break;
            case 'max': statValue = stats.max; label = 'Max'; icon = '\u2191'; break;
            case 'avg': statValue = stats.mean; label = 'Avg'; icon = '\u03BC'; break;
            case 'mean': statValue = stats.mean; label = 'Mean'; icon = '\u03BC'; break;
            case 'median': statValue = stats.median; label = 'Median'; icon = '~'; break;
            case 'sum': statValue = stats.sum; label = 'Sum'; icon = '\u03A3'; break;
            case 'count': statValue = stats.count; label = 'Count'; icon = 'n'; break;
            default: return;
        }
        if (statValue !== undefined && statValue !== null) {
            var formattedVal = val === 'count' ? String(statValue) : statValue.toFixed(dec);

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

function convertEnergyToPower(energyValues, timestamps) {
    var powerValues = [];
    for (var i = 0; i < energyValues.length; i++) {
        if (i === 0) {
            powerValues.push(0);
        } else {
            var deltaEnergy = energyValues[i] - energyValues[i - 1];
            var deltaTimeHours = (timestamps[i] - timestamps[i - 1]) / 3600000;
            if (deltaTimeHours > 0) {
                var power = deltaEnergy / deltaTimeHours;
                powerValues.push(power);
            } else {
                powerValues.push(powerValues[i - 1] || 0);
            }
        }
    }
    if (powerValues.length > 1) {
        powerValues[0] = powerValues[1];
    }
    return powerValues;
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

function buildChartOption(config) {
    var grids = [];
    var xAxes = [];
    var yAxes = [];
    var series = [];
    var titles = [];

    var showBoth = config.showLoadProfile && config.showDurationCurve;

    var subtitle = '';
    if (config.outlierInfo && config.outlierInfo.removed > 0) {
        subtitle = config.outlierInfo.removed + ' outliers removed (' + config.outlierInfo.method + ')';
    }

    if (showBoth) {
        // Use percentage-based layout that doesn't overlap
        // Top chart: from top to 48%, Bottom chart: from 52% to bottom
        grids = [
            { left: 60, right: 20, top: 40, bottom: '55%' },
            { left: 60, right: 20, top: '55%', bottom: 45 }
        ];

        titles = [
            {
                text: 'Load Profile',
                subtext: subtitle,
                left: 'center',
                top: 2,
                textStyle: { fontSize: 12 },
                subtextStyle: { fontSize: 9, color: '#999' }
            },
            { text: 'Duration Curve', left: 'center', top: '49%', textStyle: { fontSize: 12 } }
        ];

        xAxes.push({
            type: 'time',
            gridIndex: 0,
            axisLabel: { fontSize: 10 },
            splitLine: { show: false }
        });

        xAxes.push({
            type: 'value',
            gridIndex: 1,
            name: '% of Time',
            nameLocation: 'middle',
            nameGap: 25,
            min: 0,
            max: 100,
            axisLabel: { formatter: '{value}%', fontSize: 10 }
        });

        yAxes.push({
            type: 'value',
            gridIndex: 0,
            name: config.yAxisLabel,
            nameLocation: 'middle',
            nameGap: 45,
            min: config.yAxisMin,
            max: config.yAxisMax,
            axisLabel: { fontSize: 10 },
            splitLine: { lineStyle: { type: 'dashed', opacity: 0.3 } }
        });

        yAxes.push({
            type: 'value',
            gridIndex: 1,
            name: config.yAxisLabel,
            nameLocation: 'middle',
            nameGap: 45,
            min: config.yAxisMin,
            max: config.yAxisMax,
            axisLabel: { fontSize: 10 },
            splitLine: { lineStyle: { type: 'dashed', opacity: 0.3 } }
        });

        // Both charts use the same data source - use unified color and label
        var seriesColor = config.seriesColor;

        series.push({
            name: config.label,
            type: 'line',
            xAxisIndex: 0,
            yAxisIndex: 0,
            data: config.loadProfileData,
            smooth: false,
            symbol: 'none',
            lineStyle: { color: seriesColor, width: 1.5 },
            areaStyle: { color: seriesColor, opacity: 0.1 },
            markLine: buildLoadProfileMarkLines(config)
        });

        series.push({
            name: config.label,
            type: 'line',
            xAxisIndex: 1,
            yAxisIndex: 1,
            data: config.durationData,
            smooth: true,
            symbol: 'none',
            lineStyle: { color: seriesColor, width: 2 },
            areaStyle: {
                color: {
                    type: 'linear',
                    x: 0, y: 0, x2: 0, y2: 1,
                    colorStops: [
                        { offset: 0, color: seriesColor },
                        { offset: 1, color: 'rgba(255,255,255,0.1)' }
                    ]
                }
            },
            markLine: buildDurationCurveMarkLines(config),
            markArea: buildThresholdAreas(config)
        });

    } else if (config.showLoadProfile) {
        grids = [{ left: 60, right: 20, top: 40, bottom: 45 }];
        titles = [{
            text: 'Load Profile - ' + config.label,
            subtext: subtitle,
            left: 'center',
            textStyle: { fontSize: 14 },
            subtextStyle: { fontSize: 10, color: '#999' }
        }];

        xAxes.push({
            type: 'time',
            axisLabel: { fontSize: 10 },
            splitLine: { show: false }
        });

        yAxes.push({
            type: 'value',
            name: config.yAxisLabel,
            nameLocation: 'middle',
            nameGap: 45,
            min: config.yAxisMin,
            max: config.yAxisMax,
            axisLabel: { fontSize: 10 },
            splitLine: { lineStyle: { type: 'dashed', opacity: 0.3 } }
        });

        series.push({
            name: config.label,
            type: 'line',
            data: config.loadProfileData,
            smooth: false,
            symbol: 'none',
            lineStyle: { color: config.seriesColor, width: 1.5 },
            areaStyle: { color: config.seriesColor, opacity: 0.1 },
            markLine: buildLoadProfileMarkLines(config)
        });

    } else {
        grids = [{ left: 60, right: 20, top: 40, bottom: 45 }];
        titles = [{
            text: 'Duration Curve - ' + config.label,
            subtext: subtitle,
            left: 'center',
            textStyle: { fontSize: 13 },
            subtextStyle: { fontSize: 9, color: '#999' }
        }];

        xAxes.push({
            type: 'value',
            name: '% of Time',
            nameLocation: 'middle',
            nameGap: 30,
            min: 0,
            max: 100,
            axisLabel: { formatter: '{value}%' }
        });

        yAxes.push({
            type: 'value',
            name: config.yAxisLabel,
            nameLocation: 'middle',
            nameGap: 45,
            min: config.yAxisMin,
            max: config.yAxisMax,
            axisLabel: { fontSize: 10 },
            splitLine: { lineStyle: { type: 'dashed', opacity: 0.3 } }
        });

        series.push({
            name: config.label,
            type: 'line',
            data: config.durationData,
            smooth: true,
            symbol: 'none',
            lineStyle: { color: config.seriesColor, width: 2 },
            areaStyle: {
                color: {
                    type: 'linear',
                    x: 0, y: 0, x2: 0, y2: 1,
                    colorStops: [
                        { offset: 0, color: config.seriesColor },
                        { offset: 1, color: 'rgba(255,255,255,0.1)' }
                    ]
                }
            },
            markLine: buildDurationCurveMarkLines(config),
            markArea: buildThresholdAreas(config)
        });
    }

    // Build legend - use DOM stats card when legendStyle='card', otherwise ECharts legend
    var legendConfig = null;
    var legendValues = config.legendValues || [];
    var legendStyle = config.legendStyle || 'classic';
    var useStatsCard = legendStyle === 'card' && legendValues.length > 0 && config.stats;

    // Only show ECharts legend if showLegend is true AND using classic style
    if (config.showLegend && !useStatsCard) {
        var legendData = [config.label];
        var position = config.legendPosition || 'bottom';
        var decimals = config.decimals !== undefined ? config.decimals : 2;
        var unit = config.units || '';

        legendConfig = {
            data: legendData,
            textStyle: { fontSize: 11 }
        };

        // Add formatter with stats if legendValues are selected
        if (legendValues.length > 0 && config.stats) {
            legendConfig.formatter = function(name) {
                var parts = [name];
                legendValues.forEach(function(val) {
                    var statValue, label;
                    switch(val) {
                        case 'min': statValue = config.stats.min; label = 'Min'; break;
                        case 'max': statValue = config.stats.max; label = 'Max'; break;
                        case 'avg': statValue = config.stats.mean; label = 'Avg'; break;
                        case 'median': statValue = config.stats.median; label = 'Median'; break;
                        case 'sum': statValue = config.stats.sum; label = 'Sum'; break;
                        case 'count':
                            parts.push('n=' + config.stats.count);
                            return;
                        default: return;
                    }
                    if (statValue !== undefined) {
                        parts.push(label + ': ' + statValue.toFixed(decimals) + (unit ? ' ' + unit : ''));
                    }
                });
                return parts.join('  |  ');
            };
        }

        // Set position and orientation based on setting
        switch (position) {
            case 'top':
                legendConfig.top = 5;
                legendConfig.left = 'center';
                legendConfig.orient = 'horizontal';
                break;
            case 'bottom':
                legendConfig.bottom = 5;
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
                legendConfig.bottom = 5;
                legendConfig.left = 'center';
                legendConfig.orient = 'horizontal';
        }
    }

    // Adjust grid margins based on legend position (only for classic ECharts legend)
    var legendMargin = (config.showLegend && !useStatsCard) ? 35 : 0;
    var position = config.legendPosition || 'bottom';

    // Recalculate grids with legend position consideration
    if (showBoth) {
        var topOffset = position === 'top' ? 40 + legendMargin : 40;
        var bottomOffset = position === 'bottom' ? 45 + legendMargin : 45;
        var leftOffset = position === 'left' ? 60 + legendMargin : 60;
        var rightOffset = position === 'right' ? 20 + legendMargin : 20;

        // Use bottom-based layout to prevent overlap
        grids = [
            { left: leftOffset, right: rightOffset, top: topOffset, bottom: '55%' },
            { left: leftOffset, right: rightOffset, top: '55%', bottom: bottomOffset }
        ];

        // Adjust title positions
        titles[0].top = topOffset - 38;
        titles[1].top = '50%';
    } else {
        var topOffset = position === 'top' ? 40 + legendMargin : 40;
        var bottomOffset = position === 'bottom' ? 45 + legendMargin : 45;
        var leftOffset = position === 'left' ? 60 + legendMargin : 60;
        var rightOffset = position === 'right' ? 20 + legendMargin : 20;

        grids = [{ left: leftOffset, right: rightOffset, top: topOffset, bottom: bottomOffset }];
    }

    // Build toolbox
    var toolboxConfig = null;
    if (config.showToolbox) {
        toolboxConfig = {
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
                    var series = opt.series || [];
                    var unit = config.units || '';
                    var dec = config.decimals !== undefined ? config.decimals : 2;
                    var legendValues = config.legendValues || [];
                    var stats = config.stats;
                    var showLegend = config.showLegend && legendValues.length > 0 && stats;

                    // Container with full height
                    var html = '<div style="display: flex; flex-direction: column; height: 100%; font-family: -apple-system, BlinkMacSystemFont, Segoe UI, Roboto, sans-serif;">';

                    // Statistics Card (if legend enabled)
                    if (showLegend) {
                        html += '<div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); border-radius: 8px; padding: 16px; margin: 12px; color: white; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">';
                        html += '<div style="font-size: 14px; font-weight: 600; margin-bottom: 12px; opacity: 0.9;">' + config.label + (unit ? ' (' + unit + ')' : '') + '</div>';
                        html += '<div style="display: flex; flex-wrap: wrap; gap: 16px;">';

                        legendValues.forEach(function(val) {
                            var statValue, label, icon;
                            switch(val) {
                                case 'min': statValue = stats.min; label = 'Min'; icon = '↓'; break;
                                case 'max': statValue = stats.max; label = 'Max'; icon = '↑'; break;
                                case 'avg': statValue = stats.mean; label = 'Avg'; icon = 'μ'; break;
                                case 'median': statValue = stats.median; label = 'Median'; icon = '~'; break;
                                case 'sum': statValue = stats.sum; label = 'Sum'; icon = 'Σ'; break;
                                case 'count': statValue = stats.count; label = 'Count'; icon = 'n'; break;
                                default: return;
                            }
                            if (statValue !== undefined) {
                                var formattedVal = val === 'count' ? statValue : statValue.toFixed(dec);
                                html += '<div style="background: rgba(255,255,255,0.15); border-radius: 6px; padding: 8px 12px; min-width: 80px;">';
                                html += '<div style="font-size: 11px; opacity: 0.8; margin-bottom: 2px;">' + icon + ' ' + label + '</div>';
                                html += '<div style="font-size: 16px; font-weight: 600;">' + formattedVal + '</div>';
                                html += '</div>';
                            }
                        });

                        html += '</div></div>';
                    }

                    // Data tables container
                    html += '<div style="flex: 1; overflow: hidden; display: flex; flex-direction: column; padding: 0 12px 12px 12px;">';

                    for (var i = 0; i < series.length; i++) {
                        var s = series[i];
                        var data = s.data || [];
                        if (data.length === 0) continue;

                        // Check if first value is timestamp (> year 2000 in ms)
                        var isTimeSeries = data[0] && data[0][0] > 946684800000;
                        var tableTitle = isTimeSeries ? 'Load Profile' : 'Duration Curve';

                        html += '<div style="font-size: 13px; font-weight: 600; color: #374151; margin: 8px 0 6px 0;">' + tableTitle + ' <span style="font-weight: 400; color: #6b7280;">(' + data.length + ' points)</span></div>';

                        // Table wrapper with scroll
                        html += '<div style="flex: 1; overflow: auto; border: 1px solid #e5e7eb; border-radius: 6px; min-height: 150px;">';
                        html += '<table style="width: 100%; border-collapse: collapse; font-size: 12px;">';

                        // Fixed header
                        html += '<thead style="position: sticky; top: 0; z-index: 1;">';
                        html += '<tr style="background: #f9fafb;">';
                        if (isTimeSeries) {
                            html += '<th style="border-bottom: 2px solid #e5e7eb; padding: 8px 12px; text-align: left; font-weight: 600; color: #374151; white-space: nowrap;">Timestamp</th>';
                        } else {
                            html += '<th style="border-bottom: 2px solid #e5e7eb; padding: 8px 12px; text-align: center; font-weight: 600; color: #374151; width: 80px;">%</th>';
                        }
                        html += '<th style="border-bottom: 2px solid #e5e7eb; padding: 8px 12px; text-align: right; font-weight: 600; color: #374151;">' + (unit || 'Value') + '</th>';
                        html += '</tr></thead>';

                        html += '<tbody>';
                        for (var j = 0; j < data.length; j++) {
                            var row = data[j];
                            var xVal = row[0];
                            var yVal = row[1];
                            var rowBg = j % 2 === 0 ? '#ffffff' : '#f9fafb';

                            html += '<tr style="background: ' + rowBg + ';">';
                            if (isTimeSeries) {
                                var d = new Date(xVal);
                                var ts = d.getFullYear() + '-' +
                                    String(d.getMonth() + 1).padStart(2, '0') + '-' +
                                    String(d.getDate()).padStart(2, '0') + ' ' +
                                    String(d.getHours()).padStart(2, '0') + ':' +
                                    String(d.getMinutes()).padStart(2, '0') + ':' +
                                    String(d.getSeconds()).padStart(2, '0');
                                html += '<td style="padding: 6px 12px; color: #6b7280; font-family: monospace; font-size: 11px; white-space: nowrap;">' + ts + '</td>';
                            } else {
                                html += '<td style="padding: 6px 12px; text-align: center; color: #6b7280;">' + xVal.toFixed(1) + '</td>';
                            }
                            html += '<td style="padding: 6px 12px; text-align: right; font-weight: 500; color: #111827;">' + yVal.toFixed(dec) + '</td>';
                            html += '</tr>';
                        }
                        html += '</tbody></table></div>';
                    }

                    html += '</div></div>';
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
    }

    return {
        title: titles,
        toolbox: toolboxConfig,
        tooltip: config.showTooltip ? {
            trigger: 'axis',
            formatter: function(params) {
                if (!params || !params.length) return '';
                var p = params[0];
                var dec = config.decimals !== undefined ? config.decimals : 2;
                // Check if this is a time-based axis (Load Profile) or value axis (Duration Curve)
                var isTimeAxis = p.axisType === 'xAxis.time' || (typeof p.value[0] === 'number' && p.value[0] > 1000000000000);
                if (isTimeAxis) {
                    var d = new Date(p.value[0]);
                    return d.toLocaleString() + '<br/>' +
                           p.seriesName + ': ' + formatValueWithDecimals(p.value[1], dec) + ' ' + config.units;
                } else {
                    return p.value[0].toFixed(1) + '% of time<br/>' +
                           p.seriesName + ': ' + formatValueWithDecimals(p.value[1], dec) + ' ' + config.units;
                }
            }
        } : null,
        legend: legendConfig,
        grid: grids,
        xAxis: xAxes,
        yAxis: yAxes,
        dataZoom: [
            { type: 'inside', xAxisIndex: showBoth ? [0, 1] : [0] }
        ],
        series: series
    };
}

function buildLoadProfileMarkLines(config) {
    var markLineData = [];

    if (config.showMean && config.meanValue !== undefined) {
        markLineData.push({
            yAxis: config.meanValue,
            lineStyle: { color: config.meanColor, type: 'dashed', width: 2 },
            label: {
                formatter: 'Mean: ' + formatValue(config.meanValue),
                position: 'insideEndTop',
                color: config.meanColor
            }
        });
    }

    if (config.showMedian && config.medianValue !== undefined) {
        markLineData.push({
            yAxis: config.medianValue,
            lineStyle: { color: config.medianColor, type: 'dotted', width: 2 },
            label: {
                formatter: 'Median: ' + formatValue(config.medianValue),
                position: 'insideEndBottom',
                color: config.medianColor
            }
        });
    }

    if (markLineData.length === 0) return null;

    return {
        silent: true,
        data: markLineData
    };
}

function buildDurationCurveMarkLines(config) {
    if (!config.showThresholds) return null;

    var markLineData = [];

    if (config.baseLoadValue !== undefined && config.baseLoadValue !== null) {
        markLineData.push({
            yAxis: config.baseLoadValue,
            lineStyle: { color: config.baseLoadColor, type: 'dashed', width: 2 },
            label: {
                formatter: 'Base Load: ' + formatValue(config.baseLoadValue),
                position: 'insideEndTop',
                color: config.baseLoadColor
            }
        });
    }

    if (config.peakLoadValue !== undefined && config.peakLoadValue !== null) {
        markLineData.push({
            yAxis: config.peakLoadValue,
            lineStyle: { color: config.peakLoadColor, type: 'dashed', width: 2 },
            label: {
                formatter: 'Peak Load: ' + formatValue(config.peakLoadValue),
                position: 'insideEndBottom',
                color: config.peakLoadColor
            }
        });
    }

    if (markLineData.length === 0) return null;

    return {
        silent: true,
        data: markLineData
    };
}

function buildThresholdAreas(config) {
    if (!config.showThresholds) return null;

    var areaData = [];

    if (config.baseLoadValue !== undefined && config.baseLoadValue !== null) {
        areaData.push([
            { yAxis: 0, itemStyle: { color: config.baseLoadColor, opacity: 0.05 } },
            { yAxis: config.baseLoadValue }
        ]);
    }

    if (config.peakLoadValue !== undefined && config.peakLoadValue !== null) {
        areaData.push([
            { yAxis: config.peakLoadValue, itemStyle: { color: config.peakLoadColor, opacity: 0.05 } },
            { yAxis: 'max' }
        ]);
    }

    if (areaData.length === 0) return null;

    return {
        silent: true,
        data: areaData
    };
}

function formatValue(value) {
    if (value === null || value === undefined) return '-';
    if (Math.abs(value) >= 1000) {
        return value.toFixed(0);
    } else if (Math.abs(value) >= 100) {
        return value.toFixed(1);
    } else {
        return value.toFixed(2);
    }
}

function formatValueWithDecimals(value, decimals) {
    if (value === null || value === undefined) return '-';
    if (decimals === undefined || decimals === null) {
        return formatValue(value);
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
        embedTitlePanel: false,
        hasDataExportAction: true,
        dataKeySettingsFunction: function() { return {}; },
        defaultDataKeysFunction: function() {
            return [{
                name: 'power',
                label: 'Power',
                type: 'timeseries',
                units: 'kW',
                decimals: 2
            }];
        }
    };
};
