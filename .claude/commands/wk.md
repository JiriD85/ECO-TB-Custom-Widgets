---
name: wk
description: Widget Knowledge (Alias) - Schnellzugriff auf ThingsBoard/ECharts Wissensbank
allowed-tools: Read, Glob, Grep, mcp__plugin_context7_context7__resolve-library-id, mcp__plugin_context7_context7__query-docs, WebSearch
---

# Widget Knowledge (Kurzform)

Alias für `/widget-knowledge`. Siehe dort für vollständige Dokumentation.

## Quick Reference

**ECharts Docs**: Context7 mit `/apache/echarts`
**Projekt-Patterns**: `.planning/codebase/WIDGET-PATTERNS.md`
**Reference Widget**: `widgets/types/eco_timeseries_zoom_sync.json`

## ThingsBoard Widget API

```javascript
self.ctx.data              // Daten
self.ctx.settings          // Settings
self.ctx.timeWindow        // Zeitfenster
self.ctx.$container        // Container
self.ctx.dashboard.onUpdateTimewindow(start, end)  // Zoom Sync
```

Beantworte die Frage des Users mit der passenden Wissensquelle.
