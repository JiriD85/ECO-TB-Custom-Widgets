# Phase 1: Platform Integration - Context

**Gathered:** 2026-01-24
**Status:** Ready for planning

<domain>
## Phase Boundary

Align eco_timeseries_zoom_sync with ThingsBoard card-level patterns. This widget serves as reference implementation with documentation for later widgets.

</domain>

<decisions>
## Implementation Decisions

### Widget Scope
- Focus on eco_timeseries_zoom_sync only in this phase
- One widget = one plan
- Ziel: Vollständige Integration UND Referenz-Dokumentation für spätere Widgets

### Grundfunktionalität
- **Zweck**: Zeitreihen-Visualisierung + Widget-internes Zoomen
- **Chart-Typen**: Line, Bar, Area, Scatter (alle unterstützt)
- **Datenquellen**: Mehrere Datasources mit mehreren Datenpunkten (konfigurierbar via ThingsBoard)
- **Zoom**: Kein Dashboard-Sync — Zoom nur innerhalb des Widgets
  - Brush-Selection (Bereich mit Maus ziehen)
  - DataZoom Slider (Schieberegler unter Chart)
  - Beides verfügbar

### Legende (Statistics Cards)
**Basis:** Alle Features von eco_load_duration_curve übernehmen
- Style: Classic (Text) vs Card wählbar
- Position: top/bottom/left/right
- Alignment: left/center/right

**Multi-Card bei mehreren Datenpunkten:**
- Jeder Datenpunkt jeder Datasource bekommt eigene Card
- Card-Layout: konfigurierbar (horizontal, vertikal, grid/wrap)

**Card-Farbe:**
- Mode: Automatisch (Series-Farbe) vs Manual vs Einheitliche Farbe für alle
- Style: Solid vs Gradient
- Transparenz: konfigurierbar
- **Default**: Automatisch + Solid

**Card-Inhalt:**
- Statistik-Werte: konfigurierbar (aktueller Wert, min, max, mean, median, sum, count)
- **Default**: nur aktueller Wert
- Timestamp des letzten Datenpunkts: ein/ausblendbar
- Timestamp-Format: konfigurierbar
- **Default**: eingeblendet, Format `YYYY-MM-DD hh:mm:ss`

### Tooltip
- Bei mehreren Series: alle Series anzeigen (nicht nur unter Cursor)
- Informationen: Zeitstempel, Wert, Einheit, Series-Name
- Zahlenformat: automatisch (Plattform/Locale-basiert)

### Achsen-Konfiguration
**X-Achse:**
- Zeitformat: konfigurierbar

**Y-Achsen:**
- Zwei Achsen möglich (links + rechts für unterschiedliche Einheiten)
- Skalierung: Auto als Default, optional manuell überschreibbar (min/max)
- Labels: aus Datasource als Default, optional überschreibbar

### ECharts Toolbox
- Toolbox komplett behalten (zusätzlich zu Card buttons)
- Aktive Features: saveAsImage, dataView, dataZoom, restore
- Sichtbarkeit: per Setting konfigurierbar (immer sichtbar vs nur bei Hover)
- Granulare Settings pro Feature:
  - showSaveAsImage: true (default)
  - showDataView: true (default)
  - showDataZoom: true (default)
  - showRestore: true (default)

### Claude's Discretion
- Position der toolbox im Chart (basierend auf Layout)
- Struktur der Referenz-Dokumentation
- Konkrete Setting-Namen und Schema-Struktur

</decisions>

<specifics>
## Specific Ideas

- Widget soll als Vorlage/Referenz für alle anderen Widgets dienen
- Dokumentation in CLAUDE.md ergänzen mit den Patterns aus diesem Widget
- Legenden-System von eco_load_duration_curve wiederverwenden

</specifics>

<deferred>
## Deferred Ideas

- Dashboard-weiter Zoom-Sync (timewindow sync) — eigene Phase falls gewünscht
- Weitere Widgets (eco_load_duration_curve, boxplot, etc.) — nach diesem Widget

</deferred>

---

*Phase: 01-platform-integration*
*Context gathered: 2026-01-24 (updated)*
