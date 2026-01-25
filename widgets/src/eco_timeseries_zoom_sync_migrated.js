/**
 * ECO Timeseries Zoom Sync Widget (Library Version)
 *
 * Time series visualization with configurable chart types, multi-series support,
 * dual Y-axes, statistics cards, and internal zoom.
 *
 * This version uses ECOWidgetUtils library for common functionality.
 */

// Get library reference
var utils = window.ECOWidgetUtils;

var chart = null;
var chartContainer = null;
var statsCardContainers = {};
var timewindowSelectorContainer = null;
var resizeObserver = null;

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

    if (!utils) {
        console.error('ECO Timeseries Zoom Sync: ECOWidgetUtils library not loaded');
        return;
    }

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
    var chartLayout = settings.chartLayout || 'combined';

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

    // Timewindow selector settings
    var showTimewindowSelector = settings.showTimewindowSelector === true;

    // Initialize and render timewindow selector using library
    if (showTimewindowSelector && self.ctx.dashboard && timewindowSelectorContainer) {
        utils.timewindow.init(timewindowSelectorContainer, {
            color: settings.twSelectorColor || '',
            position: settings.twSelectorPosition || 'center',
            dayFormat: settings.twSelectorDayFormat || 'D MMM YYYY',
            weekFormat: settings.twSelectorWeekFormat || 'D-D MMM',
            monthFormat: settings.twSelectorMonthFormat || 'MMM YYYY',
            customStartTime: settings.twCustomStartTime || '',
            customEndTime: settings.twCustomEndTime || '',
            aggregationType: settings.twAggregationType || 'NONE',
            maxDataPoints: settings.twMaxDataPoints || 100000
        }, self.ctx);
        utils.timewindow.render();
    } else if (timewindowSelectorContainer) {
        utils.timewindow.hide();
    }

    // Check for valid data
    if (!data.length) {
        showNoData('No data available');
        return;
    }

    // Process all datasources
    var seriesConfigs = [];
    var allStats = [];
    var hasSecondAxis = false;
    var datasourceGroups = {};
    var datasourceOrder = [];

    var datasourceConfigs = self.ctx.datasources || [];

    // Track datasource indices
    var dataIndexToDsIndex = {};
    var currentDsIndex = 0;
    var currentKeyIndex = 0;
    for (var i = 0; i < data.length; i++) {
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

        var dsIndex = dataIndexToDsIndex[i] !== undefined ? dataIndexToDsIndex[i] : i;
        var dsId = 'ds_' + dsIndex;
        var dsName = datasource.entityName || datasource.name || datasource.entityLabel || ('Datasource ' + (dsIndex + 1));

        var label = dataKey.label || dataKey.name || 'Series ' + (i + 1);
        var units = dataKey.units || '';
        var decimals = dataKey.decimals !== undefined ? dataKey.decimals : 2;
        var color = dataKey.color || utils.color.getDefault(i);

        // Determine Y-axis
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

        // Remove outliers using library
        if (removeOutliers) {
            var outlierResult = utils.dataProcessing.removeOutliers(values, timestamps, {
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

        // Apply smoothing using library
        if (smoothingEnabled && smoothingWindowMinutes > 0 && timestamps.length > 1) {
            var windowSize = utils.dataProcessing.getWindowSizeFromMinutes(timestamps, smoothingWindowMinutes);
            values = utils.dataProcessing.movingAverage(values, windowSize);
        }

        // Build series data
        var seriesData = [];
        var lastTimestamp = null;
        var lastValue = null;
        for (var k = 0; k < values.length; k++) {
            seriesData.push([timestamps[k], values[k]]);
            lastTimestamp = timestamps[k];
            lastValue = values[k];
        }

        // Calculate statistics using library
        var stats = utils.stats.calculate(values);
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

        // Group by datasource
        if (!datasourceGroups[dsId]) {
            datasourceGroups[dsId] = { name: dsName, series: [] };
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
        toolboxFeatures: toolboxFeatures
    });

    chart.setOption(option, true);

    // Render statistics cards using library
    utils.statsCard.render(statsCardContainers, {
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

    // Resize chart after stats cards
    function doResize() {
        if (chart && chartContainer) {
            chart.resize({
                width: chartContainer.offsetWidth,
                height: chartContainer.offsetHeight
            });
        }
    }
    requestAnimationFrame(function() { requestAnimationFrame(doResize); });
    setTimeout(doResize, 100);
    setTimeout(doResize, 250);
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

function buildChartOption(config) {
    var seriesConfigs = config.seriesConfigs;
    var chartType = config.chartType || 'line';
    var smoothLine = config.smoothLine !== false;
    var chartLayout = config.chartLayout || 'combined';

    var legendData = seriesConfigs.map(function(s) { return s.label; });

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

    // Handle separate chart layout
    if (chartLayout === 'separate' && config.datasourceOrder.length > 1) {
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

    // Combined chart layout
    var series = seriesConfigs.map(function(sc) {
        var s = {
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
            s.type = 'line';
            s.areaStyle = { color: sc.color, opacity: 0.3 };
            s.smooth = smoothLine;
            s.symbol = 'none';
        }

        return s;
    });

    // Build Y-axes
    var firstAxisLabel = seriesConfigs[0] ? (seriesConfigs[0].label + (seriesConfigs[0].units ? ' (' + seriesConfigs[0].units + ')' : '')) : '';
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
        var secondAxisSeries = seriesConfigs.find(function(s) { return s.yAxisIndex === 1; });
        var secondAxisLabel = secondAxisSeries ? (secondAxisSeries.label + (secondAxisSeries.units ? ' (' + secondAxisSeries.units + ')' : '')) : '';
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

    var legendConfig = buildLegendConfig(config, legendData, useStatsCard, legendPosition);
    var toolboxConfig = buildToolboxConfig(config);

    var dataZoomConfig = [{ type: 'inside', xAxisIndex: 0 }];
    if (config.showDataZoomSlider) {
        dataZoomConfig.push({ type: 'slider', xAxisIndex: 0, bottom: 5, height: 20 });
    }

    return {
        tooltip: buildTooltipConfig(chartType),
        legend: legendConfig,
        toolbox: toolboxConfig,
        grid: { left: leftMargin, right: rightMargin, top: topMargin, bottom: bottomMargin },
        xAxis: { type: 'time', axisLabel: { fontSize: 10 }, splitLine: { show: false } },
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

    var topReserved = 4;
    var bottomReserved = config.showDataZoomSlider ? 18 : 10;
    var gapBetween = 4;

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

        var chartTop = topReserved + (i * chartHeight) + (i * gapBetween);
        var chartBottom = 100 - chartTop - chartHeight;

        grids.push({
            left: margins.leftMargin + 15,
            right: margins.rightMargin + 10,
            top: chartTop + '%',
            bottom: chartBottom + '%'
        });

        xAxes.push({
            type: 'time',
            gridIndex: i,
            axisLabel: { show: isLastChart, fontSize: 10 },
            axisTick: { show: isLastChart },
            axisLine: { show: true },
            splitLine: { show: false }
        });

        var yAxisLabels = dsGroup.series.map(function(s) {
            return s.label + (s.units ? ' (' + s.units + ')' : '');
        }).filter(function(v, i, a) { return a.indexOf(v) === i; });

        yAxes.push({
            type: 'value',
            gridIndex: i,
            name: yAxisLabels.join('\n'),
            nameLocation: 'middle',
            nameGap: 45,
            nameTextStyle: { fontSize: 11 },
            axisLabel: { fontSize: 10 },
            splitLine: { lineStyle: { type: 'dashed', opacity: 0.3 } }
        });

        dsGroup.series.forEach(function(sc) {
            var s = {
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
                s.type = 'line';
                s.areaStyle = { color: sc.color, opacity: 0.3 };
                s.smooth = smoothLine;
                s.symbol = 'none';
            }

            series.push(s);
        });
    }

    var xAxisIndices = [];
    for (var k = 0; k < numCharts; k++) xAxisIndices.push(k);

    var dataZoomConfig = [{ type: 'inside', xAxisIndex: xAxisIndices }];
    if (config.showDataZoomSlider) {
        dataZoomConfig.push({
            type: 'slider',
            xAxisIndex: xAxisIndices,
            bottom: 10,
            height: 25
        });
    }

    return {
        tooltip: {
            trigger: 'axis',
            axisPointer: { type: 'line', link: [{ xAxisIndex: 'all' }] },
            formatter: function(params) {
                if (!params || !params.length) return '';
                var d = new Date(params[0].value[0]);
                var result = '<b>' + d.toLocaleString() + '</b><br/>';
                params.forEach(function(p) {
                    if (p.value && p.value[1] !== null) {
                        result += '<span style="display:inline-block;margin-right:4px;border-radius:10px;width:10px;height:10px;background-color:' + p.color + ';"></span>';
                        result += p.seriesName + ': ' + p.value[1].toFixed(2) + '<br/>';
                    }
                });
                return result;
            }
        },
        axisPointer: { link: [{ xAxisIndex: 'all' }] },
        legend: buildLegendConfig(config, margins.legendData, margins.useStatsCard, margins.legendPosition),
        toolbox: buildToolboxConfig(config),
        grid: grids,
        xAxis: xAxes,
        yAxis: yAxes,
        dataZoom: dataZoomConfig,
        series: series
    };
}

function buildLegendConfig(config, legendData, useStatsCard, legendPosition) {
    if (!config.showLegend || useStatsCard) return null;

    var legendConfig = { data: legendData, textStyle: { fontSize: 11 } };

    switch (legendPosition) {
        case 'top': legendConfig.top = 5; legendConfig.left = 'center'; legendConfig.orient = 'horizontal'; break;
        case 'bottom': legendConfig.bottom = config.showDataZoomSlider ? 30 : 5; legendConfig.left = 'center'; legendConfig.orient = 'horizontal'; break;
        case 'left': legendConfig.left = 5; legendConfig.top = 'middle'; legendConfig.orient = 'vertical'; break;
        case 'right': legendConfig.right = 5; legendConfig.top = 'middle'; legendConfig.orient = 'vertical'; break;
        default: legendConfig.bottom = config.showDataZoomSlider ? 30 : 5; legendConfig.left = 'center'; legendConfig.orient = 'horizontal';
    }

    return legendConfig;
}

function buildToolboxConfig(config) {
    if (!config.showToolbox) return null;

    var features = config.toolboxFeatures || [];
    var toolbox = { show: true, right: 10, top: 5, feature: {} };

    if (features.indexOf('saveAsImage') !== -1) {
        toolbox.feature.saveAsImage = { show: true, title: 'Save as PNG', pixelRatio: 2 };
    }

    if (features.indexOf('dataView') !== -1) {
        toolbox.feature.dataView = {
            show: true,
            title: 'Data View',
            readOnly: true,
            lang: ['Data View', 'Close', 'Refresh'],
            optionToContent: function(opt) {
                var html = '<div style="padding: 12px; font-family: -apple-system, BlinkMacSystemFont, sans-serif;">';
                (opt.series || []).forEach(function(s) {
                    var data = s.data || [];
                    if (data.length === 0) return;
                    html += '<div style="font-size: 14px; font-weight: 600; margin: 12px 0 8px 0;">' + s.name + ' (' + data.length + ' points)</div>';
                    html += '<div style="max-height: 300px; overflow: auto; border: 1px solid #e5e7eb; border-radius: 6px;">';
                    html += '<table style="width: 100%; border-collapse: collapse; font-size: 12px;">';
                    html += '<thead style="position: sticky; top: 0; background: #f9fafb;">';
                    html += '<tr><th style="padding: 8px; text-align: left; border-bottom: 2px solid #e5e7eb;">Timestamp</th>';
                    html += '<th style="padding: 8px; text-align: right; border-bottom: 2px solid #e5e7eb;">Value</th></tr></thead><tbody>';
                    data.forEach(function(row, j) {
                        var d = new Date(row[0]);
                        var ts = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0') + ' ' +
                                 String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0') + ':' + String(d.getSeconds()).padStart(2, '0');
                        html += '<tr style="background: ' + (j % 2 === 0 ? '#ffffff' : '#f9fafb') + ';">';
                        html += '<td style="padding: 6px 8px; font-family: monospace; font-size: 11px;">' + ts + '</td>';
                        html += '<td style="padding: 6px 8px; text-align: right; font-weight: 500;">' + (row[1] !== null ? row[1].toFixed(2) : '-') + '</td></tr>';
                    });
                    html += '</tbody></table></div>';
                });
                html += '</div>';
                return html;
            }
        };
    }

    if (features.indexOf('dataZoom') !== -1) {
        toolbox.feature.dataZoom = { show: true, title: { zoom: 'Zoom', back: 'Reset Zoom' } };
    }

    if (features.indexOf('restore') !== -1) {
        toolbox.feature.restore = { show: true, title: 'Restore' };
    }

    return toolbox;
}

function buildTooltipConfig(chartType) {
    return {
        trigger: 'axis',
        axisPointer: { type: chartType === 'bar' ? 'shadow' : 'cross' },
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
    };
}

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
