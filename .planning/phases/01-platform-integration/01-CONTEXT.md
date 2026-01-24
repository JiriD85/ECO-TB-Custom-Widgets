# Phase 1: Platform Integration - Context

**Gathered:** 2026-01-24
**Status:** Ready for planning

<domain>
## Phase Boundary

Align widgets with ThingsBoard card-level patterns: export buttons, fullscreen, color pickers, platform aggregation. For this phase: focus on eco_timeseries_zoom_sync as reference implementation with documentation for later widgets.

</domain>

<decisions>
## Implementation Decisions

### Widget Scope
- Focus on eco_timeseries_zoom_sync only in this phase
- One widget = one plan (nicht mehrere Widgets gruppieren)
- Ziel: Vollständige Integration UND Referenz-Dokumentation für spätere Widgets
- Reihenfolge für spätere Phasen: eco_timeseries_zoom_sync → dann weitere Widgets einzeln

### ECharts Toolbox
- Toolbox komplett behalten (zusätzlich zu Card buttons)
- Aktive Features: saveAsImage, dataView, dataZoom, restore
- Toolbox-Sichtbarkeit: per Setting konfigurierbar (immer sichtbar vs nur bei Hover)
- Einzelne Features granular per Setting ein/ausschaltbar:
  - showSaveAsImage: true (default)
  - showDataView: true (default)
  - showDataZoom: true (default)
  - showRestore: true (default)
- Standard: alle Features aktiviert

### Claude's Discretion
- Position der toolbox im Chart (basierend auf Widget-Layout)
- Wie die Referenz-Dokumentation strukturiert wird

</decisions>

<specifics>
## Specific Ideas

- Widget soll als Vorlage/Referenz für alle anderen Widgets dienen
- Dokumentation in CLAUDE.md ergänzen mit den Patterns aus diesem Widget

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 01-platform-integration*
*Context gathered: 2026-01-24*
