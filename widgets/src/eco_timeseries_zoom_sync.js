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

self.onInit = function() {
    chartContainer = self.ctx.$container.find('#chart-container')[0];
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

    // Toolbox settings
    var showToolbox = settings.showToolbox !== false;
    var showSaveAsImage = settings.showSaveAsImage !== false;
    var showDataView = settings.showDataView !== false;
    var showDataZoom = settings.showDataZoom !== false;
    var showRestore = settings.showRestore !== false;

    // Check for valid data
    if (!data.length) {
        showNoData('No data available');
        return;
    }

    // Process all datasources
    var seriesConfigs = [];
    var allStats = [];
    var hasSecondAxis = false;

    for (var i = 0; i < data.length; i++) {
        var ds = data[i];
        if (!ds.data || !ds.data.length) continue;

        var dataKey = ds.dataKey || {};
        var datasource = ds.datasource || {};

        // Series identification
        var label = dataKey.label || datasource.entityName || datasource.name || dataKey.name || 'Series ' + (i + 1);
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
        var seriesData = [];
        var values = [];
        var lastTimestamp = null;
        var lastValue = null;

        for (var j = 0; j < ds.data.length; j++) {
            var ts = ds.data[j][0];
            var val = ds.data[j][1];
            if (val !== null && !isNaN(val)) {
                seriesData.push([ts, val]);
                values.push(val);
                lastTimestamp = ts;
                lastValue = val;
            }
        }

        if (values.length === 0) continue;

        // Calculate statistics for this series
        var stats = calculateStatistics(values);
        stats.current = lastValue;
        stats.lastTimestamp = lastTimestamp;

        seriesConfigs.push({
            label: label,
            units: units,
            decimals: decimals,
            color: color,
            data: seriesData,
            stats: stats,
            yAxisIndex: yAxisIndex
        });

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
        seriesConfigs: seriesConfigs,
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

    // Build series
    var series = [];
    var legendData = [];

    for (var i = 0; i < seriesConfigs.length; i++) {
        var sc = seriesConfigs[i];
        legendData.push(sc.label);

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

        // Area fill for area chart type
        if (chartType === 'area') {
            seriesConfig.type = 'line';
            seriesConfig.areaStyle = { color: sc.color, opacity: 0.3 };
            seriesConfig.smooth = smoothLine;
            seriesConfig.symbol = 'none';
        }

        series.push(seriesConfig);
    }

    // Calculate grid margins based on legend position
    var legendStyle = config.legendStyle || 'classic';
    var legendPosition = config.legendPosition || 'bottom';
    var useStatsCard = legendStyle === 'card';
    var legendMargin = (config.showLegend && !useStatsCard) ? 35 : 0;

    var topMargin = 40;
    var bottomMargin = config.showDataZoomSlider ? 60 : 40;
    var leftMargin = 60;
    var rightMargin = config.hasSecondAxis ? 60 : 20;

    if (!useStatsCard) {
        if (legendPosition === 'top') topMargin += legendMargin;
        if (legendPosition === 'bottom') bottomMargin += legendMargin;
        if (legendPosition === 'left') leftMargin += legendMargin;
        if (legendPosition === 'right') rightMargin += legendMargin;
    }

    // Build Y-axes
    var yAxes = [{
        type: 'value',
        name: seriesConfigs[0] ? seriesConfigs[0].units : '',
        nameLocation: 'middle',
        nameGap: 45,
        min: config.yAxisMin,
        max: config.yAxisMax,
        axisLabel: { fontSize: 10 },
        splitLine: { lineStyle: { type: 'dashed', opacity: 0.3 } }
    }];

    if (config.hasSecondAxis) {
        // Find first series on second axis for units
        var secondAxisUnits = '';
        for (var j = 0; j < seriesConfigs.length; j++) {
            if (seriesConfigs[j].yAxisIndex === 1) {
                secondAxisUnits = seriesConfigs[j].units;
                break;
            }
        }
        yAxes.push({
            type: 'value',
            name: secondAxisUnits,
            nameLocation: 'middle',
            nameGap: 45,
            min: config.yAxis2Min,
            max: config.yAxis2Max,
            axisLabel: { fontSize: 10 },
            splitLine: { show: false }
        });
    }

    // Build legend config (only for classic style)
    var legendConfig = null;
    if (config.showLegend && !useStatsCard) {
        legendConfig = {
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
                legendConfig.right = config.hasSecondAxis ? 65 : 5;
                legendConfig.top = 'middle';
                legendConfig.orient = 'vertical';
                break;
            default:
                legendConfig.bottom = config.showDataZoomSlider ? 30 : 5;
                legendConfig.left = 'center';
                legendConfig.orient = 'horizontal';
        }
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
    }

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
    var tooltipConfig = {
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

self.onResize = function() {
    if (chart) {
        chart.resize();
    }
};

self.onDestroy = function() {
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
