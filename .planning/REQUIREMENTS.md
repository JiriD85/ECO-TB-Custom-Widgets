# Requirements: ECO-TB Custom Widgets

**Defined:** 2026-01-24
**Core Value:** Widgets must display data correctly and integrate seamlessly with ThingsBoard's dashboard ecosystem

## v1 Requirements

Requirements for current milestone. Organized by widget capability.

### Load Duration Curve (Implemented)

- [x] **LDC-01**: Display duration curve sorted descending correctly
- [x] **LDC-02**: Optionally show load profile (Lastgang) alongside duration curve
- [x] **LDC-03**: Support data smoothing via moving average
- [x] **LDC-04**: Support energy→power conversion (kWh→kW)
- [x] **LDC-05**: Show configurable thresholds with color picker
- [x] **LDC-06**: Show mean/median reference lines in load profile
- [x] **LDC-07**: Support outlier detection (IQR, Z-Score, Manual methods)

### Platform Integration (Active)

- [ ] **PLAT-01**: All widgets use card-level buttons (export, fullscreen) alongside ECharts toolbox (both available)
- [ ] **PLAT-02**: All widgets use color picker (`type: "color"`) for color settings
- [ ] **PLAT-03**: All widgets leverage platform aggregation (not custom aggregation)

### Widget Preview & Testing

- [ ] **TEST-01**: Widget preview works correctly in ThingsBoard widget editor
- [ ] **TEST-02**: Widgets display data correctly with test datasources

## v2 Requirements

Deferred to future. Not in current roadmap.

### Additional Widgets

- **SYNC-01**: eco_timeseries_zoom_sync uses dashboard zoom sync correctly
- **SYNC-02**: eco_timeseries_zoom_sync handles timewindow updates
- **BOX-01**: eco_boxplot calculates quartiles correctly
- **HEAT-01**: eco_heatmap_cartesian groups data by time period

## Out of Scope

Explicitly excluded from widget implementation.

| Feature | Reason |
|---------|--------|
| Custom aggregation in widgets | Platform handles via timewindow server-side |
| Real-time streaming logic | Use platform subscription mechanism |
| Mobile-specific layouts | ThingsBoard handles responsive behavior |

## Traceability

Which phases cover which requirements.

| Requirement | Phase | Status |
|-------------|-------|--------|
| LDC-01 | Pre-GSD | Complete |
| LDC-02 | Pre-GSD | Complete |
| LDC-03 | Pre-GSD | Complete |
| LDC-04 | Pre-GSD | Complete |
| LDC-05 | Pre-GSD | Complete |
| LDC-06 | Pre-GSD | Complete |
| LDC-07 | Pre-GSD | Complete |
| PLAT-01 | Phase 1 | Pending |
| PLAT-02 | Phase 1 | Pending |
| PLAT-03 | Phase 1 | Pending |
| TEST-01 | Phase 2 | Pending |
| TEST-02 | Phase 2 | Pending |

**Coverage:**
- v1 requirements: 12 total
- Implemented (Pre-GSD): 7
- Active: 5 (mapped to Phases 1-2)
- Unmapped: 0 ✓

---
*Requirements defined: 2026-01-24*
*Last updated: 2026-01-24 after GSD initialization*
