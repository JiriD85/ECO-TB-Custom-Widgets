/**
 * ECO Widget Utils - Shared utility library for ECO Custom Widgets
 *
 * This library provides common functionality used across multiple widgets:
 * - Timewindow Selector
 * - Statistics Card Rendering
 * - Data Processing (outlier removal, smoothing)
 * - Formatting utilities
 *
 * Usage in widgets:
 *   var utils = window.ECOWidgetUtils;
 *   utils.timewindow.render(container, settings, ctx);
 *   utils.stats.calculate(values);
 *   utils.format.timestamp(ts, format);
 */

(function(global) {
    'use strict';

    var ECOWidgetUtils = {};

    // ========================================
    // Timewindow Selector Module (Factory Pattern)
    // ========================================
    // Each widget gets its own instance via create() or init()
    ECOWidgetUtils.timewindow = (function() {

        // Factory function to create a new timewindow selector instance
        function createInstance() {
            var state = {
                mode: 'custom',
                currentDate: new Date()
            };

            var settings = {};
            var container = null;
            var ctx = null;
            var labelElement = null;

            function init(twContainer, twSettings, widgetCtx) {
                container = twContainer;
                settings = twSettings || {};
                ctx = widgetCtx;
                state.currentDate = new Date();
                labelElement = null;

                // Set default mode from settings (default is 'custom')
                state.mode = settings.defaultMode || 'custom';

                // Store instance reference on container for retrieval
                if (container) {
                    container._twInstance = instance;
                }
            }

        function render() {
            if (!container) return;

            // Clear container
            while (container.firstChild) {
                container.removeChild(container.firstChild);
            }

            var positionMap = { left: 'flex-start', center: 'center', right: 'flex-end' };
            var position = settings.position || 'center';

            container.style.display = 'flex';
            container.style.alignItems = 'center';
            container.style.justifyContent = positionMap[position] || 'center';
            container.style.gap = '8px';
            container.style.padding = '8px';

            // Determine accent color
            var accentColor = '#2196F3';
            if (settings.color && settings.color !== '') {
                accentColor = settings.color;
            } else if (ctx && ctx.data && ctx.data[0] && ctx.data[0].dataKey && ctx.data[0].dataKey.color) {
                accentColor = ctx.data[0].dataKey.color;
            }

            var wrapper = document.createElement('div');
            wrapper.style.cssText = 'display: flex; align-items: center; gap: 6px; background: ' + accentColor + '; border-radius: 6px; padding: 6px 10px; box-shadow: 0 2px 6px rgba(0,0,0,0.12);';

            // Period buttons - always include all modes (D, W, M, C)
            var periodBtns = document.createElement('div');
            periodBtns.style.cssText = 'display: flex; gap: 4px;';

            ['day', 'week', 'month', 'custom'].forEach(function(m) {
                periodBtns.appendChild(createPeriodButton(m, accentColor));
            });

            // Navigation buttons (only shown for D, W, M modes)
            var navLeftBtn = createNavButton('◀', function() { navigate(-1); });
            var navRightBtn = createNavButton('▶', function() { navigate(1); });

            // Only show navigation for non-custom modes
            if (state.mode !== 'custom') {
                wrapper.appendChild(navLeftBtn);
                wrapper.appendChild(periodBtns);
                wrapper.appendChild(navRightBtn);
            } else {
                wrapper.appendChild(periodBtns);
            }

            // Period label - store reference for updates
            labelElement = document.createElement('span');
            labelElement.style.cssText = 'color: white; font-size: 11px; margin-left: 8px; opacity: 0.9;';
            labelElement.textContent = formatPeriodLabel(state.mode, state.currentDate);
            wrapper.appendChild(labelElement);

            // Calendar icon for custom mode datepicker
            if (state.mode === 'custom') {
                var calendarBtn = document.createElement('button');
                calendarBtn.textContent = '📅';
                calendarBtn.title = 'Zeitraum wählen';
                calendarBtn.style.cssText = 'background: rgba(255,255,255,0.2); border: none; color: white; width: 24px; height: 24px; border-radius: 4px; cursor: pointer; font-size: 12px; display: flex; align-items: center; justify-content: center; transition: background 0.2s; margin-left: 4px;';
                calendarBtn.onmouseover = function() { calendarBtn.style.background = 'rgba(255,255,255,0.35)'; };
                calendarBtn.onmouseout = function() { calendarBtn.style.background = 'rgba(255,255,255,0.2)'; };
                calendarBtn.onclick = function(e) {
                    e.stopPropagation();
                    showDatePicker(wrapper, accentColor);
                };
                wrapper.appendChild(calendarBtn);
            }

            container.appendChild(wrapper);
        }

        function showDatePicker(anchorElement, accentColor) {
            // Remove existing picker if any
            var existingPicker = document.getElementById('eco-tw-datepicker');
            if (existingPicker) {
                existingPicker.remove();
                return;
            }

            // Get current custom range or dashboard timewindow
            var startDate = new Date();
            var endDate = new Date();
            startDate.setDate(startDate.getDate() - 7); // Default: last 7 days

            if (state.customStart && state.customEnd) {
                startDate = new Date(state.customStart);
                endDate = new Date(state.customEnd);
            } else if (ctx && ctx.dashboard && ctx.dashboard.dashboardTimewindow) {
                var tw = ctx.dashboard.dashboardTimewindow;
                if (tw.history && tw.history.fixedTimewindow) {
                    startDate = new Date(tw.history.fixedTimewindow.startTimeMs);
                    endDate = new Date(tw.history.fixedTimewindow.endTimeMs);
                }
            }

            // Format dates for input fields
            function formatDateForInput(d) {
                return d.getFullYear() + '-' +
                       String(d.getMonth() + 1).padStart(2, '0') + '-' +
                       String(d.getDate()).padStart(2, '0');
            }

            // Create picker popup using safe DOM methods
            var picker = document.createElement('div');
            picker.id = 'eco-tw-datepicker';
            picker.style.cssText = 'position: absolute; top: 100%; left: 0; right: 0; margin-top: 4px; background: white; border-radius: 8px; padding: 12px; box-shadow: 0 4px 20px rgba(0,0,0,0.25); z-index: 10000; min-width: 280px;';

            var innerWrapper = document.createElement('div');
            innerWrapper.style.cssText = 'display: flex; flex-direction: column; gap: 10px;';

            // Title
            var title = document.createElement('div');
            title.style.cssText = 'font-size: 12px; font-weight: 600; color: #333; margin-bottom: 4px;';
            title.textContent = 'Zeitraum wählen';
            innerWrapper.appendChild(title);

            // Date inputs row
            var inputsRow = document.createElement('div');
            inputsRow.style.cssText = 'display: flex; gap: 8px; align-items: center;';

            // Start date container
            var startContainer = document.createElement('div');
            startContainer.style.cssText = 'flex: 1;';
            var startLabel = document.createElement('label');
            startLabel.style.cssText = 'font-size: 10px; color: #666; display: block; margin-bottom: 2px;';
            startLabel.textContent = 'Von';
            var startInput = document.createElement('input');
            startInput.type = 'date';
            startInput.id = 'eco-tw-start';
            startInput.value = formatDateForInput(startDate);
            startInput.style.cssText = 'width: 100%; padding: 6px 8px; border: 1px solid #ddd; border-radius: 4px; font-size: 12px; box-sizing: border-box;';
            startContainer.appendChild(startLabel);
            startContainer.appendChild(startInput);
            inputsRow.appendChild(startContainer);

            // End date container
            var endContainer = document.createElement('div');
            endContainer.style.cssText = 'flex: 1;';
            var endLabel = document.createElement('label');
            endLabel.style.cssText = 'font-size: 10px; color: #666; display: block; margin-bottom: 2px;';
            endLabel.textContent = 'Bis';
            var endInput = document.createElement('input');
            endInput.type = 'date';
            endInput.id = 'eco-tw-end';
            endInput.value = formatDateForInput(endDate);
            endInput.style.cssText = 'width: 100%; padding: 6px 8px; border: 1px solid #ddd; border-radius: 4px; font-size: 12px; box-sizing: border-box;';
            endContainer.appendChild(endLabel);
            endContainer.appendChild(endInput);
            inputsRow.appendChild(endContainer);

            innerWrapper.appendChild(inputsRow);

            // Buttons row
            var buttonsRow = document.createElement('div');
            buttonsRow.style.cssText = 'display: flex; gap: 6px; justify-content: flex-end; margin-top: 4px;';

            var cancelBtn = document.createElement('button');
            cancelBtn.style.cssText = 'padding: 6px 12px; border: 1px solid #ddd; background: white; border-radius: 4px; font-size: 11px; cursor: pointer;';
            cancelBtn.textContent = 'Abbrechen';

            var applyBtn = document.createElement('button');
            applyBtn.style.cssText = 'padding: 6px 12px; border: none; background: ' + accentColor + '; color: white; border-radius: 4px; font-size: 11px; cursor: pointer; font-weight: 500;';
            applyBtn.textContent = 'Anwenden';

            buttonsRow.appendChild(cancelBtn);
            buttonsRow.appendChild(applyBtn);
            innerWrapper.appendChild(buttonsRow);

            picker.appendChild(innerWrapper);

            // Position picker relative to anchor
            anchorElement.style.position = 'relative';
            anchorElement.appendChild(picker);

            // Event handlers
            cancelBtn.onclick = function(e) {
                e.stopPropagation();
                picker.remove();
            };

            applyBtn.onclick = function(e) {
                e.stopPropagation();
                var newStart = new Date(startInput.value);
                var newEnd = new Date(endInput.value);

                // Set end to end of day
                newEnd.setHours(23, 59, 59, 999);

                // Store custom range in state
                state.customStart = newStart.getTime();
                state.customEnd = newEnd.getTime();

                // Apply the custom range
                applyCustomRange(state.customStart, state.customEnd);

                picker.remove();
                updateLabel();
            };

            // Close on outside click
            function closeOnOutsideClick(e) {
                if (!picker.contains(e.target) && e.target !== picker) {
                    picker.remove();
                    document.removeEventListener('click', closeOnOutsideClick);
                }
            }
            setTimeout(function() {
                document.addEventListener('click', closeOnOutsideClick);
            }, 100);
        }

        function applyCustomRange(startMs, endMs) {
            if (!ctx) return;

            var timewindow = {
                history: {
                    fixedTimewindow: { startTimeMs: startMs, endTimeMs: endMs },
                    historyType: 0
                },
                aggregation: {
                    type: settings.aggregationType || 'NONE',
                    limit: settings.maxDataPoints || 100000
                }
            };

            var useDashboardTimewindow = ctx.widget && ctx.widget.config ? ctx.widget.config.useDashboardTimewindow : true;

            if (useDashboardTimewindow !== false) {
                if (ctx.dashboard && ctx.dashboard.updateDashboardTimewindow) {
                    ctx.dashboard.updateDashboardTimewindow(timewindow);
                } else if (ctx.dashboard && ctx.dashboard.onUpdateTimewindow) {
                    ctx.dashboard.onUpdateTimewindow(startMs, endMs);
                }
            } else {
                if (ctx.timewindowFunctions && ctx.timewindowFunctions.onUpdateTimewindow) {
                    ctx.timewindowFunctions.onUpdateTimewindow(startMs, endMs);
                }
            }
        }

        function createNavButton(symbol, onClick) {
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

            var isActive = state.mode === mode;
            var baseStyle = 'border: none; width: 28px; height: 24px; border-radius: 4px; cursor: pointer; font-size: 11px; font-weight: 600; transition: all 0.2s;';
            var activeStyle = 'background: white; color: ' + accentColor + ';';
            var inactiveStyle = 'background: rgba(255,255,255,0.2); color: white;';

            btn.style.cssText = baseStyle + (isActive ? activeStyle : inactiveStyle);

            btn.onmouseover = function() { if (state.mode !== mode) btn.style.background = 'rgba(255,255,255,0.35)'; };
            btn.onmouseout = function() { if (state.mode !== mode) btn.style.background = 'rgba(255,255,255,0.2)'; };
            btn.onclick = function() { selectMode(mode); };

            return btn;
        }

        function selectMode(mode) {
            state.mode = mode;
            if (mode !== 'custom') {
                state.currentDate = new Date();
            }
            apply();
            render();
        }

        function navigate(direction) {
            var d = new Date(state.currentDate);

            switch (state.mode) {
                case 'day': d.setDate(d.getDate() + direction); break;
                case 'week': d.setDate(d.getDate() + (direction * 7)); break;
                case 'month': d.setMonth(d.getMonth() + direction); break;
            }

            state.currentDate = d;
            apply();
            updateLabel();
        }

        function apply() {
            var range;

            if (state.mode === 'custom') {
                // Custom mode priority:
                // 1. User-selected range via datepicker (state.customStart/customEnd)
                // 2. Settings customStartTime/customEndTime
                // 3. Keep dashboard timewindow (no change)

                if (state.customStart && state.customEnd) {
                    // User selected a custom range via datepicker
                    range = { start: state.customStart, end: state.customEnd };
                } else if (settings.customStartTime) {
                    // Settings define custom start (end optional - defaults to now)
                    range = calculateCustomRange();
                } else {
                    // No custom settings - don't change the timewindow, just update label
                    updateLabel();
                    return;
                }
            } else {
                // D, W, M modes - clear any user-selected custom range
                state.customStart = null;
                state.customEnd = null;
                range = calculateRange(state.mode, state.currentDate);
            }

            if (!range || !ctx) return;

            var timewindow = {
                history: {
                    fixedTimewindow: { startTimeMs: range.start, endTimeMs: range.end },
                    historyType: 0
                },
                aggregation: {
                    type: settings.aggregationType || 'NONE',
                    limit: settings.maxDataPoints || 100000
                }
            };

            var useDashboardTimewindow = ctx.widget && ctx.widget.config ? ctx.widget.config.useDashboardTimewindow : true;

            if (useDashboardTimewindow !== false) {
                if (ctx.dashboard && ctx.dashboard.updateDashboardTimewindow) {
                    ctx.dashboard.updateDashboardTimewindow(timewindow);
                } else if (ctx.dashboard && ctx.dashboard.onUpdateTimewindow) {
                    ctx.dashboard.onUpdateTimewindow(range.start, range.end);
                }
            } else {
                if (ctx.timewindowFunctions && ctx.timewindowFunctions.onUpdateTimewindow) {
                    ctx.timewindowFunctions.onUpdateTimewindow(range.start, range.end);
                }
            }
        }

        function calculateRange(mode, referenceDate) {
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

        function calculateCustomRange() {
            var startStr = settings.customStartTime || '';
            var endStr = settings.customEndTime || '';

            var startMs = resolveTimeValue(startStr);
            var endMs = resolveTimeValue(endStr);

            // If start is not defined, use start of today
            if (startMs === null) {
                var now = new Date();
                startMs = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0).getTime();
            }

            // If end is not defined, use NOW (not end of today)
            if (endMs === null) {
                endMs = Date.now();
            }

            return { start: startMs, end: endMs };
        }

        function resolveTimeValue(valueStr) {
            if (!valueStr || valueStr === '') return null;

            var varMatch = valueStr.match(/^\$\{(.+)\}$/);
            if (varMatch && ctx) {
                return resolveEntityAttribute(varMatch[1]);
            }

            var numVal = Number(valueStr);
            if (!isNaN(numVal) && numVal > 0) return numVal;

            var dateVal = Date.parse(valueStr);
            if (!isNaN(dateVal)) return dateVal;

            return null;
        }

        function resolveEntityAttribute(attrName) {
            if (!ctx || !ctx.datasources || ctx.datasources.length === 0) return null;

            var ds = ctx.datasources[0];
            if (ds.entity) {
                if (ds.entity.attributes && ds.entity.attributes[attrName] !== undefined) {
                    return Number(ds.entity.attributes[attrName]);
                }
                if (ds.entity.sharedAttributes && ds.entity.sharedAttributes[attrName] !== undefined) {
                    return Number(ds.entity.sharedAttributes[attrName]);
                }
            }

            if (ctx.latestData) {
                for (var i = 0; i < ctx.latestData.length; i++) {
                    var ld = ctx.latestData[i];
                    if (ld.dataKey && ld.dataKey.name === attrName && ld.data && ld.data.length > 0) {
                        return Number(ld.data[ld.data.length - 1][1]);
                    }
                }
            }

            return null;
        }

        function formatPeriodLabel(mode, date) {
            var d = new Date(date);

            // Use settings formats with new defaults (German style)
            var dayFormat = settings.dayFormat || 'DD.MM.YYYY';
            var weekFormat = settings.weekFormat || 'DD.MM.YYYY - DD.MM.YYYY';
            var monthFormat = settings.monthFormat || 'MMMM YYYY';

            switch (mode) {
                case 'day':
                    return ECOWidgetUtils.format.date(d, dayFormat);
                case 'week':
                    var range = calculateRange('week', d);
                    var startD = new Date(range.start);
                    var endD = new Date(range.end);

                    // Check if format contains " - " separator for full date ranges
                    if (weekFormat.indexOf(' - ') !== -1) {
                        var parts = weekFormat.split(' - ');
                        var startFormat = parts[0];
                        var endFormat = parts[1] || parts[0];
                        return ECOWidgetUtils.format.date(startD, startFormat) + ' - ' + ECOWidgetUtils.format.date(endD, endFormat);
                    }

                    // Legacy formats: D-D or DD-DD (day range within same month)
                    var weekStr = weekFormat;
                    if (weekStr.indexOf('D-D') !== -1) {
                        weekStr = weekStr.replace('D-D', startD.getDate() + '-' + endD.getDate());
                    } else if (weekStr.indexOf('DD-DD') !== -1) {
                        weekStr = weekStr.replace('DD-DD', String(startD.getDate()).padStart(2, '0') + '-' + String(endD.getDate()).padStart(2, '0'));
                    } else {
                        // Fallback: show range with default format
                        return ECOWidgetUtils.format.date(startD, 'DD.MM.YYYY') + ' - ' + ECOWidgetUtils.format.date(endD, 'DD.MM.YYYY');
                    }
                    return ECOWidgetUtils.format.date(startD, weekStr);
                case 'month':
                    return ECOWidgetUtils.format.date(d, monthFormat);
                case 'custom':
                    // Custom mode: show user-selected range first
                    if (state.customStart && state.customEnd) {
                        var cs = new Date(state.customStart);
                        var ce = new Date(state.customEnd);
                        return ECOWidgetUtils.format.date(cs, 'DD.MM.YY') + ' - ' + ECOWidgetUtils.format.date(ce, 'DD.MM.YY');
                    }
                    // Then try dashboard timewindow
                    if (ctx && ctx.dashboard && ctx.dashboard.dashboardTimewindow) {
                        var tw = ctx.dashboard.dashboardTimewindow;
                        if (tw.history && tw.history.fixedTimewindow) {
                            var s = new Date(tw.history.fixedTimewindow.startTimeMs);
                            var e = new Date(tw.history.fixedTimewindow.endTimeMs);
                            return ECOWidgetUtils.format.date(s, 'DD.MM.YY') + ' - ' + ECOWidgetUtils.format.date(e, 'DD.MM.YY');
                        }
                    }
                    // Fallback: use custom range from settings if defined
                    var customRange = calculateCustomRange();
                    if (customRange && (settings.customStartTime || settings.customEndTime)) {
                        var csr = new Date(customRange.start);
                        var cer = new Date(customRange.end);
                        return ECOWidgetUtils.format.date(csr, 'DD.MM.YY') + ' - ' + ECOWidgetUtils.format.date(cer, 'DD.MM.YY');
                    }
                    return 'Dashboard';
            }
            return '';
        }

        function updateLabel() {
            if (labelElement) {
                labelElement.textContent = formatPeriodLabel(state.mode, state.currentDate);
            }
        }

        function hide() {
            if (container) {
                container.style.display = 'none';
            }
        }

        function getState() {
            return { mode: state.mode, currentDate: state.currentDate };
        }

        function setState(newState) {
            if (newState.mode) state.mode = newState.mode;
            if (newState.currentDate) state.currentDate = newState.currentDate;
        }

            // Instance API
            var instance = {
                init: init,
                render: render,
                hide: hide,
                apply: apply,
                navigate: navigate,
                selectMode: selectMode,
                getState: getState,
                setState: setState,
                calculateRange: calculateRange
            };

            return instance;
        }

        // Backwards-compatible singleton for simple usage
        // Each call to init() on a different container creates/retrieves the correct instance
        var defaultInstance = null;

        return {
            // Create a new independent instance (recommended for multiple widgets)
            create: function() {
                return createInstance();
            },

            // Backwards-compatible API - manages instances per container
            init: function(twContainer, twSettings, widgetCtx) {
                // Check if container already has an instance
                if (twContainer && twContainer._twInstance) {
                    defaultInstance = twContainer._twInstance;
                } else {
                    defaultInstance = createInstance();
                }
                defaultInstance.init(twContainer, twSettings, widgetCtx);
            },
            render: function() {
                if (defaultInstance) defaultInstance.render();
            },
            hide: function() {
                if (defaultInstance) defaultInstance.hide();
            },
            apply: function() {
                if (defaultInstance) defaultInstance.apply();
            },
            navigate: function(dir) {
                if (defaultInstance) defaultInstance.navigate(dir);
            },
            selectMode: function(mode) {
                if (defaultInstance) defaultInstance.selectMode(mode);
            },
            getState: function() {
                return defaultInstance ? defaultInstance.getState() : { mode: 'custom', currentDate: new Date() };
            },
            setState: function(newState) {
                if (defaultInstance) defaultInstance.setState(newState);
            },
            calculateRange: function(mode, date) {
                if (defaultInstance) return defaultInstance.calculateRange(mode, date);
                return null;
            }
        };
    })();

    // ========================================
    // Statistics Module
    // ========================================
    ECOWidgetUtils.stats = {
        calculate: function(values) {
            if (!values || values.length === 0) {
                return { mean: 0, median: 0, min: 0, max: 0, sum: 0, count: 0 };
            }

            var sorted = values.slice().sort(function(a, b) { return a - b; });
            var sum = 0;
            for (var i = 0; i < values.length; i++) {
                sum += values[i];
            }

            return {
                mean: sum / values.length,
                median: this.percentile(sorted, 50),
                min: sorted[0],
                max: sorted[sorted.length - 1],
                sum: sum,
                count: values.length
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
            for (var i = 0; i < values.length; i++) {
                sumSquares += Math.pow(values[i] - mean, 2);
            }
            return Math.sqrt(sumSquares / values.length);
        }
    };

    // ========================================
    // Data Processing Module
    // ========================================
    ECOWidgetUtils.dataProcessing = {
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
                    } else {
                        removed++;
                    }
                }
            } else if (method === 'zscore') {
                var threshold = (options && options.zscoreThreshold) || 3;
                var stats = ECOWidgetUtils.stats.calculate(values);
                var stdDev = ECOWidgetUtils.stats.stdDev(values, stats.mean);

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
                var multiplier = (options && options.iqrMultiplier) || 1.5;
                var sorted = values.slice().sort(function(a, b) { return a - b; });
                var q1 = ECOWidgetUtils.stats.percentile(sorted, 25);
                var q3 = ECOWidgetUtils.stats.percentile(sorted, 75);
                var iqr = q3 - q1;

                var lowerFence, upperFence;
                if (iqr === 0) {
                    var median = ECOWidgetUtils.stats.percentile(sorted, 50);
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
                    } else {
                        removed++;
                    }
                }
            }

            return {
                values: cleanValues,
                timestamps: cleanTimestamps,
                removed: removed
            };
        },

        movingAverage: function(values, windowSize) {
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
        },

        // Calculate window size from minutes based on data interval
        getWindowSizeFromMinutes: function(timestamps, minutes) {
            if (timestamps.length < 2) return 1;
            var totalTimeMs = timestamps[timestamps.length - 1] - timestamps[0];
            var avgIntervalMs = totalTimeMs / (timestamps.length - 1);
            var windowMs = minutes * 60 * 1000;
            return Math.max(1, Math.round(windowMs / avgIntervalMs));
        }
    };

    // ========================================
    // Statistics Card Rendering Module
    // ========================================
    ECOWidgetUtils.statsCard = {
        render: function(containers, config) {
            var self = this;

            // Clear all containers first
            ['top', 'bottom', 'left', 'right'].forEach(function(pos) {
                var container = containers[pos];
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
            var container = containers[position];
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

            // Create a card for each series
            config.allStats.forEach(function(seriesInfo) {
                var card = self.createCard(seriesInfo, config, isVertical);
                container.appendChild(card);
            });
        },

        createCard: function(seriesInfo, config, isVertical) {
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
                bgStyle = 'linear-gradient(' + gradientDir + ', ' + bgColor + ' 0%, ' + ECOWidgetUtils.color.adjust(bgColor, -40) + ' 100%)';
            } else {
                bgStyle = bgColor;
            }

            var card = document.createElement('div');
            card.style.cssText = 'background: ' + bgStyle + '; border-radius: 6px; padding: ' + (isVertical ? '10px 8px' : '8px 12px') + '; color: white; box-shadow: 0 2px 6px rgba(0,0,0,0.12); width: fit-content;';

            // Title
            var titleEl = document.createElement('div');
            titleEl.style.cssText = 'font-size: ' + (isVertical ? '11px' : '12px') + '; font-weight: 600; margin-bottom: 8px; opacity: 0.95;' + (isVertical ? ' text-align: center;' : '');
            titleEl.textContent = seriesInfo.label + (unit ? ' (' + unit + ')' : '');
            card.appendChild(titleEl);

            // Stats row
            var statsRow = document.createElement('div');
            statsRow.style.cssText = 'display: flex; flex-wrap: wrap; gap: 6px;' + (isVertical ? ' flex-direction: column;' : '');

            var statDefs = {
                current: { label: 'Current', icon: '●', value: stats.current },
                min: { label: 'Min', icon: '↓', value: stats.min },
                max: { label: 'Max', icon: '↑', value: stats.max },
                mean: { label: 'Mean', icon: 'μ', value: stats.mean },
                median: { label: 'Median', icon: '~', value: stats.median },
                sum: { label: 'Sum', icon: 'Σ', value: stats.sum },
                count: { label: 'Count', icon: 'n', value: stats.count },
                baseload: { label: 'Baseload', icon: '', value: stats.baseload },
                peak: { label: 'Peakload', icon: '', value: stats.peak }
            };

            legendValues.forEach(function(val) {
                var def = statDefs[val];
                if (def && def.value !== undefined && def.value !== null) {
                    var formattedVal = val === 'count' ? String(def.value) : ECOWidgetUtils.format.value(def.value, dec);

                    var statBox = document.createElement('div');
                    statBox.style.cssText = 'background: rgba(255,255,255,0.18); border-radius: 4px; padding: ' + (isVertical ? '4px 6px' : '4px 8px') + ';' + (isVertical ? ' text-align: center;' : ' min-width: 60px;');

                    var labelEl = document.createElement('div');
                    labelEl.style.cssText = 'font-size: 9px; opacity: 0.85;';
                    labelEl.textContent = def.icon ? (def.icon + ' ' + def.label) : def.label;
                    statBox.appendChild(labelEl);

                    var valueEl = document.createElement('div');
                    valueEl.style.cssText = 'font-size: ' + (isVertical ? '12px' : '13px') + '; font-weight: 600;';
                    valueEl.textContent = formattedVal;
                    statBox.appendChild(valueEl);

                    statsRow.appendChild(statBox);
                }
            });

            card.appendChild(statsRow);

            // Timestamp
            if (config.showTimestamp && stats.lastTimestamp) {
                var timestampEl = document.createElement('div');
                timestampEl.style.cssText = 'font-size: 9px; opacity: 0.7; margin-top: 6px;' + (isVertical ? ' text-align: center;' : '');
                timestampEl.textContent = ECOWidgetUtils.format.timestamp(stats.lastTimestamp, config.timestampFormat);
                card.appendChild(timestampEl);
            }

            return card;
        }
    };

    // ========================================
    // Color Utilities
    // ========================================
    ECOWidgetUtils.color = {
        adjust: function(color, amount) {
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
        },

        getDefault: function(index) {
            var colors = ['#2196F3', '#4CAF50', '#FF9800', '#E91E63', '#9C27B0', '#00BCD4', '#795548', '#607D8B'];
            return colors[index % colors.length];
        }
    };

    // ========================================
    // Formatting Utilities
    // ========================================
    ECOWidgetUtils.format = {
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
            var year = d.getFullYear();
            var month = String(d.getMonth() + 1).padStart(2, '0');
            var day = String(d.getDate()).padStart(2, '0');
            var hours = String(d.getHours()).padStart(2, '0');
            var minutes = String(d.getMinutes()).padStart(2, '0');
            var seconds = String(d.getSeconds()).padStart(2, '0');

            format = format || 'YYYY-MM-DD HH:mm:ss';

            return format
                .replace('YYYY', year)
                .replace('MM', month)
                .replace('DD', day)
                .replace('HH', hours)
                .replace('mm', minutes)
                .replace('ss', seconds);
        },

        date: function(date, format) {
            var monthsShort = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
            var monthsFull = ['Januar', 'Februar', 'März', 'April', 'Mai', 'Juni', 'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'];
            var d = new Date(date);

            format = format || 'D MMM YYYY';

            // Regex-based token replacement (longest tokens first to avoid partial matches)
            var tokens = {
                'YYYY': d.getFullYear(),
                'YY': String(d.getFullYear()).slice(-2),
                'MMMM': monthsFull[d.getMonth()],
                'MMM': monthsShort[d.getMonth()],
                'MM': String(d.getMonth() + 1).padStart(2, '0'),
                'DD': String(d.getDate()).padStart(2, '0'),
                'D': String(d.getDate()),
                'M': String(d.getMonth() + 1)
            };
            return format.replace(/(YYYY|MMMM|MMM|MM|DD|YY|D|M)/g, function(match) {
                return tokens[match] !== undefined ? tokens[match] : match;
            });
        }
    };

    // ========================================
    // Zoom Sync Module
    // ========================================
    ECOWidgetUtils.zoomSync = (function() {
        var listeners = {};
        var currentZoom = { start: 0, end: 100 };
        var broadcasterId = null;

        function broadcast(widgetId, start, end) {
            currentZoom = { start: start, end: end };
            broadcasterId = widgetId;

            // Notify all listeners except the broadcaster
            Object.keys(listeners).forEach(function(id) {
                if (id !== widgetId && listeners[id]) {
                    try {
                        listeners[id](start, end);
                    } catch (e) {
                        console.error('Zoom sync error:', e);
                    }
                }
            });
        }

        function subscribe(widgetId, callback) {
            listeners[widgetId] = callback;
        }

        function unsubscribe(widgetId) {
            delete listeners[widgetId];
        }

        function getZoom() {
            return currentZoom;
        }

        function reset() {
            currentZoom = { start: 0, end: 100 };
            broadcasterId = null;
        }

        return {
            broadcast: broadcast,
            subscribe: subscribe,
            unsubscribe: unsubscribe,
            getZoom: getZoom,
            reset: reset
        };
    })();

    // ========================================
    // Version Info
    // ========================================
    ECOWidgetUtils.version = '1.6.0';

    // Export to global scope
    global.ECOWidgetUtils = ECOWidgetUtils;

})(typeof window !== 'undefined' ? window : this);
