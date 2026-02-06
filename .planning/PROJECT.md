# ECO-TB Custom Widgets

## What This Is

Custom ECharts-based widget library for ThingsBoard 4.2 PE, providing specialized visualizations for energy diagnostics dashboards. Includes duration curves, statistical charts, and synchronized time series displays for ECO Smart Diagnostics platform.

## Core Value

Widgets must display data correctly and integrate seamlessly with ThingsBoard's dashboard ecosystem (zoom sync, timewindow, card buttons).

## Requirements

### Validated

(None yet — need user testing on ThingsBoard)

### Implemented (2026-01-24)

- [x] **WIDGET-01**: eco_load_duration_curve displays duration curve (sorted descending) correctly
- [x] **WIDGET-02**: eco_load_duration_curve optionally shows load profile (Lastgang)
- [x] **WIDGET-03**: eco_load_duration_curve supports data smoothing (moving average)
- [x] **WIDGET-04**: eco_load_duration_curve supports energy→power conversion (kWh→kW)
- [x] **WIDGET-05**: eco_load_duration_curve shows configurable thresholds with color picker
- [x] **WIDGET-06**: eco_load_duration_curve shows mean/median lines in load profile
- [x] **WIDGET-10**: eco_load_duration_curve supports outlier detection (IQR, Z-Score, Manual)

### Active

- [ ] **WIDGET-07**: All widgets use card-level buttons (export, fullscreen) correctly
- [ ] **WIDGET-08**: All widgets use color picker for color settings
- [ ] **WIDGET-09**: All widgets leverage platform aggregation (not custom)

### Out of Scope

- Custom aggregation in widget — Platform handles this via timewindow
- Real-time streaming — Use platform subscription

## Context

**Existing codebase:**
- 10 ECharts widgets in `widgets/types/`
- Sync CLI tool in `sync/`
- ThingsBoard 4.2 PE target platform

**Current issues:**
- Widgets don't display data correctly
- Preview doesn't work
- Zoom sync broken
- Export buttons in wrong place (ECharts toolbox vs card level)

**Research findings (2026-01-24):**
- Card buttons (enableDataExport, enableFullscreen) go in defaultConfig, not settingsSchema
- Color picker: use `{"type": "color"}` in form array
- Platform aggregates data server-side; widget receives pre-aggregated data
- Widget API: self.ctx.data, self.ctx.settings, self.ctx.timeWindow

## Constraints

- **Platform**: ThingsBoard 4.2 PE
- **Charting**: ECharts 5.5.0 (CDN)
- **Compatibility**: Must work in widget preview and dashboard

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Use platform aggregation | Server-side aggregation is more efficient | — Pending |
| Card-level export buttons | ThingsBoard standard pattern | — Pending |
| Color picker in settings | Better UX than hex input | — Pending |

---
*Last updated: 2026-01-24 after milestone v2.0 start*
