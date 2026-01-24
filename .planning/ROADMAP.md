# Roadmap: ECO-TB Custom Widgets

## Overview

This roadmap covers widget platform integration and testing. The core widget functionality (eco_load_duration_curve) is already implemented — now we need to align all widgets with ThingsBoard patterns and verify they work correctly in both preview and dashboard contexts.

## Phases

- [ ] **Phase 1: Platform Integration** - Align all widgets with ThingsBoard card-level patterns
- [ ] **Phase 2: Testing & Validation** - Verify widgets work in preview and dashboard

## Phase Details

### Phase 1: Platform Integration
**Goal**: Implement eco_timeseries_zoom_sync as reference widget with full ThingsBoard platform integration
**Depends on**: Nothing (first phase)
**Requirements**: PLAT-01, PLAT-02, PLAT-03
**Success Criteria** (what must be TRUE):
  1. Export and fullscreen buttons appear in widget card header (not ECharts toolbox)
  2. All color settings use ThingsBoard color picker UI
  3. Widgets use platform-provided aggregated data without custom aggregation logic
**Plans**: 2 plans

Plans:
- [ ] 01-01-PLAN.md — Complete widget implementation (source + JSON)
- [ ] 01-02-PLAN.md — Documentation update and ThingsBoard verification

### Phase 2: Testing & Validation
**Goal**: Widgets display data correctly in both preview and dashboard contexts
**Depends on**: Phase 1
**Requirements**: TEST-01, TEST-02
**Success Criteria** (what must be TRUE):
  1. Widget preview in editor shows sample data correctly
  2. Widget on dashboard displays real datasource data correctly
  3. Zoom sync works between widgets and timewindow
**Plans**: TBD

Plans:
- [ ] 02-01: Preview and dashboard testing

## Progress

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Platform Integration | 0/2 | Planning done | - |
| 2. Testing & Validation | 0/1 | Not started | - |
